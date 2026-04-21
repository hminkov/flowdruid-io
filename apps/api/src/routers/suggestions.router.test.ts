import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

async function setup() {
  const org = await createOrg(testPrisma);
  const team = await createTeam(testPrisma, org.id);
  const lead = await createUser(testPrisma, { orgId: org.id, teamId: team.id, role: 'TEAM_LEAD' });
  const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
  const target = await createUser(testPrisma, { orgId: org.id, teamId: team.id, name: 'Target' });
  const ticket = await testPrisma.ticket.create({
    data: { title: 't', teamId: team.id, source: 'INTERNAL', status: 'TODO' },
  });
  return { org, team, lead, dev, target, ticket };
}

describe('suggestions.router', () => {
  it('create persists a suggestion with requester + target + reason', async () => {
    const { ticket, lead, target } = await setup();

    const s = await asUser(lead).suggestions.create({
      ticketId: ticket.id,
      suggestedUserId: target.id,
      reason: 'knows the payments flow',
    });

    expect(s.ticketId).toBe(ticket.id);
    expect(s.suggestedUserId).toBe(target.id);
    expect(s.requestedBy).toBe(lead.id);
    expect(s.reason).toBe('knows the payments flow');
    expect(s.suggestedUser.name).toBe('Target');
  });

  it('rejects a duplicate suggestion from the same requester', async () => {
    const { ticket, lead, target } = await setup();

    await asUser(lead).suggestions.create({
      ticketId: ticket.id,
      suggestedUserId: target.id,
      reason: 'one',
    });
    await expect(
      asUser(lead).suggestions.create({
        ticketId: ticket.id,
        suggestedUserId: target.id,
        reason: 'two',
      }),
    ).rejects.toThrow(/already suggested/i);
  });

  it('allows two different people to suggest the same target', async () => {
    const { ticket, lead, dev, target } = await setup();

    await asUser(lead).suggestions.create({
      ticketId: ticket.id,
      suggestedUserId: target.id,
    });
    const second = await asUser(dev).suggestions.create({
      ticketId: ticket.id,
      suggestedUserId: target.id,
    });
    expect(second.requestedBy).toBe(dev.id);

    const all = await testPrisma.assignmentSuggestion.findMany({ where: { ticketId: ticket.id } });
    expect(all).toHaveLength(2);
  });

  it('refuses suggesting a user from another org', async () => {
    const { ticket, lead } = await setup();
    const otherOrg = await createOrg(testPrisma, 'Other');
    const outsider = await createUser(testPrisma, { orgId: otherOrg.id });

    await expect(
      asUser(lead).suggestions.create({ ticketId: ticket.id, suggestedUserId: outsider.id }),
    ).rejects.toThrow(/Suggested user not found/i);
  });

  it('refuses if the ticket does not belong to the caller org', async () => {
    const setupA = await setup();
    const otherOrg = await createOrg(testPrisma, 'Other');
    const otherTeam = await createTeam(testPrisma, otherOrg.id);
    const outsider = await createUser(testPrisma, { orgId: otherOrg.id, teamId: otherTeam.id });

    await expect(
      asUser(outsider).suggestions.create({
        ticketId: setupA.ticket.id,
        suggestedUserId: setupA.target.id,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it('list returns suggestions newest-first for the ticket', async () => {
    const { ticket, lead, dev, target } = await setup();

    await asUser(lead).suggestions.create({ ticketId: ticket.id, suggestedUserId: target.id });
    // Small delay so createdAt order is deterministic.
    await new Promise((r) => setTimeout(r, 10));
    await asUser(dev).suggestions.create({ ticketId: ticket.id, suggestedUserId: target.id });

    const listed = await asUser(lead).suggestions.list({ ticketId: ticket.id });
    expect(listed).toHaveLength(2);
    expect(listed[0]!.requestedBy).toBe(dev.id); // newer first
    expect(listed[1]!.requestedBy).toBe(lead.id);
  });

  it('list refuses a cross-org ticket', async () => {
    const { ticket } = await setup();
    const otherOrg = await createOrg(testPrisma, 'Other');
    const outsider = await createUser(testPrisma, { orgId: otherOrg.id });

    await expect(
      asUser(outsider).suggestions.list({ ticketId: ticket.id }),
    ).rejects.toThrow();
  });
});
