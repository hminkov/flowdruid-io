import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import { testPrisma } from '../test/setup';
import { createOrg, createUser, TEST_PASSWORD } from '../test/fixtures';
import { asUser } from '../test/caller';
import { redis } from '../lib/redis';

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Per-email login failures and per-user change-password rate limits
// live in Redis, which isn't wiped by the Postgres-only beforeEach.
// Clear them around every test so state from one test can't bleed
// into another.
beforeEach(async () => {
  const keys = [
    ...(await redis.keys('login:fail:*')),
    ...(await redis.keys('rl:change-password:*')),
    ...(await redis.keys('rl:password-reset-request:*')),
  ];
  if (keys.length) await redis.del(keys);
});

afterAll(async () => {
  const keys = [
    ...(await redis.keys('login:fail:*')),
    ...(await redis.keys('rl:change-password:*')),
    ...(await redis.keys('rl:password-reset-request:*')),
  ];
  if (keys.length) await redis.del(keys);
});

describe('auth.router', () => {
  it('login returns an access token on correct password', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, {
      orgId: org.id,
      email: 'someone@acme.com',
    });

    const result = await asUser().auth.login({
      email: 'someone@acme.com',
      password: TEST_PASSWORD,
    });
    expect(result.accessToken).toBeTruthy();
    expect(result.user?.id).toBe(user.id);
  });

  it('login rejects on wrong password', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'someone@acme.com' });

    await expect(
      asUser().auth.login({ email: 'someone@acme.com', password: 'wrong-password' }),
    ).rejects.toThrow();
  });

  it('login rejects an unknown email', async () => {
    await expect(
      asUser().auth.login({ email: 'nobody@acme.com', password: TEST_PASSWORD }),
    ).rejects.toThrow();
  });

  it('locks out the account after 5 failed attempts and rejects even a correct password', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'lockme@acme.com' });

    for (let i = 0; i < 4; i++) {
      await expect(
        asUser().auth.login({ email: 'lockme@acme.com', password: 'wrong-password' }),
      ).rejects.toThrow(/Invalid credentials/i);
    }
    // The 5th failure flips the lock and surfaces the wait-time message.
    await expect(
      asUser().auth.login({ email: 'lockme@acme.com', password: 'wrong-password' }),
    ).rejects.toThrow(/Too many failed attempts/i);
    // Correct password during lockout is still rejected.
    await expect(
      asUser().auth.login({ email: 'lockme@acme.com', password: TEST_PASSWORD }),
    ).rejects.toThrow(/Too many failed attempts/i);
  });

  it('failed-login error includes the remaining-attempts counter', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'count@acme.com' });

    await expect(
      asUser().auth.login({ email: 'count@acme.com', password: 'wrong-password' }),
    ).rejects.toThrow(/4 attempts remaining/i);
    await expect(
      asUser().auth.login({ email: 'count@acme.com', password: 'wrong-password' }),
    ).rejects.toThrow(/3 attempts remaining/i);
    // Singular form on the last attempt before lockout.
    await asUser()
      .auth.login({ email: 'count@acme.com', password: 'wrong-password' })
      .catch(() => {});
    await expect(
      asUser().auth.login({ email: 'count@acme.com', password: 'wrong-password' }),
    ).rejects.toThrow(/1 attempt remaining/i);
  });

  it('lockout error carries retryAfterSec so the UI can run a countdown', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'timer@acme.com' });

    let caught: unknown;
    for (let i = 0; i < 5; i++) {
      try {
        await asUser().auth.login({ email: 'timer@acme.com', password: 'wrong-password' });
      } catch (e) {
        caught = e;
      }
    }
    const cause = (caught as { cause?: { retryAfterSec?: number } } | null)?.cause;
    expect(typeof cause?.retryAfterSec).toBe('number');
    expect(cause?.retryAfterSec).toBeGreaterThan(0);
    expect(cause?.retryAfterSec).toBeLessThanOrEqual(10 * 60);
  });

  it('a successful login resets the failed-attempt counter', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'reset@acme.com' });

    for (let i = 0; i < 4; i++) {
      await expect(
        asUser().auth.login({ email: 'reset@acme.com', password: 'wrong-password' }),
      ).rejects.toThrow(/Invalid credentials/i);
    }
    // Good password goes through and clears the counter.
    const ok = await asUser().auth.login({
      email: 'reset@acme.com',
      password: TEST_PASSWORD,
    });
    expect(ok.accessToken).toBeTruthy();

    // After the reset, 4 more failures should NOT trip the lock —
    // the counter was zeroed by the successful login above.
    for (let i = 0; i < 4; i++) {
      await expect(
        asUser().auth.login({ email: 'reset@acme.com', password: 'wrong-password' }),
      ).rejects.toThrow(/Invalid credentials/i);
    }
  });

  it('refuses login for a deactivated user', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'gone@acme.com' });
    await testPrisma.user.update({
      where: { email: 'gone@acme.com' },
      data: { active: false },
    });

    await expect(
      asUser().auth.login({ email: 'gone@acme.com', password: TEST_PASSWORD }),
    ).rejects.toThrow();
  });

  it('refuses login when the org is soft-deleted', async () => {
    const org = await createOrg(testPrisma);
    await createUser(testPrisma, { orgId: org.id, email: 'orphan@acme.com' });
    await testPrisma.organisation.update({
      where: { id: org.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      asUser().auth.login({ email: 'orphan@acme.com', password: TEST_PASSWORD }),
    ).rejects.toThrow(/Invalid credentials/i);
  });

  it('refresh burns the token when the org has been soft-deleted', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });
    const inFuture = new Date();
    inFuture.setDate(inFuture.getDate() + 7);
    await testPrisma.refreshToken.create({
      data: { token: 'tombstone', userId: user.id, expiresAt: inFuture },
    });
    await testPrisma.organisation.update({
      where: { id: org.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      asUser(undefined, { cookies: { refreshToken: 'tombstone' } }).auth.refresh(),
    ).rejects.toThrow(/Invalid refresh token/i);
    const rows = await testPrisma.refreshToken.findMany({ where: { token: 'tombstone' } });
    expect(rows).toHaveLength(0);
  });

  describe('changePassword', () => {
    it('rotates the password hash when the current password is correct', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw@acme.com' });

      await asUser(user).auth.changePassword({
        currentPassword: TEST_PASSWORD,
        newPassword: 'a-fresh-passw0rd',
      });

      // Old password no longer logs in; new one does.
      await expect(
        asUser().auth.login({ email: 'pw@acme.com', password: TEST_PASSWORD }),
      ).rejects.toThrow(/Invalid credentials/i);
      const ok = await asUser().auth.login({
        email: 'pw@acme.com',
        password: 'a-fresh-passw0rd',
      });
      expect(ok.accessToken).toBeTruthy();
    });

    it('rejects an incorrect current password', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw2@acme.com' });

      await expect(
        asUser(user).auth.changePassword({
          currentPassword: 'not-my-password',
          newPassword: 'a-fresh-passw0rd',
        }),
      ).rejects.toThrow(/Current password is incorrect/i);
    });

    it('rejects reusing the same password', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw3@acme.com' });

      await expect(
        asUser(user).auth.changePassword({
          currentPassword: TEST_PASSWORD,
          newPassword: TEST_PASSWORD,
        }),
      ).rejects.toThrow(/different from the current/i);
    });

    it('clears the failed-login counter so a reset unlocks the account', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw4@acme.com' });

      // Trip the lockout via 5 wrong-password attempts.
      for (let i = 0; i < 5; i++) {
        await asUser()
          .auth.login({ email: 'pw4@acme.com', password: 'wrong-password' })
          .catch(() => {});
      }
      // Sanity-check we're locked.
      await expect(
        asUser().auth.login({ email: 'pw4@acme.com', password: TEST_PASSWORD }),
      ).rejects.toThrow(/Too many failed attempts/i);

      // Change password — this should clear the lock.
      await asUser(user).auth.changePassword({
        currentPassword: TEST_PASSWORD,
        newPassword: 'a-fresh-passw0rd',
      });

      // Now the new password works immediately, no waiting.
      const ok = await asUser().auth.login({
        email: 'pw4@acme.com',
        password: 'a-fresh-passw0rd',
      });
      expect(ok.accessToken).toBeTruthy();
    });

    it('writes an audit-log row when the password changes', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw-audit@acme.com' });

      await asUser(user, { cookies: { refreshToken: 'this-session' } }).auth.changePassword({
        currentPassword: TEST_PASSWORD,
        newPassword: 'a-fresh-passw0rd',
      });

      const rows = await testPrisma.auditLog.findMany({
        where: { action: 'USER_PASSWORD_CHANGED', entityId: user.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorId).toBe(user.id);
      expect(rows[0]?.entityType).toBe('User');
    });

    it('rate-limits per user — 6th attempt in the window is rejected with retryAfterSec', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw-rate@acme.com' });

      // 5 wrong-currentPassword attempts use up the budget.
      for (let i = 0; i < 5; i++) {
        await asUser(user)
          .auth.changePassword({
            currentPassword: 'not-my-password',
            newPassword: 'a-fresh-passw0rd',
          })
          .catch(() => {});
      }
      // 6th attempt — even with the correct current password — is
      // rate-limited, and carries retryAfterSec for the UI countdown.
      let caught: unknown;
      try {
        await asUser(user).auth.changePassword({
          currentPassword: TEST_PASSWORD,
          newPassword: 'a-fresh-passw0rd',
        });
      } catch (e) {
        caught = e;
      }
      const err = caught as { message?: string; cause?: { retryAfterSec?: number } } | undefined;
      expect(err?.message).toMatch(/Too many password-change attempts/i);
      expect(typeof err?.cause?.retryAfterSec).toBe('number');
    });

    it('revokes other refresh tokens but keeps the current session alive', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'pw5@acme.com' });

      const inFuture = new Date();
      inFuture.setDate(inFuture.getDate() + 7);
      // Two refresh tokens: one that this request is riding on, one
      // representing a session on another device.
      await testPrisma.refreshToken.create({
        data: { token: 'this-session', userId: user.id, expiresAt: inFuture },
      });
      await testPrisma.refreshToken.create({
        data: { token: 'other-device', userId: user.id, expiresAt: inFuture },
      });

      await asUser(user, { cookies: { refreshToken: 'this-session' } }).auth.changePassword({
        currentPassword: TEST_PASSWORD,
        newPassword: 'a-fresh-passw0rd',
      });

      const survivors = await testPrisma.refreshToken.findMany({
        where: { userId: user.id },
        select: { token: true },
      });
      expect(survivors).toEqual([{ token: 'this-session' }]);
    });
  });

  describe('password reset', () => {
    it('requestPasswordReset creates a row for an existing user', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'reset-me@acme.com' });

      const result = await asUser().auth.requestPasswordReset({ email: 'reset-me@acme.com' });
      expect(result.success).toBe(true);

      const tokens = await testPrisma.passwordResetToken.findMany({
        where: { userId: user.id },
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.usedAt).toBeNull();
      expect(tokens[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('requestPasswordReset silently succeeds for an unknown email (no enumeration leak)', async () => {
      const result = await asUser().auth.requestPasswordReset({ email: 'nobody@acme.com' });
      expect(result.success).toBe(true);

      const tokens = await testPrisma.passwordResetToken.findMany();
      expect(tokens).toHaveLength(0);
    });

    it('resetPassword swaps the password hash and the new password works', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'reset-flow@acme.com' });

      const plaintext = 'a'.repeat(64);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await testPrisma.passwordResetToken.create({
        data: { tokenHash: hashResetToken(plaintext), userId: user.id, expiresAt },
      });

      await asUser().auth.resetPassword({
        token: plaintext,
        newPassword: 'a-fresh-passw0rd',
      });

      const ok = await asUser().auth.login({
        email: 'reset-flow@acme.com',
        password: 'a-fresh-passw0rd',
      });
      expect(ok.accessToken).toBeTruthy();
    });

    it('resetPassword burns the token so it cannot be replayed', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'replay@acme.com' });
      const plaintext = 'b'.repeat(64);
      await testPrisma.passwordResetToken.create({
        data: {
          tokenHash: hashResetToken(plaintext),
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await asUser().auth.resetPassword({ token: plaintext, newPassword: 'first-passw0rd' });
      await expect(
        asUser().auth.resetPassword({ token: plaintext, newPassword: 'second-passw0rd' }),
      ).rejects.toThrow(/invalid or has expired/i);
    });

    it('resetPassword rejects an expired token', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'stale@acme.com' });
      const plaintext = 'c'.repeat(64);
      await testPrisma.passwordResetToken.create({
        data: {
          tokenHash: hashResetToken(plaintext),
          userId: user.id,
          expiresAt: new Date(Date.now() - 1_000),
        },
      });

      await expect(
        asUser().auth.resetPassword({ token: plaintext, newPassword: 'a-fresh-passw0rd' }),
      ).rejects.toThrow(/invalid or has expired/i);
    });

    it('resetPassword revokes every refresh token + clears the failed-login lock', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, email: 'unlock@acme.com' });

      // Pre-existing session + a tripped lockout from prior failures.
      const inFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await testPrisma.refreshToken.create({
        data: { token: 'old-session', userId: user.id, expiresAt: inFuture },
      });
      for (let i = 0; i < 5; i++) {
        await asUser()
          .auth.login({ email: 'unlock@acme.com', password: 'wrong-password' })
          .catch(() => {});
      }

      const plaintext = 'd'.repeat(64);
      await testPrisma.passwordResetToken.create({
        data: {
          tokenHash: hashResetToken(plaintext),
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await asUser().auth.resetPassword({ token: plaintext, newPassword: 'a-fresh-passw0rd' });

      // Old session is gone.
      const sessions = await testPrisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(0);

      // Login lockout cleared — the new password works immediately.
      const ok = await asUser().auth.login({
        email: 'unlock@acme.com',
        password: 'a-fresh-passw0rd',
      });
      expect(ok.accessToken).toBeTruthy();

      // Audit row written.
      const audits = await testPrisma.auditLog.findMany({
        where: { action: 'USER_PASSWORD_RESET', entityId: user.id },
      });
      expect(audits).toHaveLength(1);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a fresh access token', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id });

      // Seed a refresh token for this user.
      const inFuture = new Date();
      inFuture.setDate(inFuture.getDate() + 7);
      const oldToken = 'old-refresh-token-value';
      await testPrisma.refreshToken.create({
        data: { token: oldToken, userId: user.id, expiresAt: inFuture },
      });

      const result = await asUser(undefined, { cookies: { refreshToken: oldToken } }).auth.refresh();
      expect(result.accessToken).toBeTruthy();
      expect(result.user?.id).toBe(user.id);

      // Old token is revoked, a new one replaces it.
      const survivors = await testPrisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(survivors).toHaveLength(1);
      expect(survivors[0]?.token).not.toBe(oldToken);
    });

    it('rejects a missing / unknown refresh token with UNAUTHORIZED', async () => {
      await expect(asUser().auth.refresh()).rejects.toThrow(/No refresh token/i);
      await expect(
        asUser(undefined, { cookies: { refreshToken: 'bogus' } }).auth.refresh(),
      ).rejects.toThrow(/Invalid refresh token/i);
    });

    it('rejects an expired refresh token and burns it', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id });
      const past = new Date();
      past.setDate(past.getDate() - 1);
      await testPrisma.refreshToken.create({
        data: { token: 'expired-token', userId: user.id, expiresAt: past },
      });

      await expect(
        asUser(undefined, { cookies: { refreshToken: 'expired-token' } }).auth.refresh(),
      ).rejects.toThrow(/Invalid refresh token/i);
      const rows = await testPrisma.refreshToken.findMany({ where: { token: 'expired-token' } });
      expect(rows).toHaveLength(0);
    });
  });

  describe('logout', () => {
    it('removes the refresh token row on logout', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id });
      const inFuture = new Date();
      inFuture.setDate(inFuture.getDate() + 1);
      await testPrisma.refreshToken.create({
        data: { token: 'will-be-deleted', userId: user.id, expiresAt: inFuture },
      });

      await asUser(user, { cookies: { refreshToken: 'will-be-deleted' } }).auth.logout();
      const rows = await testPrisma.refreshToken.findMany({ where: { token: 'will-be-deleted' } });
      expect(rows).toHaveLength(0);
    });
  });

  describe('me', () => {
    it('returns the current user from DB, not the JWT payload', async () => {
      const org = await createOrg(testPrisma);
      const user = await createUser(testPrisma, { orgId: org.id, name: 'Original' });
      // Mutate name in DB — `me` should read the fresh value.
      await testPrisma.user.update({ where: { id: user.id }, data: { name: 'Renamed' } });

      const result = await asUser(user).auth.me();
      expect(result.name).toBe('Renamed');
    });
  });
});
