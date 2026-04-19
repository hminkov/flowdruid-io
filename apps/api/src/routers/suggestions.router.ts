import { TRPCError } from '@trpc/server';
import { createSuggestionSchema, listSuggestionsSchema } from '@flowdruid/shared';
import { router, protectedProcedure } from '../trpc';

export const suggestionsRouter = router({
  list: protectedProcedure.input(listSuggestionsSchema).query(async ({ ctx, input }) => {
    // Ensure the ticket belongs to the caller's org
    const ticket = await ctx.prisma.ticket.findFirst({
      where: { id: input.ticketId, team: { orgId: ctx.user.orgId } },
      select: { id: true },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.assignmentSuggestion.findMany({
      where: { ticketId: input.ticketId },
      include: {
        suggestedUser: { select: { id: true, name: true, initials: true } },
        requester: { select: { id: true, name: true, initials: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  create: protectedProcedure.input(createSuggestionSchema).mutation(async ({ ctx, input }) => {
    // Org scoping for the ticket
    const ticket = await ctx.prisma.ticket.findFirst({
      where: { id: input.ticketId, team: { orgId: ctx.user.orgId } },
      select: { id: true },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });

    // The suggested user must be in the same org
    const target = await ctx.prisma.user.findFirst({
      where: { id: input.suggestedUserId, orgId: ctx.user.orgId },
      select: { id: true },
    });
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggested user not found' });
    }

    // Prevent a duplicate suggestion from the same requester for the same target
    const existing = await ctx.prisma.assignmentSuggestion.findFirst({
      where: {
        ticketId: input.ticketId,
        suggestedUserId: input.suggestedUserId,
        requestedBy: ctx.user.id,
      },
      select: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'You already suggested this person for this ticket',
      });
    }

    return ctx.prisma.assignmentSuggestion.create({
      data: {
        ticketId: input.ticketId,
        suggestedUserId: input.suggestedUserId,
        requestedBy: ctx.user.id,
        reason: input.reason,
      },
      include: {
        suggestedUser: { select: { id: true, name: true, initials: true } },
        requester: { select: { id: true, name: true, initials: true } },
      },
    });
  }),
});
