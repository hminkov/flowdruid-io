import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('teams.router', () => {
  it('create writes a Team and a TEAM_CREATED audit row', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

    const team = await asUser(admin).teams.create({
      name: 'Platform',
      slackChannelId: 'C0123',
    });

    expect(team.name).toBe('Platform');
    expect(team.slackChannelId).toBe('C0123');
    expect(team.orgId).toBe(org.id);

    const audits = await testPrisma.auditLog.findMany({
      where: { action: 'TEAM_CREATED', entityId: team.id },
    });
    expect(audits).toHaveLength(1);
  });

  it('rejects non-admin create', async () => {
    const org = await createOrg(testPrisma);
    const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
    await expect(asUser(lead).teams.create({ name: 'x' })).rejects.toThrow(TRPCError);
  });

  it('delete removes the team and writes TEAM_DELETED audit row', async () => {
    const org = await createOrg(testPrisma);
    const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
    const team = await testPrisma.team.create({ data: { orgId: org.id, name: 'Gone' } });

    await asUser(admin).teams.delete({ teamId: team.id });

    const gone = await testPrisma.team.findUnique({ where: { id: team.id } });
    expect(gone).toBeNull();
    const audit = await testPrisma.auditLog.findFirstOrThrow({
      where: { action: 'TEAM_DELETED', entityId: team.id },
    });
    expect(audit.before).toMatchObject({ name: 'Gone' });
  });

  it('list is scoped to the caller org', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    await testPrisma.team.create({ data: { orgId: orgA.id, name: 'A-team' } });
    await testPrisma.team.create({ data: { orgId: orgB.id, name: 'B-team' } });
    const userA = await createUser(testPrisma, { orgId: orgA.id });

    const teams = await asUser(userA).teams.list();
    expect(teams).toHaveLength(1);
    expect(teams[0]?.name).toBe('A-team');
  });
});
