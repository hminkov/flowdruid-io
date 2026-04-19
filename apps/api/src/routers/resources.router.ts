import { TRPCError } from '@trpc/server';
import {
  createQaBookingSchema,
  updateQaBookingSchema,
  deleteQaBookingSchema,
  listParkingSchema,
  claimParkingSchema,
  releaseParkingSchema,
  listProdSupportSchema,
  createProdSupportSchema,
  deleteProdSupportSchema,
} from '@flowdruid/shared';
import { router, protectedProcedure, leadProcedure } from '../trpc';

const toUtcDate = (iso: string): Date => {
  // Accepts YYYY-MM-DD or full ISO; returns midnight UTC for the date portion.
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const resourcesRouter = router({
  // ─── QA environments ───────────────────────────────────────────────────
  qaEnvironments: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.qaEnvironment.findMany({
      where: { orgId: ctx.user.orgId },
      include: {
        bookings: {
          include: {
            devOwner: { select: { id: true, name: true, initials: true } },
            qaOwner: { select: { id: true, name: true, initials: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }),

  createQaBooking: leadProcedure.input(createQaBookingSchema).mutation(async ({ ctx, input }) => {
    const env = await ctx.prisma.qaEnvironment.findFirst({
      where: { id: input.environmentId, orgId: ctx.user.orgId },
      select: { id: true },
    });
    if (!env) throw new TRPCError({ code: 'NOT_FOUND', message: 'Environment not found' });

    return ctx.prisma.qaBooking.create({
      data: { ...input },
      include: {
        devOwner: { select: { id: true, name: true, initials: true } },
        qaOwner: { select: { id: true, name: true, initials: true } },
      },
    });
  }),

  updateQaBooking: leadProcedure.input(updateQaBookingSchema).mutation(async ({ ctx, input }) => {
    const { bookingId, ...data } = input;
    const booking = await ctx.prisma.qaBooking.findFirst({
      where: { id: bookingId, environment: { orgId: ctx.user.orgId } },
      select: { id: true },
    });
    if (!booking) throw new TRPCError({ code: 'NOT_FOUND' });

    return ctx.prisma.qaBooking.update({
      where: { id: bookingId },
      data,
      include: {
        devOwner: { select: { id: true, name: true, initials: true } },
        qaOwner: { select: { id: true, name: true, initials: true } },
      },
    });
  }),

  deleteQaBooking: leadProcedure.input(deleteQaBookingSchema).mutation(async ({ ctx, input }) => {
    const booking = await ctx.prisma.qaBooking.findFirst({
      where: { id: input.bookingId, environment: { orgId: ctx.user.orgId } },
      select: { id: true },
    });
    if (!booking) throw new TRPCError({ code: 'NOT_FOUND' });

    await ctx.prisma.qaBooking.delete({ where: { id: input.bookingId } });
    return { ok: true };
  }),

  // ─── Parking ───────────────────────────────────────────────────────────
  parkingSpots: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.parkingSpot.findMany({
      where: { orgId: ctx.user.orgId },
      orderBy: { order: 'asc' },
    });
  }),

  parkingAssignments: protectedProcedure
    .input(listParkingSchema)
    .query(async ({ ctx, input }) => {
      const start = toUtcDate(input.startDate);
      const end = toUtcDate(input.endDate);

      return ctx.prisma.parkingAssignment.findMany({
        where: {
          spot: { orgId: ctx.user.orgId },
          date: { gte: start, lte: end },
        },
        include: {
          user: { select: { id: true, name: true, initials: true } },
          spot: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'asc' }, { spot: { order: 'asc' } }],
      });
    }),

  claimParking: protectedProcedure.input(claimParkingSchema).mutation(async ({ ctx, input }) => {
    const spot = await ctx.prisma.parkingSpot.findFirst({
      where: { id: input.spotId, orgId: ctx.user.orgId },
      select: { id: true },
    });
    if (!spot) throw new TRPCError({ code: 'NOT_FOUND' });

    const userId = input.userId ?? ctx.user.id;
    const date = toUtcDate(input.date);

    return ctx.prisma.parkingAssignment.upsert({
      where: { spotId_date: { spotId: input.spotId, date } },
      update: { userId },
      create: { spotId: input.spotId, userId, date },
      include: { user: { select: { id: true, name: true, initials: true } } },
    });
  }),

  releaseParking: protectedProcedure
    .input(releaseParkingSchema)
    .mutation(async ({ ctx, input }) => {
      const date = toUtcDate(input.date);
      const assignment = await ctx.prisma.parkingAssignment.findFirst({
        where: { spotId: input.spotId, date, spot: { orgId: ctx.user.orgId } },
      });
      if (assignment) {
        await ctx.prisma.parkingAssignment.delete({ where: { id: assignment.id } });
      }
      return { ok: true };
    }),

  // ─── Prod Support rota ─────────────────────────────────────────────────
  prodSupport: protectedProcedure.input(listProdSupportSchema).query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {
      team: { orgId: ctx.user.orgId },
    };
    if (input.teamId) where.teamId = input.teamId;
    if (input.year) {
      const start = new Date(Date.UTC(input.year, 0, 1));
      const end = new Date(Date.UTC(input.year + 1, 0, 1));
      where.startDate = { gte: start, lt: end };
    }

    return ctx.prisma.prodSupportAssignment.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        primary: { select: { id: true, name: true, initials: true } },
        secondary: { select: { id: true, name: true, initials: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }),

  createProdSupport: leadProcedure
    .input(createProdSupportSchema)
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findFirst({
        where: { id: input.teamId, orgId: ctx.user.orgId },
        select: { id: true },
      });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.prisma.prodSupportAssignment.upsert({
        where: {
          teamId_startDate: {
            teamId: input.teamId,
            startDate: toUtcDate(input.startDate),
          },
        },
        update: {
          endDate: toUtcDate(input.endDate),
          weekNumber: input.weekNumber,
          primaryId: input.primaryId,
          secondaryId: input.secondaryId,
        },
        create: {
          teamId: input.teamId,
          startDate: toUtcDate(input.startDate),
          endDate: toUtcDate(input.endDate),
          weekNumber: input.weekNumber,
          primaryId: input.primaryId,
          secondaryId: input.secondaryId,
        },
      });
    }),

  deleteProdSupport: leadProcedure
    .input(deleteProdSupportSchema)
    .mutation(async ({ ctx, input }) => {
      const a = await ctx.prisma.prodSupportAssignment.findFirst({
        where: { id: input.assignmentId, team: { orgId: ctx.user.orgId } },
        select: { id: true },
      });
      if (!a) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.prisma.prodSupportAssignment.delete({ where: { id: input.assignmentId } });
      return { ok: true };
    }),
});
