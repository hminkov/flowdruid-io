import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('org.current', () => {
  it("returns onboardedAt for the caller's org", async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    const result = await asUser(user).org.current();
    expect(result.id).toBe(org.id);
    // createOrg leaves onboardedAt at the column default (null) — a
    // freshly-seeded org is "needs onboarding".
    expect(result.onboardedAt).toBeNull();
  });
});

describe('org.completeOnboarding', () => {
  it('renames the workspace, creates the first team, and stamps onboardedAt', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    const result = await asUser(admin).org.completeOnboarding({
      workspaceName: 'Acme Inc.',
      teamName: 'Engineering',
      inviteEmails: [],
    });

    expect(result.ok).toBe(true);
    expect(result.alreadyOnboarded).toBe(false);
    expect(typeof result.teamId).toBe('string');

    const updated = await testPrisma.organisation.findUnique({ where: { id: org.id } });
    expect(updated?.name).toBe('Acme Inc.');
    expect(updated?.onboardedAt).not.toBeNull();

    const team = await testPrisma.team.findFirst({ where: { orgId: org.id } });
    expect(team?.name).toBe('Engineering');

    // Admin should be on that team afterwards.
    const refreshed = await testPrisma.user.findUnique({ where: { id: admin.id } });
    expect(refreshed?.teamId).toBe(team?.id);
  });

  it('seeds invitee accounts on the same org', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    const result = await asUser(admin).org.completeOnboarding({
      workspaceName: 'Acme',
      teamName: 'Eng',
      inviteEmails: ['alex@acme.com', 'jordan@acme.com'],
    });

    expect(result.invitesCreated).toBe(2);
    const invitees = await testPrisma.user.findMany({
      where: { orgId: org.id, email: { in: ['alex@acme.com', 'jordan@acme.com'] } },
    });
    expect(invitees).toHaveLength(2);
    // Invitees join the new team alongside the admin.
    invitees.forEach((u) => expect(u.teamId).toBe(result.teamId));
  });

  it('refuses when an invite email is already in use elsewhere', async () => {
    const orgA = await createOrg(testPrisma, 'OrgA');
    const orgB = await createOrg(testPrisma, 'OrgB');
    await createUser(testPrisma, { orgId: orgB.id, email: 'taken@acme.com' });
    const admin = await createUser(testPrisma, { orgId: orgA.id, role: 'ADMIN' });

    await expect(
      asUser(admin).org.completeOnboarding({
        workspaceName: 'OrgA',
        inviteEmails: ['taken@acme.com'],
      }),
    ).rejects.toThrow(/already in use/i);

    // OrgA must remain un-onboarded after the failure — full rollback.
    const a = await testPrisma.organisation.findUnique({ where: { id: orgA.id } });
    expect(a?.onboardedAt).toBeNull();
  });

  it('is a no-op once the org is already onboarded', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
    await testPrisma.organisation.update({
      where: { id: org.id },
      data: { onboardedAt: new Date(), name: 'Original' },
    });

    const result = await asUser(admin).org.completeOnboarding({
      workspaceName: 'Trying-to-rename',
    });
    expect(result.alreadyOnboarded).toBe(true);

    const after = await testPrisma.organisation.findUnique({ where: { id: org.id } });
    expect(after?.name).toBe('Original');
  });

  it('refuses non-admins', async () => {
    const org = await createOrg(testPrisma);
    const dev = await createUser(testPrisma, { orgId: org.id, role: 'DEVELOPER' });

    await expect(
      asUser(dev).org.completeOnboarding({ workspaceName: 'X' }),
    ).rejects.toThrow();
  });
});
