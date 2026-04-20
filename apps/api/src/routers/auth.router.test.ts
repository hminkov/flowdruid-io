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
});
