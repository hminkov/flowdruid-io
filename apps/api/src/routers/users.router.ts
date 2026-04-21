import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { inviteUserSchema, updateUserSchema, updateAvailabilitySchema } from '@flowdruid/shared';
import { router, protectedProcedure, adminProcedure, leadProcedure } from '../trpc';
import { audit } from '../lib/audit';

export const usersRouter = router({
  list: leadProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { orgId: ctx.user.orgId, active: true },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        role: true,
        teamId: true,
        availability: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }),

  invite: adminProcedure.input(inviteUserSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email already in use' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await ctx.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          initials: input.initials,
          passwordHash,
          role: input.role,
          orgId: ctx.user.orgId,
          teamId: input.teamId,
        },
      });
      await audit({ prisma: tx, user: ctx.user }, 'USER_CREATED', 'User', created.id, {
        after: { email: created.email, name: created.name, role: created.role, teamId: created.teamId },
      });
      return created;
    });

    return { userId: user.id, tempPassword };
  }),

  update: adminProcedure.input(updateUserSchema).mutation(async ({ ctx, input }) => {
    const { userId, ...data } = input;
    return ctx.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId, orgId: ctx.user.orgId },
        select: { id: true, role: true, teamId: true, name: true, email: true },
      });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND' });
      const after = await tx.user.update({
        where: { id: userId, orgId: ctx.user.orgId },
        data,
      });
      if (data.role !== undefined && data.role !== before.role) {
        await audit({ prisma: tx, user: ctx.user }, 'USER_ROLE_CHANGED', 'User', userId, {
          before: { role: before.role },
          after: { role: after.role },
        });
      }
      return after;
    });
  }),

  updateAvailability: protectedProcedure
    .input(updateAvailabilitySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { availability: input.availability },
      });
    }),

  // Force-logout a user by deleting every refresh token on their
  // account. Useful when a laptop is lost, a password is rotated,
  // or someone's role changes and we don't want their existing
  // session to keep running at the old scope.
  revokeSessions: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findFirst({
        where: { id: input.userId, orgId: ctx.user.orgId },
        select: { id: true },
      });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });

      const result = await ctx.prisma.refreshToken.deleteMany({
        where: { userId: input.userId },
      });
      return { revoked: result.count };
    }),

  deactivate: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const before = await tx.user.findUnique({
          where: { id: input.userId, orgId: ctx.user.orgId },
          select: { id: true, email: true, name: true, active: true },
        });
        if (!before) throw new TRPCError({ code: 'NOT_FOUND' });
        const updated = await tx.user.update({
          where: { id: input.userId, orgId: ctx.user.orgId },
          data: { active: false },
        });
        // A deactivated user should immediately lose every active
        // session, not just the next time their access token expires.
        await tx.refreshToken.deleteMany({ where: { userId: input.userId } });
        await audit({ prisma: tx, user: ctx.user }, 'USER_DEACTIVATED', 'User', input.userId, {
          before: { email: before.email, name: before.name, active: before.active },
          after: { active: false },
        });
        return updated;
      });
    }),
});
