import { z } from 'zod';
import { createTeamSchema, updateTeamSchema } from '@flowdruid/shared';
import { router, protectedProcedure, adminProcedure } from '../trpc';

export const teamsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.team.findMany({
      where: { orgId: ctx.user.orgId },
      include: {
        members: {
          where: { active: true },
          select: { id: true, name: true, initials: true, availability: true, role: true },
        },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }),

  create: adminProcedure.input(createTeamSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.team.create({
      data: {
        name: input.name,
        orgId: ctx.user.orgId,
        slackChannelId: input.slackChannelId,
      },
    });
  }),

  update: adminProcedure.input(updateTeamSchema).mutation(async ({ ctx, input }) => {
    const { teamId, ...data } = input;
    return ctx.prisma.team.update({
      where: { id: teamId, orgId: ctx.user.orgId },
      data,
    });
  }),

  delete: adminProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.team.delete({
        where: { id: input.teamId, orgId: ctx.user.orgId },
      });
    }),
});
