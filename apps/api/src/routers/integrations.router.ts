import { TRPCError } from '@trpc/server';
import { saveSlackConfigSchema, saveJiraConfigSchema, broadcastSlackSchema } from '@flowdruid/shared';
import { router, adminProcedure } from '../trpc';
import { encrypt, decrypt } from '../lib/encrypt';
import { slackQueue } from '../lib/queue';

export const integrationsRouter = router({
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
    const data = {
      botToken: encrypt(input.botToken),
      signingSecret: encrypt(input.signingSecret),
      notifyStandup: input.notifyStandup,
      notifyLeave: input.notifyLeave,
      notifyBlocker: input.notifyBlocker,
      notifyDone: input.notifyDone,
      notifyBroadcast: input.notifyBroadcast,
    };

    return ctx.prisma.slackConfig.upsert({
      where: { orgId: ctx.user.orgId },
      create: { orgId: ctx.user.orgId, ...data },
      update: data,
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
    const data = {
      baseUrl: input.baseUrl,
      email: input.email,
      apiToken: encrypt(input.apiToken),
      projectKeys: input.projectKeys,
      syncInterval: input.syncInterval,
    };

    return ctx.prisma.jiraConfig.upsert({
      where: { orgId: ctx.user.orgId },
      create: { orgId: ctx.user.orgId, ...data },
      update: data,
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

      const res = await fetch(`${config.baseUrl}/rest/api/3/project`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) throw new Error(`Jira API returned ${res.status}`);

      const projects = (await res.json()) as Array<{ key: string; name: string }>;
      return {
        success: true,
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

    return { success: true, channelCount: teams.length };
  }),
});
