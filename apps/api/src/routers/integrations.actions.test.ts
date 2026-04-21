import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authTest = vi.fn().mockResolvedValue({ ok: true, team: 'Acme', user: 'flowbot' });
const postMessage = vi.fn().mockResolvedValue({ ok: true });

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: { test: authTest },
    chat: { postMessage },
  })),
}));

// slackQueue.add is called by broadcastSlack; stub the queue to avoid Redis.
vi.mock('../lib/queue', () => ({
  slackQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { testPrisma } from '../test/setup';
import { encrypt } from '../lib/encrypt';
import { createOrg, createTeam, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('integrations: testSlack / testJira / broadcastSlack', () => {
  beforeEach(() => {
    authTest.mockClear();
    postMessage.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('testSlack', () => {
    it('invokes auth.test with the decrypted bot token and returns team info', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      await testPrisma.slackConfig.create({
        data: {
          orgId: org.id,
          botToken: encrypt('xoxb-token'),
          signingSecret: encrypt('sec'),
        },
      });

      const result = await asUser(admin).integrations.testSlack();
      expect(result).toMatchObject({ success: true, team: 'Acme', bot: 'flowbot' });
      expect(authTest).toHaveBeenCalled();
    });

    it('raises BAD_REQUEST when no SlackConfig exists', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      await expect(asUser(admin).integrations.testSlack()).rejects.toThrow();
    });
  });

  describe('testJira', () => {
    it('hits /rest/api/3/project/search via Basic auth built from stored creds', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        // Modern Jira Cloud returns a { values, total } envelope.
        new Response(
          JSON.stringify({ values: [{ key: 'DW', name: 'Deposit Withdrawal' }], total: 1 }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ) as unknown as Response,
      );

      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      await testPrisma.jiraConfig.create({
        data: {
          orgId: org.id,
          baseUrl: 'https://acme.atlassian.net',
          email: 'svc@acme.com',
          apiToken: encrypt('atlassian-token'),
          projectKeys: [],
          syncInterval: 15,
        },
      });

      const result = await asUser(admin).integrations.testJira();
      expect(result.success).toBe(true);
      expect(result.projects).toEqual([{ key: 'DW', name: 'Deposit Withdrawal' }]);
      expect(result.total).toBe(1);

      // Confirm the call was Basic-auth'd with the decrypted token.
      expect(fetchSpy).toHaveBeenCalled();
      const [url, opts] = fetchSpy.mock.calls[0]!;
      expect(String(url)).toMatch(/\/rest\/api\/3\/project\/search/);
      const auth = (opts as { headers: Record<string, string> }).headers.Authorization;
      expect(auth).toMatch(/^Basic /);
      const decoded = Buffer.from(auth.slice(6), 'base64').toString();
      expect(decoded).toBe('svc@acme.com:atlassian-token');
    });

    it('returns BAD_REQUEST on non-2xx from Jira', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 }) as unknown as Response,
      );
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      await testPrisma.jiraConfig.create({
        data: {
          orgId: org.id,
          baseUrl: 'https://acme.atlassian.net',
          email: 'svc@acme.com',
          apiToken: encrypt('bad'),
          projectKeys: [],
          syncInterval: 15,
        },
      });

      await expect(asUser(admin).integrations.testJira()).rejects.toThrow(/Jira test failed/i);
    });
  });

  describe('broadcastSlack', () => {
    it('enqueues one job per team with a slackChannelId + writes BROADCAST_SENT audit', async () => {
      const { slackQueue } = await import('../lib/queue');
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      // Two teams with channels, one without.
      await createTeam(testPrisma, org.id, 'TeamA');
      await testPrisma.team.create({
        data: { name: 'TeamB', orgId: org.id, slackChannelId: 'C-B' },
      });
      await testPrisma.team.create({
        data: { name: 'TeamC', orgId: org.id, slackChannelId: 'C-C' },
      });

      const result = await asUser(admin).integrations.broadcastSlack({
        message: 'Office closed Monday',
      });
      expect(result.success).toBe(true);
      expect(result.channelCount).toBe(2);
      expect(slackQueue.add).toHaveBeenCalledTimes(2);

      const audit = await testPrisma.auditLog.findFirstOrThrow({
        where: { action: 'BROADCAST_SENT' },
      });
      const after = audit.after as Record<string, unknown>;
      expect(after.channelCount).toBe(2);
      expect(after.message).toBe('Office closed Monday');
    });

    it('rejects non-admin', async () => {
      const org = await createOrg(testPrisma);
      const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
      await expect(
        asUser(lead).integrations.broadcastSlack({ message: 'x' }),
      ).rejects.toThrow();
    });
  });
});
