import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTicketSchema, updateTicketSchema, listTicketsSchema, assignTicketSchema } from '@flowdruid/shared';
import { router, protectedProcedure, leadProcedure } from '../trpc';

export const ticketsRouter = router({
  list: protectedProcedure.input(listTicketsSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {};

    // Scope to org teams
    where.team = { orgId: ctx.user.orgId };

    if (input.teamId) where.teamId = input.teamId;
    if (input.status) where.status = input.status;
    if (input.source) where.source = input.source;
    if (input.assigneeId) {
      where.assignees = { some: { userId: input.assigneeId } };
    }

    return ctx.prisma.ticket.findMany({
      where,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, initials: true } } },
        },
        team: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }),

  create: protectedProcedure.input(createTicketSchema).mutation(async ({ ctx, input }) => {
    const { assigneeIds, ...data } = input;

    return ctx.prisma.ticket.create({
      data: {
        ...data,
        source: 'INTERNAL',
        assignees: assigneeIds?.length
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, initials: true } } },
        },
      },
    });
  }),

  update: protectedProcedure.input(updateTicketSchema).mutation(async ({ ctx, input }) => {
    const { ticketId, ...data } = input;

    const ticket = await ctx.prisma.ticket.findFirst({
      where: { id: ticketId, team: { orgId: ctx.user.orgId } },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, initials: true } } },
        },
      },
    });
  }),

  delete: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.prisma.ticket.findFirst({
        where: { id: input.ticketId, team: { orgId: ctx.user.orgId } },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ticket.source === 'JIRA') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete Jira-sourced tickets',
        });
      }

      await ctx.prisma.ticketAssignment.deleteMany({ where: { ticketId: input.ticketId } });
      return ctx.prisma.ticket.delete({ where: { id: input.ticketId } });
    }),

  assign: protectedProcedure.input(assignTicketSchema).mutation(async ({ ctx, input }) => {
    if (input.action === 'assign') {
      return ctx.prisma.ticketAssignment.create({
        data: { ticketId: input.ticketId, userId: input.userId },
      });
    } else {
      return ctx.prisma.ticketAssignment.delete({
        where: { ticketId_userId: { ticketId: input.ticketId, userId: input.userId } },
      });
    }
  }),

  syncJira: leadProcedure
    .input(z.object({ teamId: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      // Import dynamically to avoid circular deps
      const { syncJiraTickets } = await import('../services/jira.sync');
      await syncJiraTickets(ctx.user.orgId);
      return { success: true };
    }),
});
