import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

/**
 * End-to-end cover-request flow.
 *
 * primary requests cover → teammate accepts → assignment now has
 * the new person as primary, notification lands in requester's
 * inbox, original requester is off the hook.
 */
describe('resources cover-request flow', () => {
  it('accepting transfers the primary slot and notifies the requester', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const primary = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Primary' });
    const secondary = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Secondary' });
    const helper = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Helper' });

    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const assignment = await testPrisma.prodSupportAssignment.create({
      data: {
        teamId: team.id,
        weekNumber: 17,
        startDate: weekStart,
        endDate: weekEnd,
        primaryId: primary.id,
        secondaryId: secondary.id,
      },
    });

    // primary asks for cover
    const coverRequest = await asUser(primary).resources.requestCover({
      assignmentId: assignment.id,
      reason: 'Family emergency',
    });
    expect(coverRequest.status).toBe('OPEN');

    // helper accepts — note requestCover fires notifications to 'others'
    // but primary is excluded from that set.
    await asUser(helper).resources.acceptCover({ coverRequestId: coverRequest.id });

    // Primary slot now belongs to helper.
    const after = await testPrisma.prodSupportAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(after.primaryId).toBe(helper.id);

    const cover = await testPrisma.coverRequest.findUniqueOrThrow({
      where: { id: coverRequest.id },
    });
    expect(cover.status).toBe('ACCEPTED');
    expect(cover.acceptedById).toBe(helper.id);

    // The requester got a "your cover was taken" notification.
    const notesForPrimary = await testPrisma.notification.findMany({
      where: { userId: primary.id, entityId: coverRequest.id },
    });
    expect(notesForPrimary.length).toBeGreaterThanOrEqual(1);
    expect(notesForPrimary.some((n) => /took your cover/i.test(n.title))).toBe(true);
  });

  it('refuses a self-accept', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const primary = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const secondary = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const assignment = await testPrisma.prodSupportAssignment.create({
      data: {
        teamId: team.id,
        weekNumber: 17,
        startDate: weekStart,
        endDate: weekEnd,
        primaryId: primary.id,
        secondaryId: secondary.id,
      },
    });

    const coverRequest = await asUser(primary).resources.requestCover({
      assignmentId: assignment.id,
    });

    await expect(
      asUser(primary).resources.acceptCover({ coverRequestId: coverRequest.id }),
    ).rejects.toThrow(/can't accept your own/i);
  });
});
