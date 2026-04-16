import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { slackQueue } from '../lib/queue';
import { leaveQueue } from '../lib/queue';

async function processLeaveReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find all approved leaves that overlap with today
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: tomorrow },
      endDate: { gte: today },
    },
    include: {
      user: {
        select: { name: true, teamId: true, orgId: true },
      },
    },
  });

  // Group by team
  const byTeam = new Map<string, string[]>();
  for (const leave of leaves) {
    if (!leave.user.teamId) continue;
    const key = `${leave.user.orgId}:${leave.user.teamId}`;
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key)!.push(`${leave.user.name} (${leave.type})`);
  }

  for (const [key, names] of byTeam) {
    const [orgId, teamId] = key.split(':');
    await slackQueue.add('leave.reminder', {
      type: 'broadcast',
      orgId,
      teamId,
      message: `:calendar: *Today's absences:*\n${names.map((n) => `• ${n}`).join('\n')}`,
    });
  }
}

export async function startLeaveWorker() {
  const worker = new Worker('leave-reminders', async () => {
    await processLeaveReminders();
  }, {
    connection: redis,
  });

  // Daily at 08:00 UTC
  await leaveQueue.upsertJobScheduler(
    'leave-reminder-scheduler',
    { pattern: '0 8 * * *' },
    { name: 'leave-reminder' },
  );

  return worker;
}
