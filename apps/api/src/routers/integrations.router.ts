import { TRPCError } from '@trpc/server';
import { saveSlackConfigSchema, saveJiraConfigSchema, broadcastSlackSchema } from '@flowdruid/shared';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { encrypt, decrypt } from '../lib/encrypt';
import { slackQueue } from '../lib/queue';
import { audit } from '../lib/audit';

export const integrationsRouter = router({
  // Public to every authenticated user — it's just project keys + names,
  // no secrets. Used by the Tasks page dropdown so non-admins can filter
  // by project too. Returns the configured projects only (what the org
  // actually synced), not every project in Jira.
  listJiraProjects: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.jiraConfig.findUnique({
      where: { orgId: ctx.user.orgId },
      select: { projectKeys: true, projectNames: true },
    });
    if (!config) return [];
    const names = (config.projectNames ?? {}) as Record<string, string>;
    return config.projectKeys.map((key) => ({ key, name: names[key] ?? key }));
  }),

  // Returns the configured Jira instance URL for building deep links
  // (Open in Jira buttons on ticket cards/modals). No secrets.
  jiraBaseUrl: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.jiraConfig.findUnique({
      where: { orgId: ctx.user.orgId },
      select: { baseUrl: true },
    });
    if (!config) return null;
    return config.baseUrl.replace(/\/+$/, '');
  }),

  getSlackConfig: adminProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.slackConfig.findUnique({
      where: { orgId: ctx.user.orgId },
    });
    if (!config) return null;

    return {
      ...config,
      botToken: '••••••' + decrypt(config.botToken).slice(-4),
      signingSecret: '••••••' + decrypt(config.signingSecret).slice(-4),
    };
  }),

  saveSlackConfig: adminProcedure.input(saveSlackConfigSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const before = await tx.slackConfig.findUnique({ where: { orgId: ctx.user.orgId } });

      // First-time save must include both secrets; updates can omit them
      // (admin is only toggling notification flags).
      if (!before && (!input.botToken || !input.signingSecret)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bot token and signing secret are required for the first Slack connection',
        });
      }

      const data = {
        ...(input.botToken ? { botToken: encrypt(input.botToken) } : {}),
        ...(input.signingSecret ? { signingSecret: encrypt(input.signingSecret) } : {}),
        notifyStandup: input.notifyStandup,
        notifyLeave: input.notifyLeave,
        notifyBlocker: input.notifyBlocker,
        notifyDone: input.notifyDone,
        notifyBroadcast: input.notifyBroadcast,
      };

      // JS evaluates both branches of `upsert` before Prisma picks one,
      // so passing encrypt(undefined) into `create` blew up on toggle-
      // only updates. Split into explicit update/create paths.
      const saved = before
        ? await tx.slackConfig.update({
            where: { orgId: ctx.user.orgId },
            data,
          })
        : await tx.slackConfig.create({
            data: {
              orgId: ctx.user.orgId,
              botToken: encrypt(input.botToken!),
              signingSecret: encrypt(input.signingSecret!),
              notifyStandup: input.notifyStandup,
              notifyLeave: input.notifyLeave,
              notifyBlocker: input.notifyBlocker,
              notifyDone: input.notifyDone,
              notifyBroadcast: input.notifyBroadcast,
            },
          });
      // audit() auto-redacts botToken / signingSecret by key-name match.
      await audit({ prisma: tx, user: ctx.user }, 'SLACK_CONFIG_UPDATED', 'SlackConfig', saved.id, {
        before: before
          ? {
              notifyStandup: before.notifyStandup,
              notifyLeave: before.notifyLeave,
              notifyBlocker: before.notifyBlocker,
              notifyDone: before.notifyDone,
              notifyBroadcast: before.notifyBroadcast,
            }
          : undefined,
        after: {
          notifyStandup: saved.notifyStandup,
          notifyLeave: saved.notifyLeave,
          notifyBlocker: saved.notifyBlocker,
          notifyDone: saved.notifyDone,
          notifyBroadcast: saved.notifyBroadcast,
        },
      });
      return saved;
    });
  }),

  testSlack: adminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.slackConfig.findUnique({
      where: { orgId: ctx.user.orgId },
    });
    if (!config) throw new TRPCError({ code: 'NOT_FOUND', message: 'Slack not configured' });

    try {
      const { WebClient } = await import('@slack/web-api');
      const client = new WebClient(decrypt(config.botToken));
      const result = await client.auth.test();
      return { success: true, team: result.team, bot: result.user };
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Slack test failed: ${(err as Error).message}`,
      });
    }
  }),

  getJiraConfig: adminProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.jiraConfig.findUnique({
      where: { orgId: ctx.user.orgId },
    });
    if (!config) return null;

    return {
      ...config,
      apiToken: '••••••' + decrypt(config.apiToken).slice(-4),
    };
  }),

  saveJiraConfig: adminProcedure.input(saveJiraConfigSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const before = await tx.jiraConfig.findUnique({ where: { orgId: ctx.user.orgId } });

      if (!before && !input.apiToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'API token is required for the first Jira connection',
        });
      }

      const data = {
        baseUrl: input.baseUrl,
        email: input.email,
        ...(input.apiToken ? { apiToken: encrypt(input.apiToken) } : {}),
        projectKeys: input.projectKeys,
        syncInterval: input.syncInterval,
      };

      const saved = before
        ? await tx.jiraConfig.update({
            where: { orgId: ctx.user.orgId },
            data,
          })
        : await tx.jiraConfig.create({
            data: {
              orgId: ctx.user.orgId,
              baseUrl: input.baseUrl,
              email: input.email,
              apiToken: encrypt(input.apiToken!),
              projectKeys: input.projectKeys,
              syncInterval: input.syncInterval,
            },
          });
      await audit({ prisma: tx, user: ctx.user }, 'JIRA_CONFIG_UPDATED', 'JiraConfig', saved.id, {
        before: before
          ? {
              baseUrl: before.baseUrl,
              email: before.email,
              projectKeys: before.projectKeys,
              syncInterval: before.syncInterval,
            }
          : undefined,
        after: {
          baseUrl: saved.baseUrl,
          email: saved.email,
          projectKeys: saved.projectKeys,
          syncInterval: saved.syncInterval,
        },
      });
      return saved;
    });
  }),

  testJira: adminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.jiraConfig.findUnique({
      where: { orgId: ctx.user.orgId },
    });
    if (!config) throw new TRPCError({ code: 'NOT_FOUND', message: 'Jira not configured' });

    try {
      const token = decrypt(config.apiToken);
      const auth = Buffer.from(`${config.email}:${token}`).toString('base64');

      // /project/search is the current recommended endpoint — it
      // supports pagination (up to 50 per page by default, maxResults=100
      // bumps that) and returns the same shape across all Jira Cloud
      // tenants. The legacy /project sometimes returns 0 entries on
      // newer instances even when the user has project access.
      const res = await fetch(
        `${config.baseUrl}/rest/api/3/project/search?maxResults=100`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `Jira API returned ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
        );
      }

      const data = (await res.json()) as {
        values?: Array<{ key: string; name: string }>;
        total?: number;
      };
      const projects = data.values ?? [];

      // Cache the key → name map so the UI can render full names
      // (e.g. 'Paybis' instead of 'PAYBIS') in filter dropdowns.
      const projectNames: Record<string, string> = {};
      for (const p of projects) projectNames[p.key] = p.name;
      await ctx.prisma.jiraConfig.update({
        where: { orgId: ctx.user.orgId },
        data: { projectNames },
      });

      return {
        success: true,
        total: data.total ?? projects.length,
        projects: projects.map((p) => ({ key: p.key, name: p.name })),
      };
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Jira test failed: ${(err as Error).message}`,
      });
    }
  }),

  broadcastSlack: adminProcedure.input(broadcastSlackSchema).mutation(async ({ ctx, input }) => {
    const teams = await ctx.prisma.team.findMany({
      where: { orgId: ctx.user.orgId, slackChannelId: { not: null } },
      select: { slackChannelId: true },
    });

    for (const team of teams) {
      await slackQueue.add('broadcast', {
        type: 'broadcast',
        orgId: ctx.user.orgId,
        channelId: team.slackChannelId,
        message: input.message,
      });
    }

    await audit(
      { prisma: ctx.prisma, user: ctx.user },
      'BROADCAST_SENT',
      'Organisation',
      ctx.user.orgId,
      {
        after: {
          message: input.message,
          channelCount: teams.length,
        },
      },
    );

    return { success: true, channelCount: teams.length };
  }),
});
