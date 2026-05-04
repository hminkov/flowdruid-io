import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { PrismaClient, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { resetFailures } from '../lib/login-lock';

const STATE_COOKIE = 'google_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:5173';
}

function ensureConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`
      : (parts[0] ?? 'U').slice(0, 2);
  return letters.toUpperCase().slice(0, 3);
}

function workspaceName(name: string, email: string): string {
  const first = name.trim().split(/\s+/)[0] || email.split('@')[0] || 'My';
  return `${first}'s workspace`;
}

export interface GoogleIdPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export type GoogleResolveResult =
  | { kind: 'invalid_payload' }
  | { kind: 'account_disabled' }
  | { kind: 'ok'; user: User };

/**
 * Map a verified Google ID-token payload to a flowdruid User.
 *
 * Match order: googleSub (stable across email changes) → email
 * (link an existing password-only account on first Google sign-in)
 * → auto-provision a brand-new Organisation with the user as ADMIN.
 *
 * Pulled out of the request handler so the matching logic stays
 * pure and testable without faking Express + Google's HTTP API.
 */
export async function resolveOrProvisionGoogleUser(
  client: PrismaClient,
  payload: GoogleIdPayload,
): Promise<GoogleResolveResult> {
  const sub = payload.sub;
  const email = payload.email?.toLowerCase().trim();
  const name = payload.name?.trim() || email?.split('@')[0] || 'User';
  if (!sub || !email || payload.email_verified === false) {
    return { kind: 'invalid_payload' };
  }

  let user = await client.user.findFirst({
    where: { googleSub: sub },
    include: { org: { select: { deletedAt: true } } },
  });
  if (!user) {
    const byEmail = await client.user.findUnique({
      where: { email },
      include: { org: { select: { deletedAt: true } } },
    });
    if (byEmail) {
      user = await client.user.update({
        where: { id: byEmail.id },
        data: { googleSub: sub },
        include: { org: { select: { deletedAt: true } } },
      });
    }
  }

  if (user && (!user.active || user.org.deletedAt)) {
    return { kind: 'account_disabled' };
  }

  if (!user) {
    user = await client.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: { name: workspaceName(name, email), slug: workspaceSlug(email) },
      });
      return tx.user.create({
        data: {
          email,
          name,
          initials: deriveInitials(name),
          googleSub: sub,
          role: 'ADMIN',
          orgId: org.id,
        },
        include: { org: { select: { deletedAt: true } } },
      });
    });
  }

  // Strip the included org from the type — callers only need the
  // User shape and that include leaks into the inferred return.
  const { org: _org, ...plain } = user;
  void _org;
  return { kind: 'ok', user: plain as User };
}

function workspaceSlug(email: string): string {
  // Slug must be unique across the Organisation table. Use the email
  // local-part for readability + a short random suffix so two people
  // at the same workspace email base don't collide.
  const base = (email.split('@')[0] ?? 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'workspace';
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

/**
 * Step 1 — kick off Google OAuth.
 *
 * Generates a one-shot state value (cookie + query param), then
 * redirects the browser to Google's consent screen. The matching
 * state in the cookie protects the callback against CSRF.
 */
export async function googleOAuthStart(req: Request, res: Response): Promise<void> {
  const cfg = ensureConfig();
  if (!cfg) {
    res.status(503).send('Google sign-in is not configured on this server.');
    return;
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Step 2 — Google has redirected back to us with a `code` and our
 * original `state`. Exchange the code, verify the ID token, look up
 * or provision the user, then mint our own access + refresh tokens
 * and bounce the browser into the app.
 *
 * Auto-provisioning policy: any verified Google email may sign in.
 * If the email is already a user, we just link the Google sub to
 * that row. If it's brand new, we spin up a fresh Organisation with
 * the user as ADMIN — i.e. each new sign-in gets its own workspace.
 */
export async function googleOAuthCallback(req: Request, res: Response): Promise<void> {
  const cfg = ensureConfig();
  if (!cfg) {
    res.status(503).send('Google sign-in is not configured on this server.');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const cookieState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: '/' });

  // The user can hit the callback URL with no params if they bail
  // out of the consent screen — bounce them back to /login cleanly.
  if (req.query.error) {
    logger.info({ err: req.query.error }, '[google-oauth] consent denied');
    res.redirect(`${appUrl()}/login?error=google_cancelled`);
    return;
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    res.redirect(`${appUrl()}/login?error=google_state_mismatch`);
    return;
  }

  const client = new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
  let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string };
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error('no id_token in token response');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: cfg.clientId,
    });
    payload = ticket.getPayload() ?? {};
  } catch (err) {
    logger.warn({ err }, '[google-oauth] token exchange or id-token verify failed');
    res.redirect(`${appUrl()}/login?error=google_verify_failed`);
    return;
  }

  const resolved = await resolveOrProvisionGoogleUser(prisma, payload);
  if (resolved.kind === 'invalid_payload') {
    res.redirect(`${appUrl()}/login?error=google_email_not_verified`);
    return;
  }
  if (resolved.kind === 'account_disabled') {
    res.redirect(`${appUrl()}/login?error=account_disabled`);
    return;
  }
  const user = resolved.user;

  // Set only the refresh cookie. The SPA's AuthProvider runs an
  // unconditional `auth.refresh` on mount when no access token is in
  // localStorage — that's the cleanest hand-off, no URL plumbing.
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });

  // A successful Google sign-in clears any pre-existing per-email
  // failed-login lock on the same address — otherwise someone who
  // tripped the password lockout couldn't recover via Google either.
  await resetFailures(user.email);

  res.redirect(`${appUrl()}/dashboard`);
}
