import { describe, it, expect, afterEach } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { trimAuditLog } from './audit-trim.worker';

describe('audit-trim', () => {
  const originalRetention = process.env.AUDIT_RETENTION_DAYS;

  afterEach(() => {
    if (originalRetention === undefined) delete process.env.AUDIT_RETENTION_DAYS;
    else process.env.AUDIT_RETENTION_DAYS = originalRetention;
  });

  it('deletes audit rows older than the retention window; keeps recent ones', async () => {
    // NOTE: trimAuditLog reads AUDIT_RETENTION_DAYS at import time via the
    // module-level const, so we can't override from the test. What we CAN
    // test: create rows at different ages and verify the cutoff-based
    // deletion behaviour using the real (180-day) default.
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });

    const now = new Date();
    const old = new Date(now);
    old.setDate(old.getDate() - 200); // well past 180-day retention
    const recent = new Date(now);
    recent.setDate(recent.getDate() - 30);

    await testPrisma.auditLog.create({
      data: {
        orgId: org.id,
        actorId: actor.id,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: 'old',
        createdAt: old,
      },
    });
    await testPrisma.auditLog.create({
      data: {
        orgId: org.id,
        actorId: actor.id,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: 'recent',
        createdAt: recent,
      },
    });

    const deleted = await trimAuditLog();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const survivors = await testPrisma.auditLog.findMany();
    expect(survivors).toHaveLength(1);
    expect(survivors[0]?.entityId).toBe('recent');
  });

  it('returns 0 when nothing is old enough', async () => {
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });
    await testPrisma.auditLog.create({
      data: {
        orgId: org.id,
        actorId: actor.id,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: 'fresh',
      },
    });

    const deleted = await trimAuditLog();
    expect(deleted).toBe(0);
  });
});
