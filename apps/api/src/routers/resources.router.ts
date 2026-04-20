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
  autoScheduleMonthSchema,
  requestCoverSchema,
  acceptCoverSchema,
  cancelCoverSchema,
  listCoverRequestsSchema,
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

  // Generate N consecutive weekly pairs for a team. Team leads may only
  // auto-schedule their own team; admins can pick any team in the org.
  autoScheduleMonth: leadProcedure
    .input(autoScheduleMonthSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === 'TEAM_LEAD' && ctx.user.teamId !== input.teamId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Team leads can only schedule their own team',
        });
      }

      const team = await ctx.prisma.team.findFirst({
        where: { id: input.teamId, orgId: ctx.user.orgId },
        include: { members: { where: { active: true }, select: { id: true } } },
      });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND' });
      if (team.members.length < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Team needs at least two members to generate a rota',
        });
      }

      const startMonday = toUtcDate(input.startDate);
      const shuffled = [...team.members].sort(() => Math.random() - 0.5);

      const results = [];
      const usedThisMonth = new Set<string>();
      for (let i = 0; i < input.weeks; i++) {
        const start = new Date(startMonday);
        start.setUTCDate(start.getUTCDate() + i * 7);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 4);

        // Prefer people we haven't scheduled yet this run; once everyone's used, start over.
        let pool = team.members.filter((m) => !usedThisMonth.has(m.id));
        if (pool.length < 2) {
          usedThisMonth.clear();
          pool = [...team.members];
        }
        pool = pool.sort(() => Math.random() - 0.5);
        const primary = pool[0]!;
        const secondary = pool[1]!;
        usedThisMonth.add(primary.id);
        usedThisMonth.add(secondary.id);

        // Respect overwrite=false by skipping weeks that already have an assignment
        if (!input.overwrite) {
          const existing = await ctx.prisma.prodSupportAssignment.findUnique({
            where: { teamId_startDate: { teamId: input.teamId, startDate: start } },
            select: { id: true },
          });
          if (existing) continue;
        }

        const week = isoWeekNumber(start);
        const saved = await ctx.prisma.prodSupportAssignment.upsert({
          where: { teamId_startDate: { teamId: input.teamId, startDate: start } },
          update: {
            endDate: end,
            weekNumber: week,
            primaryId: primary.id,
            secondaryId: secondary.id,
          },
          create: {
            teamId: input.teamId,
            startDate: start,
            endDate: end,
            weekNumber: week,
            primaryId: primary.id,
            secondaryId: secondary.id,
          },
        });
        results.push(saved);
      }
      // Use of shuffled avoids warning
      void shuffled;
      return { created: results.length };
    }),

  // Dev on call requests cover. Fans out a notification to every other team member.
  requestCover: protectedProcedure
    .input(requestCoverSchema)
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.prodSupportAssignment.findFirst({
        where: { id: input.assignmentId, team: { orgId: ctx.user.orgId } },
        include: {
          team: { select: { id: true, name: true, members: { where: { active: true }, select: { id: true } } } },
          primary: { select: { id: true, name: true } },
          secondary: { select: { id: true, name: true } },
        },
      });
      if (!assignment) throw new TRPCError({ code: 'NOT_FOUND' });

      if (assignment.primaryId !== ctx.user.id && assignment.secondaryId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the primary or secondary can request cover for this shift',
        });
      }

      // Don't let the same requester open two overlapping OPEN requests for the same shift
      const existingOpen = await ctx.prisma.coverRequest.findFirst({
        where: {
          assignmentId: assignment.id,
          requesterId: ctx.user.id,
          status: 'OPEN',
        },
      });
      if (existingOpen) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have an open cover request for this shift',
        });
      }

      const request = await ctx.prisma.coverRequest.create({
        data: {
          assignmentId: assignment.id,
          requesterId: ctx.user.id,
          reason: input.reason,
        },
        include: {
          requester: { select: { id: true, name: true, initials: true } },
          assignment: {
            include: {
              team: { select: { id: true, name: true } },
              primary: { select: { id: true, name: true, initials: true } },
              secondary: { select: { id: true, name: true, initials: true } },
            },
          },
        },
      });

      // Also post in the team's Slack channel (placeholder — Slack wiring later).
      // For now, drop a message into the team conversation so users see it there too.
      const conv = await ctx.prisma.conversation.findFirst({
        where: { orgId: ctx.user.orgId, kind: 'TEAM_CHANNEL', teamId: assignment.teamId },
        select: { id: true },
      });
      if (conv) {
        const rangeLabel = formatShortRange(assignment.startDate, assignment.endDate);
        const reasonSuffix = input.reason ? ` — ${input.reason}` : '';
        await ctx.prisma.message.create({
          data: {
            conversationId: conv.id,
            authorId: ctx.user.id,
            body: `🔁 I'm looking for cover on the prod-support shift (${rangeLabel}). Can anyone swap in?${reasonSuffix}`,
          },
        });
      }

      // Notify every other active team member
      const others = assignment.team.members.filter((m) => m.id !== ctx.user.id);
      if (others.length > 0) {
        await ctx.prisma.notification.createMany({
          data: others.map((m) => ({
            userId: m.id,
            type: 'PROD_SUPPORT_ON_CALL' as const,
            title: `${request.requester.name} is looking for cover`,
            body: input.reason
              ? `${request.assignment.team.name} — week ${assignment.weekNumber}: ${input.reason}`
              : `${request.assignment.team.name} — week ${assignment.weekNumber}. Tap to offer help.`,
            linkPath: '/prod-support',
            actorId: ctx.user.id,
            entityId: request.id,
          })),
        });
      }

      return request;
    }),

  acceptCover: protectedProcedure
    .input(acceptCoverSchema)
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.prisma.coverRequest.findFirst({
        where: { id: input.coverRequestId, status: 'OPEN' },
        include: {
          assignment: {
            include: {
              team: { select: { id: true, orgId: true } },
            },
          },
          requester: { select: { id: true, name: true } },
        },
      });
      if (!req) throw new TRPCError({ code: 'NOT_FOUND' });
      if (req.assignment.team.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (ctx.user.id === req.requesterId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't accept your own cover request — cancel it instead.",
        });
      }

      // User must be on the same team to accept (stops strangers taking shifts)
      const onSameTeam = ctx.user.teamId === req.assignment.teamId;
      if (!onSameTeam && ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teammates can accept a cover request',
        });
      }

      // Swap the requester out of the shift and put the acceptor in
      const isPrimary = req.assignment.primaryId === req.requesterId;
      const patch = isPrimary
        ? { primaryId: ctx.user.id }
        : { secondaryId: ctx.user.id };

      await ctx.prisma.$transaction([
        ctx.prisma.prodSupportAssignment.update({
          where: { id: req.assignmentId },
          data: patch,
        }),
        ctx.prisma.coverRequest.update({
          where: { id: req.id },
          data: {
            status: 'ACCEPTED',
            acceptedById: ctx.user.id,
            acceptedAt: new Date(),
          },
        }),
      ]);

      // Notify the requester that someone took the shift
      await ctx.prisma.notification.create({
        data: {
          userId: req.requesterId,
          type: 'PROD_SUPPORT_ON_CALL',
          title: `${ctx.user.name} took your cover request`,
          body: `You're off the prod-support rota for this shift.`,
          linkPath: '/prod-support',
          actorId: ctx.user.id,
          entityId: req.id,
        },
      });

      return { ok: true };
    }),

  cancelCover: protectedProcedure
    .input(cancelCoverSchema)
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.prisma.coverRequest.findFirst({
        where: {
          id: input.coverRequestId,
          status: 'OPEN',
          requesterId: ctx.user.id,
        },
      });
      if (!req) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.prisma.coverRequest.update({
        where: { id: req.id },
        data: { status: 'CANCELLED' },
      });
      return { ok: true };
    }),

  listCoverRequests: protectedProcedure
    .input(listCoverRequestsSchema)
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        assignment: { team: { orgId: ctx.user.orgId } },
      };
      if (input.openOnly) where.status = 'OPEN';
      if (input.teamId) {
        (where.assignment as Record<string, unknown>) = {
          teamId: input.teamId,
          team: { orgId: ctx.user.orgId },
        };
      }

      return ctx.prisma.coverRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, initials: true } },
          acceptedBy: { select: { id: true, name: true, initials: true } },
          assignment: {
            include: {
              team: { select: { id: true, name: true } },
              primary: { select: { id: true, name: true, initials: true } },
              secondary: { select: { id: true, name: true, initials: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
});

function formatShortRange(start: Date, end: Date) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`;
  return `${fmt(s)} — ${fmt(e)}`;
}

function isoWeekNumber(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstThuDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDayNum + 3);
  return 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
}
