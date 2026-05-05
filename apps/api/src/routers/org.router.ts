import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';
import { completeOnboardingSchema } from '@flowdruid/shared';
import { router, protectedProcedure, adminProcedure } from '../trpc';

export const orgRouter = router({
  // Lightweight read of "what org am I in, and is it set up yet?"
  // The SPA calls this on every protected page mount so the
  // onboarding redirect can happen without an extra round trip.
  current: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organisation.findUnique({
      where: { id: ctx.user.orgId },
      select: { id: true, name: true, slug: true, onboardedAt: true },
    });
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Organisation not found' });
    }
    return org;
  }),

  // First-run wizard: rename the auto-generated workspace, optionally
  // spin up an initial team, optionally seed teammate accounts so the
  // admin doesn't land on an empty dashboard. Idempotent only in the
  // sense that callers can re-run it before onboardedAt is stamped;
  // once stamped, the router falls through to a no-op success.
  completeOnboarding: adminProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.prisma.organisation.findUnique({
        where: { id: ctx.user.orgId },
        select: { id: true, onboardedAt: true },
      });
      if (!org) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organisation not found' });
      }
      if (org.onboardedAt) {
        return { ok: true, alreadyOnboarded: true as const };
      }

      // Filter out the admin's own email and any duplicates so we
      // don't try to create a User row that already exists.
      const inviteEmails = Array.from(
        new Set(
          input.inviteEmails
            .map((e) => e.toLowerCase().trim())
            .filter((e) => e && e !== ctx.user.email.toLowerCase()),
        ),
      );

      // Pull existing rows in one shot so we can reject the whole
      // request if any invite collides with another org's user.
      const existing = await ctx.prisma.user.findMany({
        where: { email: { in: inviteEmails } },
        select: { email: true, orgId: true },
      });
      const conflicts = existing.filter((u) => u.orgId !== ctx.user.orgId);
      if (conflicts.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Already in use elsewhere: ${conflicts.map((c) => c.email).join(', ')}`,
        });
      }
      const alreadyInOrg = new Set(existing.map((u) => u.email));
      const toCreate = inviteEmails.filter((e) => !alreadyInOrg.has(e));

      const teamId = await ctx.prisma.$transaction(async (tx) => {
        await tx.organisation.update({
          where: { id: org.id },
          data: { name: input.workspaceName, onboardedAt: new Date() },
        });

        let createdTeamId: string | null = null;
        if (input.teamName) {
          const team = await tx.team.create({
            data: { name: input.teamName, orgId: org.id },
          });
          createdTeamId = team.id;
          // Drop the admin onto the new team so the admin's own
          // dashboard isn't empty after onboarding.
          await tx.user.update({
            where: { id: ctx.user.id },
            data: { teamId: team.id },
          });
        }

        // Each invitee gets a User row with a high-entropy password
        // hash they don't know — they're expected to sign in with
        // Google (match-by-email links them in) or use forgot-password
        // to set a real one.
        for (const email of toCreate) {
          const random = crypto.randomBytes(32).toString('hex');
          const hash = await bcrypt.hash(random, 10);
          const localPart = email.split('@')[0] ?? 'User';
          const initials =
            (localPart.match(/[a-zA-Z]/g) ?? ['U'])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'U';
          await tx.user.create({
            data: {
              email,
              name: localPart,
              initials,
              passwordHash: hash,
              role: 'DEVELOPER',
              orgId: org.id,
              teamId: createdTeamId,
            },
          });
        }

        return createdTeamId;
      });

      return {
        ok: true,
        alreadyOnboarded: false as const,
        teamId,
        invitesCreated: toCreate.length,
      };
    }),
});
