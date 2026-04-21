import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';
import { decrypt } from '../lib/encrypt';

describe('integrations.router', () => {
  describe('saveSlackConfig', () => {
    it('encrypts tokens at rest and writes SLACK_CONFIG_UPDATED audit row', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      await asUser(admin).integrations.saveSlackConfig({
        botToken: 'xoxb-real-looking',
        signingSecret: 'shh-secret',
        notifyStandup: true,
        notifyLeave: true,
        notifyBlocker: false,
        notifyDone: false,
        notifyBroadcast: true,
      });

      const row = await testPrisma.slackConfig.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(decrypt(row.botToken)).toBe('xoxb-real-looking');
      expect(decrypt(row.signingSecret)).toBe('shh-secret');
      expect(row.notifyStandup).toBe(true);
      expect(row.notifyBroadcast).toBe(true);

      const audits = await testPrisma.auditLog.findMany({
        where: { action: 'SLACK_CONFIG_UPDATED' },
      });
      expect(audits).toHaveLength(1);
      // Token fields must NOT be in the audit snapshot — redaction is
      // enforced by the helper's SENSITIVE_KEYS walker.
      const after = audits[0]?.after as Record<string, unknown>;
      expect(after.botToken).toBeUndefined();
      expect(after.signingSecret).toBeUndefined();
      expect(after.notifyLeave).toBe(true);
    });

    it('is idempotent on repeated save (upsert)', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      const payload = {
        botToken: 'xoxb-a',
        signingSecret: 'sec-a',
        notifyStandup: true,
        notifyLeave: true,
        notifyBlocker: true,
        notifyDone: false,
        notifyBroadcast: false,
      };
      await asUser(admin).integrations.saveSlackConfig(payload);
      await asUser(admin).integrations.saveSlackConfig({
        ...payload,
        botToken: 'xoxb-b',
        notifyDone: true,
      });

      const row = await testPrisma.slackConfig.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(decrypt(row.botToken)).toBe('xoxb-b');
      expect(row.notifyDone).toBe(true);
    });

    it('updates toggles only — preserves existing tokens when none are sent', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      await asUser(admin).integrations.saveSlackConfig({
        botToken: 'xoxb-original',
        signingSecret: 'sign-original',
        notifyStandup: true,
        notifyLeave: true,
        notifyBlocker: true,
        notifyDone: false,
        notifyBroadcast: true,
      });

      // Second save omits both tokens — as the UI does when the admin
      // only toggles a notification flag. Must not wipe creds and must
      // not throw on encrypt(undefined) in the upsert-create branch.
      await asUser(admin).integrations.saveSlackConfig({
        notifyStandup: false,
        notifyLeave: true,
        notifyBlocker: true,
        notifyDone: true,
        notifyBroadcast: true,
      });

      const row = await testPrisma.slackConfig.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(decrypt(row.botToken)).toBe('xoxb-original');
      expect(decrypt(row.signingSecret)).toBe('sign-original');
      expect(row.notifyStandup).toBe(false);
      expect(row.notifyDone).toBe(true);
    });

    it('rejects the first save if tokens are missing', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      await expect(
        asUser(admin).integrations.saveSlackConfig({
          notifyStandup: true,
          notifyLeave: true,
          notifyBlocker: true,
          notifyDone: false,
          notifyBroadcast: true,
        }),
      ).rejects.toThrow(/required for the first Slack connection/i);
    });

    it('rejects non-admin callers', async () => {
      const org = await createOrg(testPrisma);
      const lead = await createUser(testPrisma, { orgId: org.id, role: 'TEAM_LEAD' });
      await expect(
        asUser(lead).integrations.saveSlackConfig({
          botToken: 'x',
          signingSecret: 'y',
          notifyStandup: true,
          notifyLeave: true,
          notifyBlocker: true,
          notifyDone: false,
          notifyBroadcast: false,
        }),
      ).rejects.toThrow();
    });
  });

  describe('getSlackConfig', () => {
    it('returns masked tokens, never raw', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      await asUser(admin).integrations.saveSlackConfig({
        botToken: 'xoxb-1234567890',
        signingSecret: 'signsignsignABCD',
        notifyStandup: true,
        notifyLeave: true,
        notifyBlocker: true,
        notifyDone: false,
        notifyBroadcast: false,
      });

      const result = await asUser(admin).integrations.getSlackConfig();
      expect(result).toBeTruthy();
      // Implementation returns '••••••' + last 4 of the decrypted value.
      expect(result!.botToken).not.toBe('xoxb-1234567890');
      expect(result!.botToken).toContain('7890');
      expect(result!.signingSecret).toContain('ABCD');
    });

    it('returns null when no config exists', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });
      const result = await asUser(admin).integrations.getSlackConfig();
      expect(result).toBeNull();
    });
  });

  describe('saveJiraConfig', () => {
    it('encrypts apiToken and writes audit row (token redacted)', async () => {
      const org = await createOrg(testPrisma);
      const admin = await createUser(testPrisma, { orgId: org.id, role: 'ADMIN' });

      await asUser(admin).integrations.saveJiraConfig({
        baseUrl: 'https://example.atlassian.net',
        email: 'svc@example.com',
        apiToken: 'atlassian-token',
        projectKeys: ['DW', 'AC'],
        syncInterval: 30,
      });

      const row = await testPrisma.jiraConfig.findUniqueOrThrow({ where: { orgId: org.id } });
      expect(decrypt(row.apiToken)).toBe('atlassian-token');
      expect(row.projectKeys).toEqual(['DW', 'AC']);
      expect(row.syncInterval).toBe(30);

      const audit = await testPrisma.auditLog.findFirstOrThrow({
        where: { action: 'JIRA_CONFIG_UPDATED' },
      });
      const after = audit.after as Record<string, unknown>;
      expect(after.apiToken).toBeUndefined(); // redacted
      expect(after.baseUrl).toBe('https://example.atlassian.net');
    });
  });
});
