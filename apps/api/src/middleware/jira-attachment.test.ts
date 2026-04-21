import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { testPrisma } from '../test/setup';
import { encrypt } from '../lib/encrypt';
import { createOrg, createTeam, createUser } from '../test/fixtures';

function tokenFor(user: {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
  orgId: string;
  teamId: string | null;
}) {
  return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

describe('GET /api/jira/attachments/:ticketId/:attachmentId', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects without a token', async () => {
    const res = await request(app).get('/api/jira/attachments/abc/xyz');
    expect(res.status).toBe(401);
  });

  it('rejects a bogus token', async () => {
    const res = await request(app).get('/api/jira/attachments/abc/xyz?token=not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('404s when the ticket is not in the token-holder\'s org', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const teamB = await createTeam(testPrisma, orgB.id);
    const userA = await createUser(testPrisma, { orgId: orgA.id });
    const ticketB = await testPrisma.ticket.create({
      data: {
        source: 'JIRA',
        jiraKey: 'DW-1',
        title: 'x',
        teamId: teamB.id,
        jiraAttachments: [{ id: 'att1', filename: 'f.png', mimeType: 'image/png', size: 10, isImage: true }],
      },
    });

    const tok = tokenFor({
      id: userA.id, email: userA.email, name: userA.name, role: userA.role,
      orgId: orgA.id, teamId: null,
    });
    const res = await request(app).get(`/api/jira/attachments/${ticketB.id}/att1?token=${tok}`);
    expect(res.status).toBe(404);
  });

  it('404s when the attachment id is not in the ticket manifest', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id });
    const ticket = await testPrisma.ticket.create({
      data: {
        source: 'JIRA',
        jiraKey: 'DW-2',
        title: 'x',
        teamId: team.id,
        jiraAttachments: [{ id: 'real', filename: 'a.png', mimeType: 'image/png', size: 1, isImage: true }],
      },
    });

    const tok = tokenFor({
      id: user.id, email: user.email, name: user.name, role: user.role,
      orgId: org.id, teamId: null,
    });
    const res = await request(app).get(
      `/api/jira/attachments/${ticket.id}/nope?token=${tok}`,
    );
    expect(res.status).toBe(404);
  });

  it('503s when the org has no JiraConfig', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id });
    const ticket = await testPrisma.ticket.create({
      data: {
        source: 'JIRA',
        jiraKey: 'DW-3',
        title: 'x',
        teamId: team.id,
        jiraAttachments: [{ id: 'att', filename: 'a.png', mimeType: 'image/png', size: 1, isImage: true }],
      },
    });

    const tok = tokenFor({
      id: user.id, email: user.email, name: user.name, role: user.role,
      orgId: org.id, teamId: null,
    });
    const res = await request(app).get(
      `/api/jira/attachments/${ticket.id}/att?token=${tok}`,
    );
    expect(res.status).toBe(503);
  });

  it('streams upstream bytes through with the correct content-type', async () => {
    const org = await createOrg(testPrisma);
    const team = await createTeam(testPrisma, org.id);
    const user = await createUser(testPrisma, { orgId: org.id });
    await testPrisma.jiraConfig.create({
      data: {
        orgId: org.id,
        baseUrl: 'https://example.atlassian.net',
        email: 'svc@example.com',
        apiToken: encrypt('the-token'),
        projectKeys: [],
        syncInterval: 15,
      },
    });
    const ticket = await testPrisma.ticket.create({
      data: {
        source: 'JIRA',
        jiraKey: 'DW-4',
        title: 'x',
        teamId: team.id,
        jiraAttachments: [{ id: 'att1', filename: 'shot.png', mimeType: 'image/png', size: 4, isImage: true }],
      },
    });

    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(pngBytes, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }) as unknown as Response,
    );

    const tok = tokenFor({
      id: user.id, email: user.email, name: user.name, role: user.role,
      orgId: org.id, teamId: null,
    });
    const res = await request(app).get(
      `/api/jira/attachments/${ticket.id}/att1?token=${tok}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.body).toEqual(pngBytes);

    // Confirm upstream was called with Basic auth built from the encrypted token.
    const [url, opts] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://example.atlassian.net/rest/api/3/attachment/content/att1',
    );
    const auth = (opts as { headers: Record<string, string> }).headers.Authorization;
    expect(auth).toBe('Basic ' + Buffer.from('svc@example.com:the-token').toString('base64'));
  });
});
