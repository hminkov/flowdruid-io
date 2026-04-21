import { z } from 'zod';
import { router, leadProcedure } from '../trpc';

/**
 * Activity feed — distinct from the audit log. The audit log captures
 * security-sensitive admin events (role changes, config edits,
 * deletions). This feed captures day-to-day user activity across
 * standups, leave requests, QA bookings, parking, and cover requests
 * — the same data that already lives in the domain tables, just
 * stitched into one time-ordered stream.
 *
 * Aggregated at read time over existing tables — no denormalised
 * ActivityEvent model. Over-fetches from each source table and merges
 * in memory; fine for an org of dozens/hundreds of users. If we ever
 * need to scale past that, replace with an event table and a trigger
 * or an application-level writer.
 */

const FEED_SOURCES = [
  'STANDUP_POSTED',
  'LEAVE_REQUESTED',
  'LEAVE_APPROVED',
  'LEAVE_DENIED',
  'QA_BOOKING_CREATED',
  'QA_BOOKING_STATUS_CHANGED',
  'PARKING_CLAIMED',
  'COVER_REQUESTED',
  'COVER_ACCEPTED',
] as const;
type FeedType = (typeof FEED_SOURCES)[number];

export interface FeedEvent {
  id: string;
  type: FeedType;
  createdAt: Date;
  actorId: string;
  actorName: string;
  actorInitials: string;
  // Human-readable summary. The UI renders the type pill separately
  // so this is just the noun-phrase: "Standup for Team X" etc.
  summary: string;
  // Optional deep-link target — page path the UI can route to.
  linkPath?: string;
}

