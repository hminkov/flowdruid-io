import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

function day(offset = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

describe('leaves.router request + list + calendar', () => {
  it('request creates a PENDING leave request for the caller', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });

    const leave = await asUser(user).leaves.request({
      type: 'ANNUAL',
      startDate: day(7),
      endDate: day(9),
      note: 'wedding',
      notifySlack: false,
    });

    expect(leave.userId).toBe(user.id);
    expect(leave.status).toBe('PENDING');
    expect(leave.type).toBe('ANNUAL');
    expect(leave.note).toBe('wedding');
  });

  it('request auto-approves SICK leave', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });

    const leave = await asUser(user).leaves.request({
      type: 'SICK',
      startDate: day(0),
      endDate: day(0),
      notifySlack: false,
    });

    expect(leave.status).toBe('APPROVED');
  });

  it('request refuses overlapping PENDING / APPROVED requests', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });
    await testPrisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: 'ANNUAL',
        startDate: new Date(day(5)),
        endDate: new Date(day(10)),
        status: 'PENDING',
        notifySlack: false,
      },
    });

    await expect(
      asUser(user).leaves.request({
        type: 'ANNUAL',
        startDate: day(7),
        endDate: day(12),
        notifySlack: false,
      }),
    ).rejects.toThrow();
  });

  it('list returns only the caller\'s own requests', async () => {
    const org = await createOrg(testPrisma);
    const a = await createUser(testPrisma, { orgId: org.id });
    const b = await createUser(testPrisma, { orgId: org.id });

    await asUser(a).leaves.request({
      type: 'ANNUAL',
      startDate: day(3),
      endDate: day(4),
      notifySlack: false,
    });
    await asUser(b).leaves.request({
      type: 'ANNUAL',
      startDate: day(3),
      endDate: day(4),
      notifySlack: false,
    });

    const listed = await asUser(a).leaves.list({});
    expect(listed).toHaveLength(1);
    expect(listed[0]?.userId).toBe(a.id);
  });

  it('pending returns only PENDING rows, lead-scoped', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    // Seed three leaves: one PENDING, one APPROVED, one DENIED.
    for (const status of ['PENDING', 'APPROVED', 'DENIED'] as const) {
      await testPrisma.leaveRequest.create({
        data: {
          userId: dev.id,
          type: 'ANNUAL',
          startDate: new Date(day(status === 'PENDING' ? 20 : status === 'APPROVED' ? 40 : 60)),
          endDate: new Date(day(status === 'PENDING' ? 22 : status === 'APPROVED' ? 42 : 62)),
          status,
          notifySlack: false,
        },
      });
    }

    const pending = await asUser(lead).leaves.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe('PENDING');
  });

  it('calendar only surfaces APPROVED leaves overlapping the window', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });

    // APPROVED: 2026-05-10 → 2026-05-12 (overlaps the May query window)
    await testPrisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: 'ANNUAL',
        startDate: new Date('2026-05-10T00:00:00Z'),
        endDate: new Date('2026-05-12T00:00:00Z'),
        status: 'APPROVED',
        notifySlack: false,
      },
    });
    // PENDING: same dates — should be excluded
    await testPrisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: 'ANNUAL',
        startDate: new Date('2026-05-10T00:00:00Z'),
        endDate: new Date('2026-05-12T00:00:00Z'),
        status: 'PENDING',
        notifySlack: false,
      },
    });

    const result = await asUser(user).leaves.calendar({
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('APPROVED');
  });
});

describe('users.updateAvailability', () => {
  it('lets a user change their own availability', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).users.updateAvailability({ availability: 'BUSY' });
    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.availability).toBe('BUSY');
  });
});

describe('users.list', () => {
  it('returns active users in the caller org, lead-gated', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const leadA = await createUser(testPrisma, { orgId: orgA.id, role: 'TEAM_LEAD', name: 'L' });
    await createUser(testPrisma, { orgId: orgA.id, name: 'A-dev' });
    await createUser(testPrisma, { orgId: orgB.id, name: 'B-dev' });

    const listed = await asUser(leadA).users.list();
    expect(listed.every((u) => u.name !== 'B-dev')).toBe(true);
    expect(listed.some((u) => u.name === 'A-dev')).toBe(true);
    expect(listed.some((u) => u.id === leadA.id)).toBe(true);
  });

  it('excludes deactivated users', async () => {
    const org = await createOrg(testPrisma);
    const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
    const gone = await createUser(testPrisma, { orgId: org.id, name: 'Gone' });
    await testPrisma.user.update({ where: { id: gone.id }, data: { active: false } });

    const listed = await asUser(lead).users.list();
    expect(listed.some((u) => u.id === gone.id)).toBe(false);
  });
});
