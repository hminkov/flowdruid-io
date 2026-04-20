import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function tomorrow() {
  const d = todayMidnight();
  d.setDate(d.getDate() + 1);
  return d;
}

describe('leaves.router', () => {
  describe('approve', () => {
    it('flips PENDING → APPROVED, sets availability to ON_LEAVE when leave starts today, writes audit row', async () => {
      const org = await createOrg(testPrisma);
      const team = await createTeam(testPrisma, org.id);
      const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
      const requester = await createUser(testPrisma, {
        orgId: org.id,
        teamId: team.id,
        name: 'Requester',
      });

      const leave = await testPrisma.leaveRequest.create({
        data: {
          userId: requester.id,
          type: 'ANNUAL',
          startDate: todayMidnight(),
          endDate: tomorrow(),
          status: 'PENDING',
          notifySlack: false, // avoid enqueueing Slack jobs in tests
        },
      });

      await asUser(lead).leaves.approve({ leaveId: leave.id });

      const after = await testPrisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
      expect(after.status).toBe('APPROVED');
      expect(after.reviewedBy).toBe(lead.id);
      expect(after.reviewedAt).not.toBeNull();

      const userAfter = await testPrisma.user.findUniqueOrThrow({ where: { id: requester.id } });
      expect(userAfter.availability).toBe('ON_LEAVE');

      const audits = await testPrisma.auditLog.findMany({
        where: { entityType: 'LeaveRequest', entityId: leave.id },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.action).toBe('LEAVE_APPROVED');
    });

    it('does NOT touch availability for a leave starting in the future', async () => {
      const org = await createOrg(testPrisma);
      const team = await createTeam(testPrisma, org.id);
      const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
      const requester = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

      const future = new Date();
      future.setDate(future.getDate() + 30);
      const laterFuture = new Date(future);
      laterFuture.setDate(laterFuture.getDate() + 1);

      const leave = await testPrisma.leaveRequest.create({
        data: {
          userId: requester.id,
          type: 'ANNUAL',
          startDate: future,
          endDate: laterFuture,
          status: 'PENDING',
          notifySlack: false,
        },
      });

      await asUser(lead).leaves.approve({ leaveId: leave.id });

      const userAfter = await testPrisma.user.findUniqueOrThrow({ where: { id: requester.id } });
      expect(userAfter.availability).toBe('AVAILABLE'); // unchanged
    });

    it('rejects approving a non-PENDING request', async () => {
      const org = await createOrg(testPrisma);
      const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
      const requester = await createUser(testPrisma, { orgId: org.id });
      const leave = await testPrisma.leaveRequest.create({
        data: {
          userId: requester.id,
          type: 'ANNUAL',
          startDate: new Date(),
          endDate: new Date(),
          status: 'APPROVED', // already approved
          notifySlack: false,
        },
      });

      await expect(asUser(lead).leaves.approve({ leaveId: leave.id })).rejects.toThrow(
        /not pending/i,
      );
    });
  });

  describe('deny', () => {
    it('flips PENDING → DENIED and writes audit row', async () => {
      const org = await createOrg(testPrisma);
      const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
      const requester = await createUser(testPrisma, { orgId: org.id });

      const leave = await testPrisma.leaveRequest.create({
        data: {
          userId: requester.id,
          type: 'ANNUAL',
          startDate: new Date(),
          endDate: new Date(),
          status: 'PENDING',
          notifySlack: false,
        },
      });

      await asUser(lead).leaves.deny({ leaveId: leave.id });

      const after = await testPrisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
      expect(after.status).toBe('DENIED');

      const audits = await testPrisma.auditLog.findMany({
        where: { entityType: 'LeaveRequest', entityId: leave.id, action: 'LEAVE_DENIED' },
      });
      expect(audits).toHaveLength(1);
    });
  });
});
