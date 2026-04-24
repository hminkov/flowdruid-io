import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser, TEST_PASSWORD } from '../test/fixtures';
import { asUser } from '../test/caller';
import { redis } from '../lib/redis';

// Per-email login failures are tracked in Redis, which isn't wiped by
// the Postgres-only beforeEach. Clear them around every test so a
// counter from one test can't lock out another.
beforeEach(async () => {
  const keys = await redis.keys('login:fail:*');
  if (keys.length) await redis.del(keys);
});

afterAll(async () => {
  const keys = await redis.keys('login:fail:*');
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
