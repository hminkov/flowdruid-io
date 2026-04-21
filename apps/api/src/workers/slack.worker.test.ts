import { describe, it, expect, vi, beforeEach } from 'vitest';

const postMessage = vi.fn().mockResolvedValue({ ok: true });

// The worker dynamically imports @slack/web-api so the mock must be
// in place before processSlackJob runs — vi.mock is hoisted above
// imports so this lands before the `import { processSlackJob }` line.
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({ chat: { postMessage } })),
}));

// Prisma is consulted for SlackConfig + Team. Return fixtures shaped
// like the real queries so the worker doesn't need a live DB.
vi.mock('../lib/prisma', () => ({
  prisma: {
    slackConfig: {
      findUnique: vi.fn().mockResolvedValue({ botToken: 'raw-bot-token' }),
    },
    team: {
      findUnique: vi.fn().mockResolvedValue({ slackChannelId: 'C-TEAM' }),
    },
  },
}));

// Short-circuit encryption so the test doesn't depend on ENCRYPTION_KEY.
vi.mock('../lib/encrypt', () => ({ decrypt: (s: string) => s }));

import type { Job } from 'bullmq';
import { processSlackJob } from './slack.worker';

type SlackJobData = {
  type: string;
  orgId: string;
  teamId?: string | null;
  channelId?: string;
  userId?: string;
  userName?: string;
  [key: string]: unknown;
};

function job(data: SlackJobData): Job<SlackJobData> {
  return { data } as unknown as Job<SlackJobData>;
}

describe('slack.worker processSlackJob', () => {
  beforeEach(() => {
    postMessage.mockClear();
  });

  it('standup.posted posts to the resolved team channel with Block Kit', async () => {
    await processSlackJob(
      job({
        type: 'standup.posted',
        orgId: 'org-1',
        teamId: 'team-1',
        userName: 'Alice',
        yesterday: 'fixed pagination',
        today: 'shipping X',
        capacityPct: 50,
        blockers: null,
      }),
    );
    expect(postMessage).toHaveBeenCalledTimes(1);
    const args = postMessage.mock.calls[0]![0];
    expect(args.channel).toBe('C-TEAM');
    // Fallback text for notifications + legacy clients.
    expect(args.text).toContain('Alice');
    expect(args.text).toContain('50%');
    // Rich layout via Block Kit.
    expect(Array.isArray(args.blocks)).toBe(true);
    const joined = JSON.stringify(args.blocks);
    expect(joined).toContain('Alice');
    expect(joined).toContain('shipping X');
    expect(joined).toContain('fixed pagination');
    expect(joined).toContain('50%');
    // Capacity indicator is a single emoji keyword, not Unicode art.
    expect(joined).toMatch(/:battery:|:zap:|:hourglass_flowing_sand:|:red_circle:/);
  });

  it('standup.posted with blockers appends a warning section', async () => {
    await processSlackJob(
      job({
        type: 'standup.posted',
        orgId: 'org-1',
        teamId: 'team-1',
        userName: 'Bob',
        yesterday: 'y',
        today: 't',
        capacityPct: 80,
        blockers: 'DB migration hangs',
      }),
    );
    const joined = JSON.stringify(postMessage.mock.calls[0]![0].blocks);
    expect(joined).toContain('DB migration hangs');
    expect(joined).toContain(':warning:');
  });

  it('leave.approved posts a palm-tree message', async () => {
    await processSlackJob(
      job({
        type: 'leave.approved',
        orgId: 'org-1',
        teamId: 'team-1',
        userName: 'Carol',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-08',
      }),
    );
    const text = postMessage.mock.calls[0]![0].text;
    expect(text).toContain(':palm_tree:');
    expect(text).toContain('Carol');
    expect(text).toContain('ANNUAL');
  });

  it('blocker.flagged posts to the team channel with a rotating_light emoji', async () => {
    await processSlackJob(
      job({
        type: 'blocker.flagged',
        orgId: 'org-1',
        teamId: 'team-1',
        userName: 'Dan',
        blockers: 'waiting on DB dump',
      }),
    );
    const text = postMessage.mock.calls[0]![0].text;
    expect(text).toContain(':rotating_light:');
    expect(text).toContain('Dan');
    expect(text).toContain('waiting on DB dump');
  });

  it('ticket.done posts the jira key + title', async () => {
    await processSlackJob(
      job({
        type: 'ticket.done',
        orgId: 'org-1',
        teamId: 'team-1',
        ticketKey: 'DW-42',
        ticketTitle: 'SEPA retry',
        userName: 'Erin',
      }),
    );
    const text = postMessage.mock.calls[0]![0].text;
    expect(text).toContain('DW-42');
    expect(text).toContain('SEPA retry');
    expect(text).toContain('Erin');
  });

  it('broadcast posts to the explicit channelId, bypassing team lookup', async () => {
    await processSlackJob(
      job({
        type: 'broadcast',
        orgId: 'org-1',
        channelId: 'C-GENERAL',
        message: 'Office closed Monday',
      }),
    );
    const args = postMessage.mock.calls[0]![0];
    expect(args.channel).toBe('C-GENERAL');
    expect(args.text).toContain('Company Broadcast');
    expect(args.text).toContain('Office closed Monday');
  });

  it('silently skips when the team has no Slack channel id configured', async () => {
    const { prisma } = await import('../lib/prisma');
    // Override for this test only.
    (prisma.team.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      slackChannelId: null,
    });

    await processSlackJob(
      job({
        type: 'standup.posted',
        orgId: 'org-1',
        teamId: 'team-1',
        userName: 'Nobody',
        today: 't',
        capacityPct: 50,
      }),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('silently skips when the org has no SlackConfig', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.slackConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await processSlackJob(
      job({
        type: 'broadcast',
        orgId: 'org-no-slack',
        channelId: 'C-X',
        message: 'hi',
      }),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('an unknown job.type is a no-op (default case falls through)', async () => {
    await processSlackJob(
      job({ type: 'not.a.real.event' as string, orgId: 'org-1', teamId: 'team-1' }),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
