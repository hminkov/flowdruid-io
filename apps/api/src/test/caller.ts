import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { appRouter } from '../routers';
import type { Context } from '../context';
import { testPrisma } from './setup';

/**
 * Minimal Express req/res stubs with just enough shape for any router
 * to run without crashing — including `res.cookie` (used by the auth
 * router to set the refresh-token cookie).
 */
function mockReqRes(): { req: Request; res: Response } {
  const headers: Record<string, string> = {};
  const res = {
    cookie: () => res,
    clearCookie: () => res,
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
      return res;
    },
    getHeader: (k: string) => headers[k.toLowerCase()],
    status: () => res,
    json: () => res,
    send: () => res,
    end: () => res,
  } as unknown as Response;
  const req = { headers: {}, cookies: {} } as unknown as Request;
  return { req, res };
}

/**
 * Build a tRPC caller bound to a specific user (or unauthenticated).
 *
 * Tests can then invoke procedures directly:
 *   const caller = asUser(admin);
 *   await caller.users.update({ userId, role: 'ADMIN' });
 *
 * This skips the HTTP layer entirely — faster than SuperTest, and
 * still exercises all the procedure-level authz middleware.
 */
export function asUser(user?: User) {
  const { req, res } = mockReqRes();
  const ctx: Context = {
    req,
    res,
    prisma: testPrisma,
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
          teamId: user.teamId,
        }
      : null,
  };
  return appRouter.createCaller(ctx);
}
