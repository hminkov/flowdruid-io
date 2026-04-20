import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('users.router', () => {
  describe('update (role change)', () => {
    it('changes role and writes an audit row', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN', name: 'Admin' });
      const target = await createUser(testPrisma, {
        orgId: org.id,
        role: 'DEVELOPER',
        name: 'Target User',
      });

      await asUser(admin).users.update({ userId: target.id, role: 'TEAM_LEAD' });

      const after = await testPrisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after.role).toBe('TEAM_LEAD');

      const audits = await testPrisma.auditLog.findMany({
        where: { entityType: 'User', entityId: target.id },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.action).toBe('USER_ROLE_CHANGED');
      expect(audits[0]?.actorId).toBe(admin.id);
      expect(audits[0]?.before).toEqual({ role: 'DEVELOPER' });
      expect(audits[0]?.after).toEqual({ role: 'TEAM_LEAD' });
    });

    it('skips the audit row when the role did not actually change', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      const team = await createTeam(testPrisma, org.id);
      const target = await createUser(testPrisma, { orgId: org.id, role: 'DEVELOPER' });

      // Update only teamId — role stays DEVELOPER.
      await asUser(admin).users.update({ userId: target.id, teamId: team.id });

      const audits = await testPrisma.auditLog.findMany({
        where: { entityType: 'User', entityId: target.id, action: 'USER_ROLE_CHANGED' },
      });
      expect(audits).toHaveLength(0);
    });

    it('rejects non-admins with FORBIDDEN', async () => {
      const org = await createOrg(testPrisma);
      const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
      const target = await createUser(testPrisma, { orgId: org.id, role: 'DEVELOPER' });

      await expect(
        asUser(lead).users.update({ userId: target.id, role: 'ADMIN' }),
      ).rejects.toThrow(TRPCError);
    });

    it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
      const org = await createOrg(testPrisma);
      const target = await createUser(testPrisma, { orgId: org.id });
      await expect(asUser().users.update({ userId: target.id, role: 'ADMIN' })).rejects.toThrow();
    });
  });

  describe('deactivate', () => {
    it('flips active=false and writes USER_DEACTIVATED', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      const target = await createUser(testPrisma, { orgId: org.id, name: 'Gone Person' });

      await asUser(admin).users.deactivate({ userId: target.id });

      const after = await testPrisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after.active).toBe(false);

      const audits = await testPrisma.auditLog.findMany({
        where: { entityType: 'User', entityId: target.id, action: 'USER_DEACTIVATED' },
      });
      expect(audits).toHaveLength(1);
    });

    it('refuses to deactivate a user from another org', async () => {
      const orgA = await createOrg(testPrisma, 'OrgA');
      const orgB = await createOrg(testPrisma, 'OrgB');
      const adminA = await createUser(testPrisma, { orgId: orgA.id, role: 'ADMIN' });
      const targetB = await createUser(testPrisma, { orgId: orgB.id });

      await expect(asUser(adminA).users.deactivate({ userId: targetB.id })).rejects.toThrow();
    });
  });
});
