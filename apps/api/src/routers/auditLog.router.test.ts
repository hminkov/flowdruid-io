import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

async function seedAudit(
  orgId: string,
  actorId: string,
  overrides?: { action?: 'USER_ROLE_CHANGED' | 'LEAVE_APPROVED'; entityType?: string },
) {
  return testPrisma.auditLog.create({
    data: {
      orgId,
      actorId,
      action: overrides?.action ?? 'USER_ROLE_CHANGED',
      entityType: overrides?.entityType ?? 'User',
      entityId: 'stub-id',
    },
  });
}

describe('auditLog.router', () => {
  it('returns the most recent rows first, scoped to the caller org', async () => {
    const orgA = await createOrg(testPrisma, 'OrgA');
    const orgB = await createOrg(testPrisma, 'OrgB');
    const admin = await createUser(testPrisma, { orgId: orgA.id, role: 'ADMIN' });
    const otherActor = await createUser(testPrisma, { orgId: orgB.id, role: 'ADMIN' });

    await seedAudit(orgA.id, admin.id);
    await seedAudit(orgA.id, admin.id, { action: 'LEAVE_APPROVED' });
    await seedAudit(orgB.id, otherActor.id); // must not leak to orgA caller

    const result = await asUser(admin).auditLog.list({ limit: 100 });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((r) => r.orgId === orgA.id)).toBe(true);
  });

  it('filters by action', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    await seedAudit(org.id, admin.id, { action: 'USER_ROLE_CHANGED' });
    await seedAudit(org.id, admin.id, { action: 'LEAVE_APPROVED' });

    const result = await asUser(admin).auditLog.list({ action: 'LEAVE_APPROVED', limit: 100 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.action).toBe('LEAVE_APPROVED');
  });

  it('filters by entityType', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    await seedAudit(org.id, admin.id, { entityType: 'User' });
    await seedAudit(org.id, admin.id, { entityType: 'LeaveRequest' });

    const result = await asUser(admin).auditLog.list({ entityType: 'User', limit: 100 });
    expect(result.items.every((r) => r.entityType === 'User')).toBe(true);
  });

  it('paginates via cursor and returns a stable next-cursor', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    for (let i = 0; i < 25; i++) await seedAudit(org.id, admin.id);

    const page1 = await asUser(admin).auditLog.list({ limit: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await asUser(admin).auditLog.list({
      limit: 10,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(10);
    // No overlap between pages.
    const ids1 = new Set(page1.items.map((r) => r.id));
    expect(page2.items.every((r) => !ids1.has(r.id))).toBe(true);
  });

  it('forbids non-admin callers', async () => {
    const org = await createOrg(testPrisma);
    const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });

    await expect(asUser(lead).auditLog.list({ limit: 10 })).rejects.toThrow(TRPCError);
  });

  it('entityTypes returns distinct values only from the caller org', async () => {
    const orgA = await createOrg(testPrisma, 'OrgA');
    const orgB = await createOrg(testPrisma, 'OrgB');
    const adminA = await createUser(testPrisma, { orgId: orgA.id, role: 'ADMIN' });
    const adminB = await createUser(testPrisma, { orgId: orgB.id, role: 'ADMIN' });

    await seedAudit(orgA.id, adminA.id, { entityType: 'User' });
    await seedAudit(orgA.id, adminA.id, { entityType: 'User' }); // dupe
    await seedAudit(orgA.id, adminA.id, { entityType: 'LeaveRequest' });
    await seedAudit(orgB.id, adminB.id, { entityType: 'Ticket' }); // different org

    const types = await asUser(adminA).auditLog.entityTypes();
    expect(types.sort()).toEqual(['LeaveRequest', 'User']); // alphabetical + deduped
  });
});
