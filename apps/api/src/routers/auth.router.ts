import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@flowdruid/shared';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import type { UserPayload } from '../context';
import {
  MAX_LOGIN_ATTEMPTS,
  getLockState,
  recordFailure,
  resetFailures,
} from '../lib/login-lock';
import { hit as rateLimitHit } from '../lib/rate-limit';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';

const PASSWORD_RESET_TTL_MIN = 60;

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Until SMTP/SES is wired up, log the reset link to the server log
// at `info` level so a developer can copy it out during testing.
// Production: swap this for a real email send. The signature stays
// the same so no caller needs to change.
function deliverPasswordResetLink(email: string, token: string): void {
  const base = process.env.APP_URL ?? 'http://localhost:5173';
  const url = `${base}/reset-password?token=${token}`;
  logger.info({ email, url }, '[password-reset] link generated');
}

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

  requestPasswordReset: publicProcedure
    .input(requestPasswordResetSchema)
    .mutation(async ({ ctx, input }) => {
      // Per-email rate limit so the endpoint can't be used to flood a
      // user with reset emails / log spam. 3 in 15 min is plenty for
      // the legit "I keep mistyping my password" case.
      const limit = await rateLimitHit(input.email.toLowerCase().trim(), {
        scope: 'password-reset-request',
        limit: 3,
        windowSec: 15 * 60,
      });
      if (!limit.allowed) {
        // Match the silent-success behaviour below — even when
        // throttled we don't reveal whether the email is registered.
        return { success: true };
      }

      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        include: { org: { select: { deletedAt: true } } },
      });

      if (user && user.active && !user.org.deletedAt) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000);
        await ctx.prisma.passwordResetToken.create({
          data: { tokenHash, userId: user.id, expiresAt },
        });
        deliverPasswordResetLink(user.email, token);
      }

      // Always reply success so an attacker can't tell whether an
      // email is registered by watching the response.
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashResetToken(input.token);
      const stored = await ctx.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { org: { select: { deletedAt: true } } } } },
      });

      if (
        !stored ||
        stored.usedAt !== null ||
        stored.expiresAt < new Date() ||
        !stored.user.active ||
        stored.user.org.deletedAt
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This reset link is invalid or has expired. Request a new one.',
        });
      }

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await ctx.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: stored.userId },
          data: { passwordHash: newHash },
        });
        // Burn this token + every other outstanding reset token for
        // this user so an older email floating around in someone's
        // inbox can't be reused.
        await tx.passwordResetToken.update({
          where: { id: stored.id },
          data: { usedAt: new Date() },
        });
        await tx.passwordResetToken.updateMany({
          where: { userId: stored.userId, usedAt: null, id: { not: stored.id } },
          data: { usedAt: new Date() },
        });
        // Anyone still holding a refresh token for this account loses
        // it — a reset implies "the old credentials are compromised".
        const revoked = await tx.refreshToken.deleteMany({
          where: { userId: stored.userId },
        });
        await audit(
          { prisma: tx, user: { id: stored.userId, orgId: stored.user.orgId } },
          'USER_PASSWORD_RESET',
          'User',
          stored.userId,
          { after: { sessionsRevoked: revoked.count } },
        );
      });
      await resetFailures(stored.user.email);

      return { success: true };
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
        const revoked = await tx.refreshToken.deleteMany({
          where: {
            userId: user.id,
            ...(currentRefresh ? { NOT: { token: currentRefresh } } : {}),
          },
        });
        await audit(
          { prisma: tx, user: ctx.user },
          'USER_PASSWORD_CHANGED',
          'User',
          user.id,
          { after: { sessionsRevoked: revoked.count } },
        );
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
