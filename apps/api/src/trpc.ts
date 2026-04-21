import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';
import { hit as rateLimitHit } from './lib/rate-limit';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Per-org write-side rate limit. A noisy tenant (runaway script, stuck
// client in a retry loop, compromised token) shouldn't burn shared
// capacity or the DB's write throughput for everyone else. Read queries
// stay unthrottled — they're cheap and the pain of being rate-limited
// on a dashboard refresh is worse than the protection is worth.
const PER_ORG_MUTATION_LIMIT = Number(process.env.RATE_LIMIT_ORG_MUTATIONS_PER_MIN ?? 300);
const perOrgMutationLimit = t.middleware(async ({ ctx, next, type }) => {
  if (type === 'mutation' && ctx.user) {
    const result = await rateLimitHit(ctx.user.orgId, {
      scope: 'org-mutation',
      limit: PER_ORG_MUTATION_LIMIT,
      windowSec: 60,
    });
    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Org exceeded ${PER_ORG_MUTATION_LIMIT} mutations/minute — retry in ${result.retryAfterSec}s`,
      });
    }
  }
  return next();
});

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isLead = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (ctx.user.role !== 'ADMIN' && ctx.user.role !== 'TEAM_LEAD') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires TEAM_LEAD or ADMIN role' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires ADMIN role' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(isAuthed).use(perOrgMutationLimit);
export const leadProcedure = t.procedure.use(isLead).use(perOrgMutationLimit);
export const adminProcedure = t.procedure.use(isAdmin).use(perOrgMutationLimit);
