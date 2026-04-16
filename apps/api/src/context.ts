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
      user = decoded;
    } catch {
      // Token invalid or expired — user stays null
    }
  }

  return { req, res, prisma, user };
}
