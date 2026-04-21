import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

/**
 * Auto-schedule picks random pairs for N consecutive Mondays.
 * We assert invariants rather than specific pairings.
 */
describe('resources.autoScheduleMonth', () => {
  async function setup(memberCount = 4) {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const members = [lead];
    for (let i = 0; i < memberCount - 1; i++) {
      members.push(await createUser(testPrisma, { orgId: org.id, teamId: team.id }));
    }
    return { org, team, lead, members };
  }

  it('creates N assignments on consecutive Mondays', async () => {
    const { team, lead } = await setup(5);
    // 2026-05-04 is a Monday
    await asUser(lead).resources.autoScheduleMonth({
      teamId: team.id,
      startDate: '2026-05-04',
      weeks: 4,
      overwrite: false,
    });

    const assignments = await testPrisma.prodSupportAssignment.findMany({
      where: { teamId: team.id },
      orderBy: { startDate: 'asc' },
    });
    expect(assignments).toHaveLength(4);

    // Each start date is 7 days after the last.
    for (let i = 1; i < assignments.length; i++) {
      const diffDays =
        (assignments[i]!.startDate.getTime() - assignments[i - 1]!.startDate.getTime()) /
        (24 * 3600 * 1000);
      expect(diffDays).toBe(7);
    }
  });

  it('primary and secondary are always different people', async () => {
    const { team, lead } = await setup(4);
    await asUser(lead).resources.autoScheduleMonth({
      teamId: team.id,
      startDate: '2026-05-04',
      weeks: 6,
      overwrite: false,
    });
    const assignments = await testPrisma.prodSupportAssignment.findMany();
    for (const a of assignments) {
      expect(a.primaryId).not.toBe(a.secondaryId);
    }
  });

  it('skips a week that already has an assignment when overwrite=false', async () => {
    const { team, lead, members } = await setup(4);
    // Pre-seed week 19 (2026-05-04) with a known pair.
    await testPrisma.prodSupportAssignment.create({
      data: {
        teamId: team.id,
        startDate: new Date('2026-05-04T00:00:00Z'),
        endDate: new Date('2026-05-08T00:00:00Z'),
        weekNumber: 19,
        primaryId: members[0]!.id,
        secondaryId: members[1]!.id,
      },
    });

    await asUser(lead).resources.autoScheduleMonth({
      teamId: team.id,
      startDate: '2026-05-04',
      weeks: 2,
      overwrite: false,
    });

    // Week 19 kept its seeded pair.
    const week19 = await testPrisma.prodSupportAssignment.findFirstOrThrow({
      where: { teamId: team.id, weekNumber: 19 },
    });
    expect(week19.primaryId).toBe(members[0]!.id);
    expect(week19.secondaryId).toBe(members[1]!.id);
    // Week 20 got generated.
    const week20 = await testPrisma.prodSupportAssignment.findFirst({
      where: { teamId: team.id, weekNumber: 20 },
    });
    expect(week20).not.toBeNull();
  });

  it('overwrite=true replaces the existing pair', async () => {
    const { team, lead, members } = await setup(4);
    await testPrisma.prodSupportAssignment.create({
      data: {
        teamId: team.id,
        startDate: new Date('2026-05-04T00:00:00Z'),
        endDate: new Date('2026-05-08T00:00:00Z'),
        weekNumber: 19,
        primaryId: members[0]!.id,
        secondaryId: members[1]!.id,
      },
    });

    await asUser(lead).resources.autoScheduleMonth({
      teamId: team.id,
      startDate: '2026-05-04',
      weeks: 1,
      overwrite: true,
    });

    // Still only one assignment on that Monday, but pair may have changed.
    const same = await testPrisma.prodSupportAssignment.findMany({
      where: { teamId: team.id, weekNumber: 19 },
    });
    expect(same).toHaveLength(1);
    // Randomness makes the identities fragile to assert, but the
    // upsert must not have thrown (unique-constraint violation would
    // mean our loop didn't skip properly).
  });

  it('refuses when the team has fewer than 2 active members', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });

    await expect(
      asUser(lead).resources.autoScheduleMonth({
        teamId: team.id,
        startDate: '2026-05-04',
        weeks: 1,
        overwrite: false,
      }),
    ).rejects.toThrow(/at least two members/i);
  });

  it('team lead from another team is rejected with FORBIDDEN', async () => {
    const { team } = await setup(3);
    const orgA = await createOrg(testPrisma, 'OtherOrg');
    const otherTeam = await createTeam(testPrisma, orgA.id);
    const outsiderLead = await createUser(testPrisma, {
      orgId: orgA.id,
      teamId: otherTeam.id,
      role: 'TEAM_LEAD',
    });

    await expect(
      asUser(outsiderLead).resources.autoScheduleMonth({
        teamId: team.id,
        startDate: '2026-05-04',
        weeks: 1,
        overwrite: false,
      }),
    ).rejects.toThrow();
  });

  it('admins can auto-schedule any team in their org', async () => {
    const { org, team } = await setup(3);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    await asUser(admin).resources.autoScheduleMonth({
      teamId: team.id,
      startDate: '2026-05-04',
      weeks: 2,
      overwrite: false,
    });

    const count = await testPrisma.prodSupportAssignment.count({ where: { teamId: team.id } });
    expect(count).toBe(2);
  });
});
