import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { auditTrimQueue } from '../lib/queue';
import { logger } from '../lib/logger';

/**
 * Retention for audit rows. Default 180 days; override via env per
 * deploy. A future Part B §8 enhancement can move this to a column
 * on Organisation so customers can set their own retention.
 */
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? '180');

export async function trimAuditLog(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

/**
 * Start the nightly audit-log-trim worker.
 *
 * Runs daily at 02:30 UTC (between other cron jobs — leave worker at
 * 08:00, nothing else). Small, idempotent, no fanout.
 */
export async function startAuditTrimWorker() {
  const worker = new Worker(
    'audit-trim',
    async () => {
      const deleted = await trimAuditLog();
      if (deleted > 0) {
        logger.info(
          { deleted, retentionDays: RETENTION_DAYS },
          'audit log trimmed',
        );
      }
    },
    { connection: redis },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'audit-trim job failed');
  });

  await auditTrimQueue.upsertJobScheduler(
    'audit-trim-scheduler',
    { pattern: '30 2 * * *' }, // 02:30 UTC daily
    { name: 'audit-trim' },
  );

  return worker;
}
