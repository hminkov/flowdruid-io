import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above all imports, but its factory would see the
// outer `slackAdd` still uninitialized at that time. vi.hoisted runs
// eagerly so the stub is ready when the mock factory fires.
const { slackAdd } = vi.hoisted(() => ({
  slackAdd: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/queue', () => ({
  slackQueue: { add: slackAdd },
}));

import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';
import { encrypt } from '../lib/encrypt';

describe('tickets.update → Slack ticket.done', () => {
  beforeEach(() => {
    slackAdd.mockClear();
  });

  async function withSlackConfig(orgId: string, notifyDone: boolean) {
    await testPrisma.slackConfig.create({
      data: {
        orgId,
        botToken: encrypt('xoxb-test'),
        signingSecret: encrypt('secret'),
        notifyStandup: false,
        notifyLeave: false,
        notifyBlocker: false,
        notifyDone,
        notifyBroadcast: false,
      },
    });
  }

  it('enqueues a ticket.done job when status transitions to DONE and notifyDone is on', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    await withSlackConfig(org.id, true);

    const ticket = await testPrisma.ticket.create({
      data: { title: 'Fix thing', teamId: team.id, status: 'IN_PROGRESS' },
    });

    await asUser(dev).tickets.update({ ticketId: ticket.id, status: 'DONE' });

    expect(slackAdd).toHaveBeenCalledTimes(1);
    const [name, payload] = slackAdd.mock.calls[0]!;
    expect(name).toBe('ticket.done');
    expect(payload).toMatchObject({
      type: 'ticket.done',
      orgId: org.id,
      teamId: team.id,
      ticketTitle: 'Fix thing',
    });
  });

  it('does not re-enqueue when an already-DONE ticket is saved again', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    await withSlackConfig(org.id, true);

    const ticket = await testPrisma.ticket.create({
      data: { title: 'Already done', teamId: team.id, status: 'DONE' },
    });

    await asUser(dev).tickets.update({ ticketId: ticket.id, status: 'DONE' });

    expect(slackAdd).not.toHaveBeenCalled();
  });

  it('respects the notifyDone toggle being off', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });
    await withSlackConfig(org.id, false);

    const ticket = await testPrisma.ticket.create({
      data: { title: 'x', teamId: team.id, status: 'TODO' },
    });

    await asUser(dev).tickets.update({ ticketId: ticket.id, status: 'DONE' });

    expect(slackAdd).not.toHaveBeenCalled();
  });

  it('does nothing when the org has no SlackConfig at all', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const dev = await createUser(testPrisma, { orgId: org.id, teamId: team.id });

    const ticket = await testPrisma.ticket.create({
      data: { title: 'x', teamId: team.id, status: 'IN_PROGRESS' },
    });

    await asUser(dev).tickets.update({ ticketId: ticket.id, status: 'DONE' });

    expect(slackAdd).not.toHaveBeenCalled();
  });
});
