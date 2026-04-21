import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('activity.feed', () => {
  it('aggregates standups, leaves, QA bookings, parking claims in one stream', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    // Standup
    await testPrisma.standup.create({
      data: { userId: dev.id, teamId: team.id, yesterday: 'y', today: 't' },
    });

    // Leave (requested only, not yet decided)
    await testPrisma.leaveRequest.create({
      data: {
        userId: dev.id,
        type: 'ANNUAL',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
      },
    });

    // QA booking
    const env = await testPrisma.qaEnvironment.create({
      data: { orgId: org.id, name: 'QA1', order: 1 },
    });
    await testPrisma.qaBooking.create({
      data: {
        environmentId: env.id,
        service: 'svc',
        status: 'IN_DEVELOPMENT',
        devOwnerId: dev.id,
      },
    });

    // Parking claim
    const spot = await testPrisma.parkingSpot.create({
      data: { orgId: org.id, name: 'P1', order: 1 },
    });
    await testPrisma.parkingAssignment.create({
      data: { spotId: spot.id, userId: dev.id, date: new Date('2026-06-10') },
    });

    const result = await asUser(lead).activity.feed({ limit: 50 });
    const types = result.items.map((i) => i.type).sort();
    expect(types).toContain('STANDUP_POSTED');
    expect(types).toContain('LEAVE_REQUESTED');
    expect(types).toContain('QA_BOOKING_CREATED');
    expect(types).toContain('PARKING_CLAIMED');
  });

  it('emits LEAVE_APPROVED once the leave is reviewed', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    await testPrisma.leaveRequest.create({
      data: {
        userId: dev.id,
        type: 'ANNUAL',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
        status: 'APPROVED',
        reviewedBy: lead.id,
        reviewedAt: new Date(),
      },
    });

    const result = await asUser(lead).activity.feed({ limit: 50 });
    const types = result.items.map((i) => i.type);
    expect(types).toContain('LEAVE_REQUESTED');
    expect(types).toContain('LEAVE_APPROVED');
  });

  it('respects org boundary — another org\'s events do not leak', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const teamA = await createTeam(testPrisma, orgA.id);
    const teamB = await createTeam(testPrisma, orgB.id);
    const leadA = await createUser(testPrisma, { orgId: orgA.id, teamId: teamA.id, role: 'TEAM_LEAD' });
    const devB = await createUser(testPrisma, { orgId: orgB.id, teamId: teamB.id });

    await testPrisma.standup.create({
      data: { userId: devB.id, teamId: teamB.id, yesterday: 'y', today: 't' },
    });

    const result = await asUser(leadA).activity.feed({ limit: 50 });
    expect(result.items).toHaveLength(0);
  });

  it('filters by actor', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const a = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Alpha' });
    const b = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Bravo' });

    await testPrisma.standup.createMany({
      data: [
        { userId: a.id, teamId: team.id, yesterday: 'y', today: 't' },
        { userId: b.id, teamId: team.id, yesterday: 'y', today: 't' },
      ],
    });

    const result = await asUser(lead).activity.feed({ limit: 50, actorId: a.id });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.actorId).toBe(a.id);
  });

  it('sorts newest-first', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const older = new Date('2026-01-01T12:00:00Z');
    const newer = new Date('2026-03-01T12:00:00Z');

    await testPrisma.standup.create({
      data: { userId: dev.id, teamId: team.id, yesterday: 'old', today: 'old', postedAt: older },
    });
    await testPrisma.standup.create({
      data: { userId: dev.id, teamId: team.id, yesterday: 'new', today: 'new', postedAt: newer },
    });

    const result = await asUser(lead).activity.feed({ limit: 50 });
    const times = result.items.map((i) => new Date(i.createdAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]!);
    }
  });

  it('rejects DEVELOPER role', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    await expect(asUser(dev).activity.feed({ limit: 10 })).rejects.toThrow();
  });
});
