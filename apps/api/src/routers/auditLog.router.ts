import { z } from 'zod';
import { router, adminProcedure } from '../trpc';

const AUDIT_ACTIONS = [
  'USER_ROLE_CHANGED',
  'USER_DEACTIVATED',
  'USER_CREATED',
  'LEAVE_APPROVED',
  'LEAVE_DENIED',
  'LEAVE_DELETED',
  'TICKET_DELETED',
  'TICKET_REASSIGNED',
  'QA_ENV_CREATED',
  'QA_ENV_DELETED',
  'QA_BOOKING_DELETED',
  'TEAM_CREATED',
  'TEAM_DELETED',
  'PARKING_SPOT_CREATED',
  'PARKING_SPOT_DELETED',
  'PROD_SUPPORT_DELETED',
  'SLACK_CONFIG_UPDATED',
  'JIRA_CONFIG_UPDATED',
  'BROADCAST_SENT',
] as const;

export const auditLogRouter = router({
  /**
   * Paginated audit-log reader for the /admin/audit page. Filters are
   * all optional; the default call returns the 50 most recent entries
   * across the caller's org.
   */
  list: adminProcedure
    .input(
      z.object({
        actorId: z.string().optional(),
        entityType: z.string().optional(),
        action: z.enum(AUDIT_ACTIONS).optional(),
        from: z.string().datetime().optional(), // ISO
        to: z.string().datetime().optional(),
        cursor: z.string().optional(), // AuditLog.id for keyset pagination
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { orgId: ctx.user.orgId };
      if (input.actorId) where.actorId = input.actorId;
      if (input.entityType) where.entityType = input.entityType;
      if (input.action) where.action = input.action;
      if (input.from || input.to) {
        where.createdAt = {
          ...(input.from ? { gte: new Date(input.from) } : {}),
          ...(input.to ? { lte: new Date(input.to) } : {}),
        };
      }

      const rows = await ctx.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, initials: true } } },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      };
    }),

  /**
   * Distinct entity types present in the current org — used to
   * populate the filter dropdown on the viewer page.
   */
  entityTypes: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.auditLog.findMany({
      where: { orgId: ctx.user.orgId },
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });
    return rows.map((r) => r.entityType);
  }),
});
