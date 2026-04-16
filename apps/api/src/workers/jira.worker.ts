import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { syncJiraTickets } from '../services/jira.sync';
import { jiraQueue } from '../lib/queue';

async function processJiraSync() {
  const configs = await prisma.jiraConfig.findMany({ select: { orgId: true } });
  for (const config of configs) {
    try {
      await syncJiraTickets(config.orgId);
    } catch (err) {
      console.error(`Jira sync failed for org ${config.orgId}:`, (err as Error).message);
    }
  }
}

export async function startJiraWorker() {
  const worker = new Worker('jira-sync', async () => {
    await processJiraSync();
  }, {
    connection: redis,
  });

  worker.on('failed', (job, err) => {
    console.error(`Jira sync job ${job?.id} failed:`, err.message);
  });

  // Schedule repeatable job every 15 minutes
  await jiraQueue.upsertJobScheduler(
    'jira-sync-scheduler',
    { every: 15 * 60 * 1000 },
    { name: 'jira-sync' },
  );

  return worker;
}
