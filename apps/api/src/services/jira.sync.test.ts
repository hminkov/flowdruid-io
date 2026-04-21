import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapJiraStatus, mapJiraPriority, stripAdf, syncJiraTickets } from './jira.sync';
import { encrypt } from '../lib/encrypt';
import { testPrisma } from '../test/setup';
import { createOrg, createTeam, createUser } from '../test/fixtures';

describe('jira.sync status mapping', () => {
  it('maps the canonical Jira statuses', () => {
    expect(mapJiraStatus('To Do')).toBe('TODO');
    expect(mapJiraStatus('Open')).toBe('TODO');
    expect(mapJiraStatus('Backlog')).toBe('TODO');
    expect(mapJiraStatus('In Progress')).toBe('IN_PROGRESS');
    expect(mapJiraStatus('In Review')).toBe('IN_REVIEW');
    expect(mapJiraStatus('Code Review')).toBe('IN_REVIEW');
    expect(mapJiraStatus('Done')).toBe('DONE');
    expect(mapJiraStatus('Closed')).toBe('DONE');
    expect(mapJiraStatus('Resolved')).toBe('DONE');
  });

  it('is case-insensitive', () => {
    expect(mapJiraStatus('IN PROGRESS')).toBe('IN_PROGRESS');
    expect(mapJiraStatus('done')).toBe('DONE');
  });

  it('falls back to TODO for unknown statuses', () => {
    expect(mapJiraStatus('In QA Limbo')).toBe('TODO');
    expect(mapJiraStatus('')).toBe('TODO');
  });
});

describe('jira.sync priority mapping', () => {
  it('maps known priorities', () => {
    expect(mapJiraPriority('Highest')).toBe('HIGH');
    expect(mapJiraPriority('High')).toBe('HIGH');
    expect(mapJiraPriority('Medium')).toBe('MEDIUM');
    expect(mapJiraPriority('Low')).toBe('LOW');
    expect(mapJiraPriority('Lowest')).toBe('LOW');
  });

  it('defaults unknown values to LOW', () => {
    expect(mapJiraPriority('P1')).toBe('LOW');
    expect(mapJiraPriority('')).toBe('LOW');
  });
});

describe('jira.sync ADF stripping', () => {
  it('concatenates inline text nodes within a paragraph (no added spaces)', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'world' },
          ],
        },
      ],
    };
    expect(stripAdf(adf)).toBe('Hello world');
  });

  it('separates paragraphs with blank lines', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
      ],
    };
    expect(stripAdf(adf)).toBe('first\n\nsecond');
  });

  it('renders bullet lists with "- " prefixes', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] },
          ],
        },
      ],
    };
    expect(stripAdf(adf)).toContain('- a');
    expect(stripAdf(adf)).toContain('- b');
  });

  it('emits a placeholder for image/media nodes', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'mediaSingle',
          content: [{ type: 'media', attrs: { alt: 'login-screen.png' } }],
        },
      ],
    };
    expect(stripAdf(adf)).toContain('[📎 login-screen.png]');
  });

  it('returns empty string for null / undefined / malformed input', () => {
    expect(stripAdf(null)).toBe('');
    expect(stripAdf(undefined)).toBe('');
    expect(stripAdf('plain string')).toBe('');
    expect(stripAdf({})).toBe('');
  });
});

