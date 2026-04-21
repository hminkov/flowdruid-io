import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';

interface SlackJobData {
  type: string;
  orgId: string;
  teamId?: string | null;
  channelId?: string;
  userId?: string;
  userName?: string;
  [key: string]: unknown;
}

async function getSlackClient(orgId: string) {
  const config = await prisma.slackConfig.findUnique({ where: { orgId } });
  if (!config) return null;

  const { WebClient } = await import('@slack/web-api');
  return new WebClient(decrypt(config.botToken));
}

async function getTeamChannelId(teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { slackChannelId: true } });
  return team?.slackChannelId || null;
}

export async function processSlackJob(job: Job<SlackJobData>) {
  const { type, orgId, teamId } = job.data;
  const client = await getSlackClient(orgId);
  if (!client) return;

  let channelId: string | null = null;

  if (job.data.channelId) {
    channelId = job.data.channelId;
  } else if (teamId) {
    channelId = await getTeamChannelId(teamId);
  }

  switch (type) {
    case 'standup.posted': {
      if (!channelId) return;
      const capacity = job.data.capacityPct as number;
      // Map capacity bucket to a single emoji. A single character reads
      // the same on every Slack client, unlike Unicode block-art which
      // renders inconsistently on narrow/mobile views.
      const capEmoji =
        capacity >= 90 ? ':battery:' : capacity >= 60 ? ':zap:' : capacity >= 30 ? ':hourglass_flowing_sand:' : ':red_circle:';
      const yesterday = (job.data.yesterday as string | undefined) ?? '';
      const today = (job.data.today as string | undefined) ?? '';
      const blockers = job.data.blockers as string | undefined;
      const userName = job.data.userName as string;

      // Block Kit gives us proper sections, field pairs, and a context
      // footer. `text` is still required as a fallback for notifications
      // and legacy clients.
      const blocks: Array<Record<string, unknown>> = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:memo: *${userName}* posted a standup`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Yesterday*\n${yesterday || '_—_'}` },
            { type: 'mrkdwn', text: `*Today*\n${today || '_—_'}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Capacity*  ${capEmoji}  ${capacity}%` },
        },
      ];

      if (blockers && blockers.trim()) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `:warning: *Blocker*\n${blockers}` },
        });
      }

      await client.chat.postMessage({
        channel: channelId,
        text: `${userName} posted a standup — ${capacity}% capacity${blockers ? ' (blocker)' : ''}`,
        // Slack's KnownBlock union is strictly typed per block kind and
        // our locally-shaped sections don't satisfy the discriminated
        // union. The runtime shape is correct.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blocks: blocks as any,
      });
      break;
    }

    case 'leave.approved': {
      if (!channelId) return;
      await client.chat.postMessage({
        channel: channelId,
        text: `:palm_tree: *${job.data.userName}* — ${job.data.leaveType} leave approved (${job.data.startDate} → ${job.data.endDate})`,
      });
      break;
    }

    case 'leave.denied': {
      // DM the user — would need Slack user ID mapping; for now log
      console.log(`Leave denied for ${job.data.userName}: ${job.data.leaveType}`);
      break;
    }

    case 'blocker.flagged': {
      if (!channelId) return;
      await client.chat.postMessage({
        channel: channelId,
        text: `:rotating_light: *Blocker from ${job.data.userName}:*\n> ${job.data.blockers}`,
      });
      break;
    }

    case 'ticket.done': {
      if (!channelId) return;
      await client.chat.postMessage({
        channel: channelId,
        text: `:white_check_mark: *${job.data.ticketKey}* — ${job.data.ticketTitle} marked as Done by ${job.data.userName}`,
      });
      break;
    }

    case 'broadcast': {
      if (!channelId) return;
      await client.chat.postMessage({
        channel: channelId,
        text: `:mega: *Company Broadcast:*\n${job.data.message}`,
      });
      break;
    }
  }
}

export function startSlackWorker() {
  const worker = new Worker('slack-notifications', processSlackJob, {
    connection: redis,
    concurrency: 5,
  });

  worker.on('failed', (job, err) => {
    console.error(`Slack job ${job?.id} failed:`, err.message);
  });

  return worker;
}
