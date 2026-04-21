import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

/**
 * Covers the resources procedures not already tested in
 * resources.parking / resources.autoSchedule / resources.acceptCover.
 */

async function createAssignment(orgId: string) {
  const team = await createTeam(testPrisma, orgId);
  const lead = await createUser(testPrisma, { orgId, teamId: team.id, role: 'TEAM_LEAD' });
  const primary = await createUser(testPrisma, { orgId, teamId: team.id, name: 'Primary' });
  const secondary = await createUser(testPrisma, { orgId, teamId: team.id, name: 'Secondary' });
  const start = new Date('2026-05-04T00:00:00Z');
  const end = new Date('2026-05-08T00:00:00Z');
  const assignment = await testPrisma.prodSupportAssignment.create({
    data: {
      teamId: team.id,
      startDate: start,
      endDate: end,
      weekNumber: 19,
      primaryId: primary.id,
      secondaryId: secondary.id,
    },
  });
  return { team, lead, primary, secondary, assignment };
}

describe('resources: prod-support create/delete', () => {
  it('createProdSupport upserts an assignment', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const a = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const b = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    await asUser(lead).resources.createProdSupport({
      teamId: team.id,
      startDate: '2026-05-04',
      endDate: '2026-05-08',
      weekNumber: 19,
      primaryId: a.id,
      secondaryId: b.id,
    });

    const stored = await testPrisma.prodSupportAssignment.findMany({ where: { teamId: team.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.primaryId).toBe(a.id);

    // Re-create overwrites — second call swaps primary/secondary.
    await asUser(lead).resources.createProdSupport({
      teamId: team.id,
      startDate: '2026-05-04',
      endDate: '2026-05-08',
      weekNumber: 19,
      primaryId: b.id,
      secondaryId: a.id,
    });
    const after = await testPrisma.prodSupportAssignment.findMany({ where: { teamId: team.id } });
    expect(after).toHaveLength(1);
    expect(after[0]?.primaryId).toBe(b.id);
  });

  it('deleteProdSupport removes the row and writes PROD_SUPPORT_DELETED', async () => {
    const org = await createOrg(testPrisma);
    const { lead, assignment } = await createAssignment(org.id);

    await asUser(lead).resources.deleteProdSupport({ assignmentId: assignment.id });

    const gone = await testPrisma.prodSupportAssignment.findUnique({ where: { id: assignment.id } });
    expect(gone).toBeNull();
    const audit = await testPrisma.auditLog.findFirstOrThrow({
      where: { action: 'PROD_SUPPORT_DELETED', entityId: assignment.id },
    });
    expect(audit.before).toMatchObject({ weekNumber: 19 });
  });

  it('prodSupport query returns assignments for the org, team-filtered', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const { team: teamA, lead: leadA } = await createAssignment(orgA.id);
    await createAssignment(orgB.id); // must not appear in orgA results

    const all = await asUser(leadA).resources.prodSupport({});
    expect(all.every((a) => a.team.id === teamA.id)).toBe(true);

    const filtered = await asUser(leadA).resources.prodSupport({ teamId: teamA.id });
    expect(filtered).toHaveLength(1);
  });
});

describe('resources: cover request edges', () => {
  it('requestCover refuses a non-primary/secondary', async () => {
    const org = await createOrg(testPrisma);
    const { team, assignment } = await createAssignment(org.id);
    const outsider = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Outsider' });

    await expect(
      asUser(outsider).resources.requestCover({ assignmentId: assignment.id }),
    ).rejects.toThrow();
  });

  it('cancelCover flips status to CANCELLED; requester-only', async () => {
    const org = await createOrg(testPrisma);
    const { primary, secondary, assignment } = await createAssignment(org.id);

    const cover = await asUser(primary).resources.requestCover({ assignmentId: assignment.id });
    expect(cover.status).toBe('OPEN');

    // Someone else can't cancel.
    await expect(
      asUser(secondary).resources.cancelCover({ coverRequestId: cover.id }),
    ).rejects.toThrow();

    // Requester can.
    await asUser(primary).resources.cancelCover({ coverRequestId: cover.id });
    const after = await testPrisma.coverRequest.findUniqueOrThrow({ where: { id: cover.id } });
    expect(after.status).toBe('CANCELLED');
  });

  it('listCoverRequests returns open requests for the caller org', async () => {
    const org = await createOrg(testPrisma);
    const { primary, secondary, assignment } = await createAssignment(org.id);
    await asUser(primary).resources.requestCover({ assignmentId: assignment.id });

    const list = await asUser(secondary).resources.listCoverRequests({ openOnly: true });
    expect(list).toHaveLength(1);
    expect(list[0]!.assignment.id).toBe(assignment.id);
  });
});

describe('resources: QA envs + parking-spot updates', () => {
  it('updateQaEnvironment patches branch + description', async () => {
    const org = await createOrg(testPrisma);
    const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
    const env = await testPrisma.qaEnvironment.create({
      data: { orgId: org.id, name: 'QA1', order: 1 },
    });

    await asUser(lead).resources.updateQaEnvironment({
      environmentId: env.id,
      branch: 'temp/qa1',
      description: 'default env',
    });

    const after = await testPrisma.qaEnvironment.findUniqueOrThrow({ where: { id: env.id } });
    expect(after.branch).toBe('temp/qa1');
    expect(after.description).toBe('default env');
  });

  it('updateParkingSpot renames the spot', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
    const spot = await testPrisma.parkingSpot.create({
      data: { orgId: org.id, name: 'Old', order: 1 },
    });

    await asUser(admin).resources.updateParkingSpot({ spotId: spot.id, name: 'New Name' });

    const after = await testPrisma.parkingSpot.findUniqueOrThrow({ where: { id: spot.id } });
    expect(after.name).toBe('New Name');
  });

  it('createQaBooking persists + returns the new booking', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const env = await testPrisma.qaEnvironment.create({
      data: { orgId: org.id, name: 'QA1', order: 1 },
    });

    const booking = await asUser(lead).resources.createQaBooking({
      environmentId: env.id,
      service: 'withdrawal-api',
      feature: 'SEPA retry',
      clientTag: 'v1.0',
      status: 'IN_DEVELOPMENT',
    });

    expect(booking.service).toBe('withdrawal-api');
    expect(booking.environmentId).toBe(env.id);
  });

  it('createParkingSpot rejects non-admin', async () => {
    const org = await createOrg(testPrisma);
    const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
    await expect(
      asUser(lead).resources.createParkingSpot({ name: 'X' }),
    ).rejects.toThrow(TRPCError);
  });

  it('deleteParkingSpot refuses when a future booking exists', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
    const user = await createUser(testPrisma, { orgId: org.id });
    const spot = await testPrisma.parkingSpot.create({
      data: { orgId: org.id, name: 'S', order: 1 },
    });
    const future = new Date();
    future.setDate(future.getDate() + 3);
    future.setUTCHours(0, 0, 0, 0);
    await testPrisma.parkingAssignment.create({
      data: { spotId: spot.id, userId: user.id, date: future },
    });

    await expect(
      asUser(admin).resources.deleteParkingSpot({ spotId: spot.id }),
    ).rejects.toThrow(/future bookings/i);
  });
});
