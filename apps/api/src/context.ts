import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma';
import type { Role } from '@prisma/client';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  teamId: string | null;
}

export interface Context {
  req: Request;
  res: Response;
  prisma: typeof prisma;
  user: UserPayload | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  let user: UserPayload | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
      // Reject tokens for soft-deleted orgs. JWTs outlive DB state, so a
      // still-valid access token minted before an org was deleted would
      // otherwise keep working for the full 15-min access-token window.
      const org = await prisma.organisation.findUnique({
        where: { id: decoded.orgId },
        select: { deletedAt: true },
      });
      if (org && !org.deletedAt) {
        user = decoded;
      }
    } catch {
      // Token invalid or expired — user stays null
    }
  }

  return { req, res, prisma, user };
}
