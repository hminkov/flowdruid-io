import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTeamSchema, updateTeamSchema } from '@flowdruid/shared';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { audit } from '../lib/audit';

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
    return ctx.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: input.name,
          orgId: ctx.user.orgId,
          slackChannelId: input.slackChannelId,
        },
      });
      await audit({ prisma: tx, user: ctx.user }, 'TEAM_CREATED', 'Team', team.id, {
        after: { name: team.name, slackChannelId: team.slackChannelId },
      });
      return team;
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
      return ctx.prisma.$transaction(async (tx) => {
        const before = await tx.team.findUnique({
          where: { id: input.teamId, orgId: ctx.user.orgId },
          select: { id: true, name: true, slackChannelId: true },
        });
        if (!before) throw new TRPCError({ code: 'NOT_FOUND' });
        const deleted = await tx.team.delete({
          where: { id: input.teamId, orgId: ctx.user.orgId },
        });
        await audit({ prisma: tx, user: ctx.user }, 'TEAM_DELETED', 'Team', input.teamId, {
          before: { name: before.name, slackChannelId: before.slackChannelId },
        });
        return deleted;
      });
    }),
});