describe('syncJiraTickets end-to-end', () => {
  // The global fetch type overloads defeat ReturnType<typeof vi.spyOn>,
  // so type this as any-ish and narrow via mock calls below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function seedConfig() {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    await testPrisma.jiraConfig.create({
      data: {
        orgId: org.id,
        baseUrl: 'https://example.atlassian.net',
        email: 'svc@example.com',
        apiToken: encrypt('fake-token'),
        projectKeys: ['DW'],
        syncInterval: 15,
      },
    });
    return { org, team };
  }

  function mockJiraResponse(issues: unknown[]) {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ issues }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }) as unknown as Response,
    );
  }

  it('upserts new Jira tickets into the local Ticket table', async () => {
    const { org } = await seedConfig();
    mockJiraResponse([
      {
        id: '10001',
        key: 'DW-1',
        fields: {
          summary: 'Withdrawal fee bug',
          description: null,
          status: { name: 'In Progress' },
          priority: { name: 'High' },
        },
      },
    ]);

    await syncJiraTickets(org.id);

    const tickets = await testPrisma.ticket.findMany();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.jiraKey).toBe('DW-1');
    expect(tickets[0]?.status).toBe('IN_PROGRESS');
    expect(tickets[0]?.priority).toBe('HIGH');
  });

  it('updates status + priority on repeat sync', async () => {
    const { org } = await seedConfig();
    mockJiraResponse([
      {
        id: '10001',
        key: 'DW-1',
        fields: {
          summary: 'Title v1',
          description: null,
          status: { name: 'To Do' },
          priority: { name: 'Low' },
        },
      },
    ]);
    await syncJiraTickets(org.id);

    mockJiraResponse([
      {
        id: '10001',
        key: 'DW-1',
        fields: {
          summary: 'Title v2',
          description: null,
          status: { name: 'Done' },
          priority: { name: 'Highest' },
        },
      },
    ]);
    await syncJiraTickets(org.id);

    const tickets = await testPrisma.ticket.findMany();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.title).toBe('Title v2');
    expect(tickets[0]?.status).toBe('DONE');
    expect(tickets[0]?.priority).toBe('HIGH');
  });

  it('mirrors Jira assignee into TicketAssignment by email', async () => {
    const { org, team } = await seedConfig();
    const dev = await createUser(testPrisma, {
      orgId: org.id,
      teamId: team.id,
      email: 'dev@example.com',
    });

    mockJiraResponse([
      {
        id: '10002',
        key: 'DW-2',
        fields: {
          summary: 't',
          description: null,
          status: { name: 'In Progress' },
          priority: { name: 'Medium' },
          assignee: {
            accountId: 'abc',
            displayName: 'Dev',
            emailAddress: 'dev@example.com',
          },
        },
      },
    ]);

    await syncJiraTickets(org.id);

    const assignments = await testPrisma.ticketAssignment.findMany();
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.userId).toBe(dev.id);
  });

  it('clears local assignments when Jira unassigns', async () => {
    const { org, team } = await seedConfig();
    const dev = await createUser(testPrisma, {
      orgId: org.id,
      teamId: team.id,
      email: 'dev@example.com',
    });

    mockJiraResponse([
      {
        id: '10003',
        key: 'DW-3',
        fields: {
          summary: 'a',
          description: null,
          status: { name: 'To Do' },
          priority: { name: 'Low' },
          assignee: {
            accountId: 'abc',
            displayName: 'Dev',
            emailAddress: 'dev@example.com',
          },
        },
      },
    ]);
    await syncJiraTickets(org.id);

    mockJiraResponse([
      {
        id: '10003',
        key: 'DW-3',
        fields: {
          summary: 'a',
          description: null,
          status: { name: 'To Do' },
          priority: { name: 'Low' },
          assignee: null,
        },
      },
    ]);
    await syncJiraTickets(org.id);

    const assignments = await testPrisma.ticketAssignment.findMany({
      where: { userId: dev.id },
    });
    expect(assignments).toHaveLength(0);
  });

  it('skips assignment when Jira email does not match any User', async () => {
    const { org } = await seedConfig();
    mockJiraResponse([
      {
        id: '10004',
        key: 'DW-4',
        fields: {
          summary: 'orphan',
          description: null,
          status: { name: 'To Do' },
          priority: { name: 'Low' },
          assignee: {
            accountId: 'abc',
            displayName: 'Unknown',
            emailAddress: 'nobody@example.com',
          },
        },
      },
    ]);

    await syncJiraTickets(org.id);
    const assignments = await testPrisma.ticketAssignment.findMany();
    expect(assignments).toHaveLength(0);
    const tickets = await testPrisma.ticket.findMany();
    expect(tickets).toHaveLength(1); // ticket still synced
  });

  it('persists lastSyncAt after a run', async () => {
    const { org } = await seedConfig();
    mockJiraResponse([]);
    await syncJiraTickets(org.id);
    const cfg = await testPrisma.jiraConfig.findUnique({ where: { orgId: org.id } });
    expect(cfg?.lastSyncAt).toBeInstanceOf(Date);
  });

  it('no-ops when org has no JiraConfig', async () => {
    const org = await createOrg(testPrisma);
    await syncJiraTickets(org.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
