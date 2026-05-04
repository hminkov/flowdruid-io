import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { resolveOrProvisionGoogleUser } from './google-oauth';

describe('resolveOrProvisionGoogleUser', () => {
  it('rejects a payload with an unverified email', async () => {
    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: '123',
      email: 'someone@gmail.com',
      email_verified: false,
      name: 'Someone',
    });
    expect(result.kind).toBe('invalid_payload');
  });

  it('rejects a payload missing sub or email', async () => {
    expect(
      (await resolveOrProvisionGoogleUser(testPrisma, { email: 'x@y.com' })).kind,
    ).toBe('invalid_payload');
    expect(
      (await resolveOrProvisionGoogleUser(testPrisma, { sub: '123' })).kind,
    ).toBe('invalid_payload');
  });

  it('links an existing password-only account by email on first Google sign-in', async () => {
    const org = await createOrg(testPrisma);
    const existing = await createUser(testPrisma, {
      orgId: org.id,
      email: 'linked@acme.com',
      name: 'Linked User',
    });
    expect(existing.googleSub).toBeNull();

    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: 'google-sub-123',
      email: 'linked@acme.com',
      email_verified: true,
      name: 'Linked User',
    });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.user.id).toBe(existing.id);
      expect(result.user.googleSub).toBe('google-sub-123');
      // Existing user keeps their org / role — we don't auto-promote.
      expect(result.user.orgId).toBe(org.id);
      expect(result.user.role).toBe('DEVELOPER');
    }
  });

  it('matches by sub even after the email changes in Google', async () => {
    const org = await createOrg(testPrisma);
    const existing = await testPrisma.user.update({
      where: {
        id: (
          await createUser(testPrisma, { orgId: org.id, email: 'old@acme.com' })
        ).id,
      },
      data: { googleSub: 'stable-sub' },
    });

    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: 'stable-sub',
      email: 'NEW-EMAIL@acme.com',
      email_verified: true,
      name: 'Renamed',
    });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.user.id).toBe(existing.id);
      // We don't overwrite the email on sub-match; the existing
      // login-by-password identity stays intact.
      expect(result.user.email).toBe('old@acme.com');
    }
  });

  it('refuses to sign in a deactivated user', async () => {
    const org = await createOrg(testPrisma);
    const u = await createUser(testPrisma, { orgId: org.id, email: 'gone@acme.com' });
    await testPrisma.user.update({ where: { id: u.id }, data: { active: false } });

    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: 'sub-gone',
      email: 'gone@acme.com',
      email_verified: true,
      name: 'Gone',
    });
    expect(result.kind).toBe('account_disabled');
  });

  it('auto-provisions a fresh Organisation + ADMIN user for a brand-new Google account', async () => {
    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: 'brand-new-sub',
      email: 'fresh@example.com',
      email_verified: true,
      name: 'Fresh Person',
    });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.user.email).toBe('fresh@example.com');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.googleSub).toBe('brand-new-sub');
      expect(result.user.initials).toBe('FP');

      // A new Organisation was created — confirm it exists and the
      // user is its only member.
      const org = await testPrisma.organisation.findUnique({
        where: { id: result.user.orgId },
      });
      expect(org).not.toBeNull();
      expect(org?.name).toMatch(/Fresh's workspace/i);
      const members = await testPrisma.user.count({ where: { orgId: result.user.orgId } });
      expect(members).toBe(1);
    }
  });

  it('normalises the email to lowercase + trim before matching', async () => {
    const org = await createOrg(testPrisma);
    const existing = await createUser(testPrisma, {
      orgId: org.id,
      email: 'caps@acme.com',
    });

    const result = await resolveOrProvisionGoogleUser(testPrisma, {
      sub: 'sub-caps',
      email: '  CAPS@ACME.COM  ',
      email_verified: true,
      name: 'Caps User',
    });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.user.id).toBe(existing.id);
    }
  });
});
