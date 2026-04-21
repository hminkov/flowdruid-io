import { z } from 'zod';
import { postStandupSchema, listStandupsSchema } from '@flowdruid/shared';
import { router, protectedProcedure } from '../trpc';
import { slackQueue } from '../lib/queue';

export const standupsRouter = router({
  post: protectedProcedure.input(postStandupSchema).mutation(async ({ ctx, input }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Upsert: one standup per user per day
    const existing = await ctx.prisma.standup.findFirst({
      where: {
        userId: ctx.user.id,
        teamId: input.teamId,
        postedAt: { gte: today, lt: tomorrow },
      },
    });

    let standup;
    if (existing) {
      standup = await ctx.prisma.standup.update({
        where: { id: existing.id },
        data: {
          yesterday: input.yesterday,
          today: input.today,
          blockers: input.blockers,
          capacityPct: input.capacityPct,
        },
      });
    } else {
      standup = await ctx.prisma.standup.create({
        data: {
          userId: ctx.user.id,
          teamId: input.teamId,
          yesterday: input.yesterday,
          today: input.today,
          blockers: input.blockers,
          capacityPct: input.capacityPct,
        },
      });
    }

    // Check which notifications are enabled for this org. Skip the
    // queue adds entirely when the toggle is off so we don't spam the
    // queue with no-op jobs.
    const slackConfig = await ctx.prisma.slackConfig.findUnique({
      where: { orgId: ctx.user.orgId },
      select: { notifyStandup: true, notifyBlocker: true },
    });

    if (slackConfig?.notifyStandup) {
      await slackQueue.add(`standup.posted`, {
        type: 'standup.posted',
        orgId: ctx.user.orgId,
        teamId: input.teamId,
        userId: ctx.user.id,
        userName: ctx.user.name,
        yesterday: input.yesterday,
        today: input.today,
        capacityPct: input.capacityPct,
        blockers: input.blockers,
      });
    }

    // Separate rotating-light alert when the standup flags a blocker —
    // gated by the notifyBlocker toggle independently of notifyStandup,
    // so admins can mute routine standups but still see escalations.
    if (slackConfig?.notifyBlocker && input.blockers && input.blockers.trim()) {
      await slackQueue.add('blocker.flagged', {
        type: 'blocker.flagged',
        orgId: ctx.user.orgId,
        teamId: input.teamId,
        userId: ctx.user.id,
        userName: ctx.user.name,
        blockers: input.blockers,
      });
    }

    return standup;
  }),

  list: protectedProcedure.input(listStandupsSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {};
    where.team = { orgId: ctx.user.orgId };

    if (input.teamId) where.teamId = input.teamId;
    if (input.userId) where.userId = input.userId;
    if (input.date) {
      const day = new Date(input.date);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      where.postedAt = { gte: day, lt: next };
    }

    return ctx.prisma.standup.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, initials: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { postedAt: 'desc' },
    });
  }),

  today: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return ctx.prisma.standup.findFirst({
      where: {
        userId: ctx.user.id,
        postedAt: { gte: today, lt: tomorrow },
      },
    });
  }),

  teamSummary: protectedProcedure
    .input(z.object({ teamId: z.string(), date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const day = input.date ? new Date(input.date) : new Date();
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);

      return ctx.prisma.standup.findMany({
        where: {
          teamId: input.teamId,
          team: { orgId: ctx.user.orgId },
          postedAt: { gte: day, lt: next },
        },
        include: {
          user: { select: { id: true, name: true, initials: true, availability: true } },
        },
        orderBy: { postedAt: 'desc' },
      });
    }),
});
