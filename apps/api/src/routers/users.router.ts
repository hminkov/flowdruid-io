import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { inviteUserSchema, updateUserSchema, updateAvailabilitySchema } from '@flowdruid/shared';
import { router, protectedProcedure, adminProcedure, leadProcedure } from '../trpc';

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

    const user = await ctx.prisma.user.create({
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

    return { userId: user.id, tempPassword };
  }),

  update: adminProcedure.input(updateUserSchema).mutation(async ({ ctx, input }) => {
    const { userId, ...data } = input;
    return ctx.prisma.user.update({
      where: { id: userId, orgId: ctx.user.orgId },
      data,
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

  deactivate: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId, orgId: ctx.user.orgId },
        data: { active: false },
      });
    }),
});
