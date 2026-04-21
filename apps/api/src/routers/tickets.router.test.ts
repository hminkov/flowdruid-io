import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('tickets.router', () => {
  it('create makes an INTERNAL ticket with assignees', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const ticket = await asUser(lead).tickets.create({
      title: 'Ship the thing',
      teamId: team.id,
      priority: 'HIGH',
      assigneeIds: [dev.id],
    });

    expect(ticket.source).toBe('INTERNAL');
    expect(ticket.status).toBe('TODO');
    expect(ticket.priority).toBe('HIGH');
    expect(ticket.assignees).toHaveLength(1);
    expect(ticket.assignees[0]?.user.id).toBe(dev.id);
  });

  it('update transitions status and persists', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const ticket = await testPrisma.ticket.create({
      data: { title: 'x', teamId: team.id, source: 'INTERNAL', status: 'TODO' },
    });

    await asUser(dev).tickets.update({ ticketId: ticket.id, status: 'IN_PROGRESS' });
    const after = await testPrisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe('IN_PROGRESS');
  });

  it('update refuses cross-org', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const teamA = await createTeam(testPrisma, orgA.id);
    const teamB = await createTeam(testPrisma, orgB.id);
    const devA = await createUser(testPrisma, { orgId: orgA.id, teamId: teamA.id });
    const ticketB = await testPrisma.ticket.create({
      data: { title: 'x', teamId: teamB.id, source: 'INTERNAL', status: 'TODO' },
    });

    await expect(
      asUser(devA).tickets.update({ ticketId: ticketB.id, status: 'DONE' }),
    ).rejects.toThrow();
  });

  it('delete refuses Jira-sourced tickets', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const jira = await testPrisma.ticket.create({
      data: {
        title: 'synced',
        teamId: team.id,
        source: 'JIRA',
        jiraKey: 'DW-999',
        status: 'TODO',
      },
    });

    await expect(asUser(dev).tickets.delete({ ticketId: jira.id })).rejects.toThrow(
      /Cannot delete Jira/i,
    );
    const still = await testPrisma.ticket.findUnique({ where: { id: jira.id } });
    expect(still).not.toBeNull();
  });

  it('delete of internal ticket writes TICKET_DELETED audit + removes assignments', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const ticket = await testPrisma.ticket.create({
      data: { title: 'gone', teamId: team.id, source: 'INTERNAL', status: 'TODO' },
    });
    await testPrisma.ticketAssignment.create({ data: { ticketId: ticket.id, userId: dev.id } });

    await asUser(dev).tickets.delete({ ticketId: ticket.id });

    const gone = await testPrisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(gone).toBeNull();
    const assignments = await testPrisma.ticketAssignment.findMany({
      where: { ticketId: ticket.id },
    });
    expect(assignments).toHaveLength(0);
    const audits = await testPrisma.auditLog.findMany({
      where: { action: 'TICKET_DELETED', entityId: ticket.id },
    });
    expect(audits).toHaveLength(1);
  });

  it('assign + unassign round-trip writes audit rows', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const other = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    const ticket = await testPrisma.ticket.create({
      data: { title: 't', teamId: team.id, source: 'INTERNAL', status: 'TODO' },
    });

    await asUser(dev).tickets.assign({
      ticketId: ticket.id,
      userId: other.id,
      action: 'assign',
    });
    let assignments = await testPrisma.ticketAssignment.findMany({
      where: { ticketId: ticket.id },
    });
    expect(assignments).toHaveLength(1);

    await asUser(dev).tickets.assign({
      ticketId: ticket.id,
      userId: other.id,
      action: 'unassign',
    });
    assignments = await testPrisma.ticketAssignment.findMany({ where: { ticketId: ticket.id } });
    expect(assignments).toHaveLength(0);

    const audits = await testPrisma.auditLog.findMany({
      where: { action: 'TICKET_REASSIGNED', entityId: ticket.id },
    });
    expect(audits).toHaveLength(2);
  });

  it('rejects unauthenticated callers on protected procedures', async () => {
    await expect(asUser().tickets.list({})).rejects.toThrow(TRPCError);
  });
});
