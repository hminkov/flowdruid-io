import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { loginSchema, changePasswordSchema } from '@flowdruid/shared';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import type { UserPayload } from '../context';
import {
  MAX_LOGIN_ATTEMPTS,
  getLockState,
  recordFailure,
  resetFailures,
} from '../lib/login-lock';
import { hit as rateLimitHit } from '../lib/rate-limit';

function lockoutMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

// Builds a TRPCError whose `cause` carries retryAfterSec so the
// errorFormatter can pass it through to the client for the countdown.
function lockoutError(retryAfterSec: number): TRPCError {
  return new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: lockoutMessage(retryAfterSec),
    cause: { retryAfterSec },
  });
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
      throw lockoutError(lock.retryAfterSec);
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
        throw lockoutError(failure.retryAfterSec);
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

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      // Per-user rate limit so a stolen access token can't be used to
      // brute-force the current password — the login lockout doesn't
      // apply here since the request is already authenticated.
      const limit = await rateLimitHit(ctx.user.id, {
        scope: 'change-password',
        limit: 5,
        windowSec: 600,
      });
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Too many password-change attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute${limit.retryAfterSec > 60 ? 's' : ''}.`,
          cause: { retryAfterSec: limit.retryAfterSec },
        });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true, email: true, passwordHash: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      // Reject reusing the same password — surfaces the mistake
      // instead of silently no-op'ing.
      const sameAsOld = await bcrypt.compare(input.newPassword, user.passwordHash);
      if (sameAsOld) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'New password must be different from the current one',
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 10);

      // Revoke every refresh token *except* the one this request rode
      // in on, so other browsers/devices get logged out but the user
      // stays signed in here. Then clear any failed-login counter so
      // a forgotten-password reset can't leave the account locked.
      const currentRefresh = ctx.req.cookies?.refreshToken;
      await ctx.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
        await tx.refreshToken.deleteMany({
          where: {
            userId: user.id,
            ...(currentRefresh ? { NOT: { token: currentRefresh } } : {}),
          },
        });
      });
      await resetFailures(user.email);

      return { success: true };
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
