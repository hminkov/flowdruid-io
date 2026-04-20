import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { requestLeaveSchema, listLeavesSchema, leaveCalendarSchema } from '@flowdruid/shared';
import { router, protectedProcedure, leadProcedure } from '../trpc';
import { slackQueue } from '../lib/queue';
import { audit } from '../lib/audit';
import { publish } from '../lib/events';

export const leavesRouter = router({
  request: protectedProcedure.input(requestLeaveSchema).mutation(async ({ ctx, input }) => {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    // Check for overlapping pending/approved requests
    const overlap = await ctx.prisma.leaveRequest.findFirst({
      where: {
        userId: ctx.user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlap) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You already have a leave request for this date range',
      });
    }

    // SICK leave is auto-approved
    const status = input.type === 'SICK' ? 'APPROVED' : 'PENDING';

    const leave = await ctx.prisma.leaveRequest.create({
      data: {
        userId: ctx.user.id,
        type: input.type,
        status,
        startDate,
        endDate,
        note: input.note,
        notifySlack: input.notifySlack,
      },
    });

    if (status === 'APPROVED' && input.notifySlack) {
      await slackQueue.add('leave.approved', {
        type: 'leave.approved',
        orgId: ctx.user.orgId,
        teamId: ctx.user.teamId,
        userId: ctx.user.id,
        userName: ctx.user.name,
        leaveType: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }

    return leave;
  }),

  list: protectedProcedure.input(listLeavesSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {};

    // Regular users can only see their own
    if (ctx.user.role === 'DEVELOPER') {
      where.userId = ctx.user.id;
    } else if (input.userId) {
      where.userId = input.userId;
    }
    where.user = { orgId: ctx.user.orgId };

    if (input.status) where.status = input.status;

    return ctx.prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, initials: true, team: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  pending: leadProcedure.query(async ({ ctx }) => {
    const where: Record<string, unknown> = {
      status: 'PENDING',
      user: { orgId: ctx.user.orgId },
    };

    // Team leads only see their team's requests
    if (ctx.user.role === 'TEAM_LEAD') {
      where.user = { orgId: ctx.user.orgId, teamId: ctx.user.teamId };
    }

    return ctx.prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, initials: true, team: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }),

  approve: leadProcedure
    .input(z.object({ leaveId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const leave = await ctx.prisma.leaveRequest.findFirst({
        where: { id: input.leaveId, user: { orgId: ctx.user.orgId } },
        include: { user: true },
      });
      if (!leave) throw new TRPCError({ code: 'NOT_FOUND' });
      if (leave.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Leave request is not pending' });
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const u = await tx.leaveRequest.update({
          where: { id: input.leaveId },
          data: { status: 'APPROVED', reviewedBy: ctx.user.id, reviewedAt: new Date() },
        });
        await audit({ prisma: tx, user: ctx.user }, 'LEAVE_APPROVED', 'LeaveRequest', u.id, {
          before: { status: 'PENDING' },
          after: { status: 'APPROVED', requesterId: leave.userId, type: leave.type },
        });
        return u;
      });

      // Update availability if leave starts today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (leave.startDate <= today && leave.endDate >= today) {
        await ctx.prisma.user.update({
          where: { id: leave.userId },
          data: { availability: 'ON_LEAVE' },
        });
        await publish(ctx.user.orgId, null, {
          type: 'user.availability',
          userId: leave.userId,
          availability: 'ON_LEAVE',
        });
      }

      // Let the requester's inbox + calendar refresh live.
      await publish(ctx.user.orgId, leave.userId, {
        type: 'leave.updated',
        id: updated.id,
      });

      if (leave.notifySlack) {
        await slackQueue.add('leave.approved', {
          type: 'leave.approved',
          orgId: ctx.user.orgId,
          teamId: leave.user.teamId,
          userId: leave.userId,
          userName: leave.user.name,
          leaveType: leave.type,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
        });
      }

      return updated;
    }),

  deny: leadProcedure
    .input(z.object({ leaveId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const leave = await ctx.prisma.leaveRequest.findFirst({
        where: { id: input.leaveId, user: { orgId: ctx.user.orgId } },
        include: { user: true },
      });
      if (!leave) throw new TRPCError({ code: 'NOT_FOUND' });
      if (leave.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Leave request is not pending' });
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const u = await tx.leaveRequest.update({
          where: { id: input.leaveId },
          data: { status: 'DENIED', reviewedBy: ctx.user.id, reviewedAt: new Date() },
        });
        await audit({ prisma: tx, user: ctx.user }, 'LEAVE_DENIED', 'LeaveRequest', u.id, {
          before: { status: 'PENDING' },
          after: { status: 'DENIED', requesterId: leave.userId, type: leave.type },
        });
        return u;
      });

      if (leave.notifySlack) {
        await slackQueue.add('leave.denied', {
          type: 'leave.denied',
          orgId: ctx.user.orgId,
          userId: leave.userId,
          userName: leave.user.name,
          leaveType: leave.type,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
        });
      }

      await publish(ctx.user.orgId, leave.userId, {
        type: 'leave.updated',
        id: updated.id,
      });

      return updated;
    }),

  calendar: protectedProcedure.input(leaveCalendarSchema).query(async ({ ctx, input }) => {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    const where: Record<string, unknown> = {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      user: { orgId: ctx.user.orgId },
    };

    if (input.teamId) {
      where.user = { orgId: ctx.user.orgId, teamId: input.teamId };
    }

    return ctx.prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, initials: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: { startDate: 'asc' },
    });
  }),
});
