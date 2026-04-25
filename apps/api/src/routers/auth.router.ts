import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { loginSchema } from '@flowdruid/shared';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import type { UserPayload } from '../context';
import {
  MAX_LOGIN_ATTEMPTS,
  getLockState,
  recordFailure,
  resetFailures,
} from '../lib/login-lock';

function lockoutMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

// Builds the "Invalid credentials. N attempts remaining." message.
// `count` is the post-increment failure count from recordFailure;
// if Redis was unreachable it comes back as 0 — in that case we
// quietly drop the counter rather than show a misleading number.
function invalidCredentialsMessage(count: number): string {
  if (count <= 0) return 'Invalid credentials';
  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - count);
  return `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export const authRouter = router({
  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const lock = await getLockState(input.email);
    if (lock.locked) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: lockoutMessage(lock.retryAfterSec),
      });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { email: input.email },
      include: { org: { select: { deletedAt: true } } },
    });

    const eligible = !!user && user.active && !user.org.deletedAt;
    const valid = eligible && (await bcrypt.compare(input.password, user.passwordHash));

    if (!valid) {
      // Record uniformly so unknown emails, deactivated users, and
      // wrong passwords all surface the same counter — otherwise the
      // presence/absence of "N attempts remaining" leaks which emails
      // exist.
      const failure = await recordFailure(input.email);
      if (failure.lockedNow) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: lockoutMessage(failure.retryAfterSec),
        });
      }
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: invalidCredentialsMessage(failure.count),
      });
    }

    await resetFailures(input.email);

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      teamId: user.teamId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await ctx.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    ctx.res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { accessToken, user: payload };
  }),

  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.refreshToken;
    if (!token) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No refresh token' });
    }

    const stored = await ctx.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { org: { select: { deletedAt: true } } } } },
    });

    if (
      !stored ||
      stored.expiresAt < new Date() ||
      !stored.user.active ||
      stored.user.org.deletedAt
    ) {
      if (stored) await ctx.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' });
    }

    // Rotate refresh token
    await ctx.prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = stored.user;
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      teamId: user.teamId,
    };

    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await ctx.prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: user.id, expiresAt },
    });

    ctx.res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { accessToken, user: payload };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.refreshToken;
    if (token) {
      await ctx.prisma.refreshToken.deleteMany({ where: { token } });
    }
    ctx.res.clearCookie('refreshToken', { path: '/' });
    return { success: true };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    // Fetch fresh from DB so mutable fields (availability, name, etc.) stay in sync,
    // not just whatever was in the JWT at login time.
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        role: true,
        orgId: true,
        teamId: true,
        availability: true,
      },
    });
    if (!user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
    }
    return user;
  }),
});
