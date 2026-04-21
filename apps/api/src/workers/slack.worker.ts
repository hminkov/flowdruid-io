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
      const bar = '█'.repeat(Math.round(capacity / 10)) + '░'.repeat(10 - Math.round(capacity / 10));
      let text = `*${job.data.userName}* posted a standup:\n> *Today:* ${job.data.today}\n> *Capacity:* ${bar} ${capacity}%`;
      if (job.data.blockers) {
        text += `\n> :warning: *Blocker:* ${job.data.blockers}`;
      }
      await client.chat.postMessage({ channel: channelId, text });
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
