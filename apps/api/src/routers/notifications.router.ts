import { TRPCError } from '@trpc/server';
import { listNotificationsSchema, markReadSchema } from '@flowdruid/shared';
import { router, protectedProcedure } from '../trpc';

const MENTION_TYPES = ['STANDUP_MENTION', 'TICKET_SUGGESTED'] as const;
const ACTION_TYPES = [
  'LEAVE_PENDING',
  'TICKET_SUGGESTED',
  'BLOCKER_ON_TEAM',
  'PROD_SUPPORT_ON_CALL',
] as const;

export const notificationsRouter = router({
  list: protectedProcedure.input(listNotificationsSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = { userId: ctx.user.id };
    if (input.filter === 'unread') where.read = false;
    if (input.filter === 'mentions') where.type = { in: MENTION_TYPES as unknown as string[] };
    if (input.filter === 'actions') where.type = { in: ACTION_TYPES as unknown as string[] };

    return ctx.prisma.notification.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, initials: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    });
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.notification.count({
      where: { userId: ctx.user.id, read: false },
    });
  }),

  markRead: protectedProcedure.input(markReadSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.notification.updateMany({
      where: { id: { in: input.ids }, userId: ctx.user.id },
      data: { read: true },
    });
    return { updated: result.count };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.notification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }),

  // Admin-/lead-level testing hook so we can emit a sample notification from the UI
  dismiss: protectedProcedure.input(markReadSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.notification.deleteMany({
      where: { id: { in: input.ids }, userId: ctx.user.id },
    });
    if (result.count === 0) throw new TRPCError({ code: 'NOT_FOUND' });
    return { dismissed: result.count };
  }),
});