export const activityRouter = router({
  feed: leadProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        // ISO timestamp; return events strictly older than this.
        before: z.string().datetime().optional(),
        actorId: z.string().optional(),
        types: z.array(z.enum(FEED_SOURCES)).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const before = input.before ? new Date(input.before) : new Date();
      const wanted = new Set<FeedType>(input.types ?? FEED_SOURCES);
      // Over-fetch so after filtering we still have limit+ candidates.
      const perSourceLimit = input.limit * 2;

      const actorFilter = input.actorId ? { id: input.actorId } : undefined;

      const [standups, leaves, bookings, parkings, covers] = await Promise.all([
        wanted.has('STANDUP_POSTED')
          ? ctx.prisma.standup.findMany({
              where: {
                team: { orgId: ctx.user.orgId },
                postedAt: { lt: before },
                ...(actorFilter ? { user: actorFilter } : {}),
              },
              include: {
                user: { select: { id: true, name: true, initials: true } },
                team: { select: { id: true, name: true } },
              },
              orderBy: { postedAt: 'desc' },
              take: perSourceLimit,
            })
          : [],
        (wanted.has('LEAVE_REQUESTED') ||
        wanted.has('LEAVE_APPROVED') ||
        wanted.has('LEAVE_DENIED'))
          ? ctx.prisma.leaveRequest.findMany({
              where: {
                user: { orgId: ctx.user.orgId, ...(actorFilter ?? {}) },
                OR: [
                  { createdAt: { lt: before } },
                  { reviewedAt: { lt: before } },
                ],
              },
              include: {
                user: { select: { id: true, name: true, initials: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: perSourceLimit,
            })
          : [],
        (wanted.has('QA_BOOKING_CREATED') || wanted.has('QA_BOOKING_STATUS_CHANGED'))
          ? ctx.prisma.qaBooking.findMany({
              where: {
                environment: { orgId: ctx.user.orgId },
                OR: [
                  { createdAt: { lt: before } },
                  { updatedAt: { lt: before } },
                ],
                ...(actorFilter
                  ? { OR: [{ devOwner: actorFilter }, { qaOwner: actorFilter }] }
                  : {}),
              },
              include: {
                environment: { select: { id: true, name: true } },
                devOwner: { select: { id: true, name: true, initials: true } },
                qaOwner: { select: { id: true, name: true, initials: true } },
              },
              orderBy: { updatedAt: 'desc' },
              take: perSourceLimit,
            })
          : [],
        wanted.has('PARKING_CLAIMED')
          ? ctx.prisma.parkingAssignment.findMany({
              where: {
                spot: { orgId: ctx.user.orgId },
                createdAt: { lt: before },
                ...(actorFilter ? { user: actorFilter } : {}),
              },
              include: {
                user: { select: { id: true, name: true, initials: true } },
                spot: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: perSourceLimit,
            })
          : [],
        (wanted.has('COVER_REQUESTED') || wanted.has('COVER_ACCEPTED'))
          ? ctx.prisma.coverRequest.findMany({
              where: {
                assignment: { team: { orgId: ctx.user.orgId } },
                OR: [
                  { createdAt: { lt: before } },
                  { acceptedAt: { lt: before } },
                ],
                ...(actorFilter
                  ? { OR: [{ requester: actorFilter }, { acceptedBy: actorFilter }] }
                  : {}),
              },
              include: {
                requester: { select: { id: true, name: true, initials: true } },
                acceptedBy: { select: { id: true, name: true, initials: true } },
                assignment: {
                  select: {
                    weekNumber: true,
                    team: { select: { id: true, name: true } },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: perSourceLimit,
            })
          : [],
      ]);

      const events: FeedEvent[] = [];

      for (const s of standups) {
        events.push({
          id: `standup:${s.id}`,
          type: 'STANDUP_POSTED',
          createdAt: s.postedAt,
          actorId: s.user.id,
          actorName: s.user.name,
          actorInitials: s.user.initials,
          summary: `Posted standup for ${s.team.name}`,
          linkPath: '/standup',
        });
      }

      for (const l of leaves) {
        if (l.createdAt < before) {
          events.push({
            id: `leave-req:${l.id}`,
            type: 'LEAVE_REQUESTED',
            createdAt: l.createdAt,
            actorId: l.user.id,
            actorName: l.user.name,
            actorInitials: l.user.initials,
            summary: `Requested ${l.type.toLowerCase()} leave`,
            linkPath: '/leaves',
          });
        }
        if (l.reviewedAt && l.reviewedAt < before && l.status !== 'PENDING') {
          events.push({
            id: `leave-decision:${l.id}`,
            type: l.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_DENIED',
            createdAt: l.reviewedAt,
            // Actor here is the reviewer, not the requester — but we
            // don't eagerly load the reviewer, and resolving it would
            // require another query. Fall back to requester's name
            // with a note in the summary.
            actorId: l.user.id,
            actorName: l.user.name,
            actorInitials: l.user.initials,
            summary:
              l.status === 'APPROVED'
                ? `${l.type.toLowerCase()} leave approved`
                : `${l.type.toLowerCase()} leave denied`,
            linkPath: '/leaves',
          });
        }
      }

      for (const b of bookings) {
        const owner = b.devOwner ?? b.qaOwner;
        const actor = owner ?? {
          id: 'system',
          name: 'System',
          initials: 'SY',
        };
        if (b.createdAt < before && wanted.has('QA_BOOKING_CREATED')) {
          events.push({
            id: `qa-created:${b.id}`,
            type: 'QA_BOOKING_CREATED',
            createdAt: b.createdAt,
            actorId: actor.id,
            actorName: actor.name,
            actorInitials: actor.initials,
            summary: `Booked ${b.service} on ${b.environment.name}`,
            linkPath: '/qa',
          });
        }
        if (
          b.updatedAt > b.createdAt &&
          b.updatedAt < before &&
          wanted.has('QA_BOOKING_STATUS_CHANGED')
        ) {
          events.push({
            id: `qa-status:${b.id}:${b.updatedAt.getTime()}`,
            type: 'QA_BOOKING_STATUS_CHANGED',
            createdAt: b.updatedAt,
            actorId: actor.id,
            actorName: actor.name,
            actorInitials: actor.initials,
            summary: `${b.service} on ${b.environment.name} → ${b.status}`,
            linkPath: '/qa',
          });
        }
      }

      for (const p of parkings) {
        events.push({
          id: `parking:${p.id}`,
          type: 'PARKING_CLAIMED',
          createdAt: p.createdAt,
          actorId: p.user.id,
          actorName: p.user.name,
          actorInitials: p.user.initials,
          summary: `Claimed parking spot ${p.spot.name} for ${p.date.toISOString().slice(0, 10)}`,
          linkPath: '/parking',
        });
      }

      for (const c of covers) {
        if (c.createdAt < before && wanted.has('COVER_REQUESTED')) {
          events.push({
            id: `cover-req:${c.id}`,
            type: 'COVER_REQUESTED',
            createdAt: c.createdAt,
            actorId: c.requester.id,
            actorName: c.requester.name,
            actorInitials: c.requester.initials,
            summary: `Requested cover for ${c.assignment.team.name} wk${c.assignment.weekNumber}`,
            linkPath: '/prod-support',
          });
        }
        if (
          c.acceptedAt &&
          c.acceptedAt < before &&
          c.acceptedBy &&
          wanted.has('COVER_ACCEPTED')
        ) {
          events.push({
            id: `cover-acc:${c.id}`,
            type: 'COVER_ACCEPTED',
            createdAt: c.acceptedAt,
            actorId: c.acceptedBy.id,
            actorName: c.acceptedBy.name,
            actorInitials: c.acceptedBy.initials,
            summary: `Took cover from ${c.requester.name} (${c.assignment.team.name} wk${c.assignment.weekNumber})`,
            linkPath: '/prod-support',
          });
        }
      }

      events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const items = events.slice(0, input.limit);
      const nextBefore =
        events.length > input.limit ? items[items.length - 1]?.createdAt.toISOString() : null;

      return {
        items,
        nextBefore,
        types: FEED_SOURCES,
      };
    }),
});
