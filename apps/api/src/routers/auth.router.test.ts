import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser, TEST_PASSWORD } from '../test/fixtures';
import { asUser } from '../test/caller';

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
      asUser().auth.login({ email: 'someone@acme.com', password: 'nope' }),
    ).rejects.toThrow();
  });

  it('login rejects an unknown email', async () => {
    await expect(
      asUser().auth.login({ email: 'nobody@acme.com', password: TEST_PASSWORD }),
    ).rejects.toThrow();
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
