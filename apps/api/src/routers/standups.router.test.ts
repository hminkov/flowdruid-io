import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('standups.router', () => {
  it('post creates a standup for the caller', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const standup = await asUser(user).standups.post({
      teamId: team.id,
      yesterday: 'shipped X',
      today: 'shipping Y',
      capacityPct: 80,
    });

    expect(standup.userId).toBe(user.id);
    expect(standup.today).toBe('shipping Y');
    expect(standup.capacityPct).toBe(80);
  });

  it('post is upsert-like — a second post on the same day updates instead of duplicating', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    await asUser(user).standups.post({
      teamId: team.id,
      yesterday: 'a',
      today: 'v1',
      capacityPct: 50,
    });
    await asUser(user).standups.post({
      teamId: team.id,
      yesterday: 'a',
      today: 'v2',
      blockers: 'stuck',
      capacityPct: 30,
    });

    const all = await testPrisma.standup.findMany({ where: { userId: user.id } });
    expect(all).toHaveLength(1);
    expect(all[0]?.today).toBe('v2');
    expect(all[0]?.capacityPct).toBe(30);
    expect(all[0]?.blockers).toBe('stuck');
  });

  it('today returns the caller\'s own standup if posted today', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    await asUser(user).standups.post({
      teamId: team.id,
      yesterday: 'prev',
      today: 'x',
      capacityPct: 50,
    });

    const today = await asUser(user).standups.today();
    expect(today?.today).toBe('x');
  });

  it('list filters by teamId and is org-scoped', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const teamA = await createTeam(testPrisma, orgA.id);
    const teamB = await createTeam(testPrisma, orgB.id);
    const userA = await createUser(testPrisma, { orgId: orgA.id, teamId: teamA.id });
    const userB = await createUser(testPrisma, { orgId: orgB.id, teamId: teamB.id });

    await asUser(userA).standups.post({
      teamId: teamA.id,
      yesterday: 'prev',
      today: 'A-work',
      capacityPct: 50,
    });
    await asUser(userB).standups.post({
      teamId: teamB.id,
      yesterday: 'prev',
      today: 'B-work',
      capacityPct: 50,
    });

    const listedByA = await asUser(userA).standups.list({});
    expect(listedByA).toHaveLength(1);
    expect(listedByA[0]?.today).toBe('A-work');
  });
});
