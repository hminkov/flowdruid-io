import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { audit } from './audit';

describe('lib/audit', () => {
  it('persists an audit row with the actor + action', async () => {
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });

    await audit(
      { prisma: testPrisma, user: { id: actor.id, orgId: org.id } },
      'USER_ROLE_CHANGED',
      'User',
      actor.id,
      { before: { role: 'DEVELOPER' }, after: { role: 'ADMIN' } },
    );

    const rows = await testPrisma.auditLog.findMany({ where: { orgId: org.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(actor.id);
    expect(rows[0]?.action).toBe('USER_ROLE_CHANGED');
    expect(rows[0]?.before).toEqual({ role: 'DEVELOPER' });
    expect(rows[0]?.after).toEqual({ role: 'ADMIN' });
  });

  it('redacts token / secret / password fields from before + after snapshots', async () => {
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });

    await audit(
      { prisma: testPrisma, user: { id: actor.id, orgId: org.id } },
      'SLACK_CONFIG_UPDATED',
      'SlackConfig',
      'stub',
      {
        before: { botToken: 'xoxb-leak', signingSecret: 'shhh', notifyLeave: true },
        after: {
          passwordHash: '$2a$10$realhash',
          apiToken: 'api-leak',
          secret: 'double-secret',
          nested: { refreshToken: 'nested-leak', fine: 'visible' },
          array: [{ accessToken: 'arr-leak' }, 'plain-string'],
        },
      },
    );

    const row = await testPrisma.auditLog.findFirstOrThrow({
      where: { entityType: 'SlackConfig' },
    });
    const before = row.before as Record<string, unknown>;
    const after = row.after as Record<string, unknown>;

    expect(before.botToken).toBe('[redacted]');
    expect(before.signingSecret).toBe('[redacted]');
    expect(before.notifyLeave).toBe(true); // non-sensitive passes through

    expect(after.passwordHash).toBe('[redacted]');
    expect(after.apiToken).toBe('[redacted]');
    expect(after.secret).toBe('[redacted]');
    const nested = after.nested as Record<string, unknown>;
    expect(nested.refreshToken).toBe('[redacted]');
    expect(nested.fine).toBe('visible');
    const array = after.array as Array<Record<string, unknown>>;
    expect(array[0]?.accessToken).toBe('[redacted]');
    expect(array[1]).toBe('plain-string'); // non-object in array untouched
  });

  it('persists reason when given', async () => {
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });

    await audit(
      { prisma: testPrisma, user: { id: actor.id, orgId: org.id } },
      'LEAVE_DENIED',
      'LeaveRequest',
      'stub',
      { reason: 'overlapping approved leave' },
    );

    const row = await testPrisma.auditLog.findFirstOrThrow({ where: { action: 'LEAVE_DENIED' } });
    expect(row.reason).toBe('overlapping approved leave');
  });

  it('works inside an interactive transaction (TransactionClient)', async () => {
    const org = await createOrg(testPrisma);
    const actor = await createUser(testPrisma, { orgId: org.id });

    await testPrisma.$transaction(async (tx) => {
      await audit(
        { prisma: tx, user: { id: actor.id, orgId: org.id } },
        'USER_CREATED',
        'User',
        'test',
        { after: { email: 'x@y.com' } },
      );
    });

    const rows = await testPrisma.auditLog.findMany({ where: { action: 'USER_CREATED' } });
    expect(rows).toHaveLength(1);
  });
});
