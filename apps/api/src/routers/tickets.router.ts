import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTicketSchema, updateTicketSchema, listTicketsSchema, assignTicketSchema } from '@flowdruid/shared';
import { router, protectedProcedure, leadProcedure } from '../trpc';
import { audit } from '../lib/audit';
import { slackQueue } from '../lib/queue';

export const ticketsRouter = router({
  list: protectedProcedure.input(listTicketsSchema).query(async ({ ctx, input }) => {
    // Scope to org teams — always applied first so cross-org data
    // can't leak via other filters.
    const baseWhere: Record<string, unknown> = { team: { orgId: ctx.user.orgId } };
    if (input.teamId) baseWhere.teamId = input.teamId;
    if (input.source) baseWhere.source = input.source;
    if (input.assigneeId) {
      baseWhere.assignees = { some: { userId: input.assigneeId } };
    }

    // Per-column caps. A freshly-synced Jira project can drop 10k+
    // rows on the kanban; rendering that many cards in dnd-kit
    // locks up the browser. Each column returns its top-N most
    // recently updated tickets; older ones stay in the DB and are
    // reachable via search + direct links.
    const OPEN_STATUSES = [
      'TODO',
      'BLOCKED',
      'IN_PROGRESS',
      'IN_REVIEW',
      'READY_FOR_VERIFICATION',
    ] as const;
    const PER_OPEN = 100;
    const PER_DONE = 50;

    const include = {
      assignees: {
        include: { user: { select: { id: true, name: true, initials: true } } },
      },
      team: { select: { id: true, name: true } },
    } as const;

    // Status-scoped list: caller asked for a single column's worth.
    // When the client passes an explicit `limit` it's opting out of
    // the default cap (e.g. user clicked 'See older work items').
    if (input.status) {
      const take = input.limit ?? (input.status === 'DONE' ? PER_DONE : PER_OPEN);
      return ctx.prisma.ticket.findMany({
        where: { ...baseWhere, status: input.status },
        include,
        orderBy: { updatedAt: 'desc' },
        take,
      });
    }

    // Unscoped list: run one query per column and concat. Each
    // column is independently capped so a TODO backlog of 1k
    // doesn't starve the smaller columns of their slots.
    const perStatus = await Promise.all(
      OPEN_STATUSES.map((status) =>
        ctx.prisma.ticket.findMany({
          where: { ...baseWhere, status },
          include,
          orderBy: { updatedAt: 'desc' },
          take: PER_OPEN,
        }),
      ),
    );
    const done = await ctx.prisma.ticket.findMany({
      where: { ...baseWhere, status: 'DONE' },
      include,
      orderBy: { updatedAt: 'desc' },
      take: PER_DONE,
    });
    return [...perStatus.flat(), ...done];
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

    const updated = await ctx.prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, initials: true } } },
        },
      },
    });

    // Slack ping when a ticket transitions INTO Done. Only fire on the
    // transition, not on repeat saves while already Done, and only when
    // the org has ticket-done notifications enabled.
    if (data.status === 'DONE' && ticket.status !== 'DONE') {
      const slackConfig = await ctx.prisma.slackConfig.findUnique({
        where: { orgId: ctx.user.orgId },
        select: { notifyDone: true },
      });
      if (slackConfig?.notifyDone) {
        await slackQueue.add('ticket.done', {
          type: 'ticket.done',
          orgId: ctx.user.orgId,
          teamId: ticket.teamId,
          userId: ctx.user.id,
          userName: ctx.user.name,
          ticketKey: ticket.jiraKey ?? ticket.id.slice(-8),
          ticketTitle: updated.title,
        });
      }
    }

    return updated;
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

      return ctx.prisma.$transaction(async (tx) => {
        await tx.ticketAssignment.deleteMany({ where: { ticketId: input.ticketId } });
        const deleted = await tx.ticket.delete({ where: { id: input.ticketId } });
        await audit({ prisma: tx, user: ctx.user }, 'TICKET_DELETED', 'Ticket', input.ticketId, {
          before: { title: ticket.title, status: ticket.status, priority: ticket.priority, teamId: ticket.teamId, source: ticket.source, jiraKey: ticket.jiraKey },
        });
        return deleted;
      });
    }),

  assign: protectedProcedure.input(assignTicketSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      let result;
      if (input.action === 'assign') {
        result = await tx.ticketAssignment.create({
          data: { ticketId: input.ticketId, userId: input.userId },
        });
      } else {
        result = await tx.ticketAssignment.delete({
          where: { ticketId_userId: { ticketId: input.ticketId, userId: input.userId } },
        });
      }
      await audit({ prisma: tx, user: ctx.user }, 'TICKET_REASSIGNED', 'Ticket', input.ticketId, {
        after: { action: input.action, userId: input.userId },
      });
      return result;
    });
  }),

  syncJira: leadProcedure
    .input(z.object({ teamId: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      // Import dynamically to avoid circular deps
      const { syncJiraTickets } = await import('../services/jira.sync');
      const report = await syncJiraTickets(ctx.user.orgId);
      return { success: report.ok, ...report };
    }),
});
