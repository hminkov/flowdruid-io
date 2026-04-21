import type { Server } from 'node:http';
import type { Worker } from 'bullmq';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startSlackWorker } from './workers/slack.worker';
import { startJiraWorker } from './workers/jira.worker';
import { startLeaveWorker } from './workers/leave.worker';
import { startAuditTrimWorker } from './workers/audit-trim.worker';
import { sentryEnabled } from './lib/sentry';

const app = createApp();
const port = Number(process.env.PORT) || 3000;
const VERSION = process.env.npm_package_version ?? '0.0.1';

const workers: Worker[] = [];

const server: Server = app.listen(port, () => {
  logger.info({ port, version: VERSION, sentryEnabled }, 'API server ready');

  // Start background workers (only in the server bootstrap — never in tests).
  workers.push(startSlackWorker());
  startJiraWorker()
    .then((w) => w && workers.push(w))
    .catch((err) => logger.error({ err }, 'jira worker failed'));
  startLeaveWorker()
    .then((w) => w && workers.push(w))
    .catch((err) => logger.error({ err }, 'leave worker failed'));
  startAuditTrimWorker()
    .then((w) => w && workers.push(w))
    .catch((err) => logger.error({ err }, 'audit-trim worker failed'));
});

/**
 * Graceful shutdown. Triggered by SIGTERM (standard docker-stop signal)
 * and SIGINT (ctrl-c in dev).
 *
 * Order matters:
 *   1. Stop accepting new HTTP requests (server.close).
 *   2. Drain BullMQ workers so in-flight jobs finish rather than
 *      getting ack'd and lost on restart.
 *   3. Disconnect Prisma so Postgres connections aren't left open
 *      long enough for a deploy to fail the new pod's pool check.
 *
 * Hard timeout: 20 s. If something is wedged past that the container
 * runtime will SIGKILL us anyway; prefer to log + exit cleanly so
 * Sentry doesn't get a noisy abort.
 */
const SHUTDOWN_TIMEOUT_MS = 20_000;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown initiated');

  const hardTimer = setTimeout(() => {
    logger.warn({ signal }, 'shutdown timeout — exiting anyway');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // 1. No new HTTP requests. Existing SSE streams get closed by the
    //    `req.on('close')` handler in app.ts.
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info('http server closed');

    // 2. Drain every BullMQ worker in parallel.
    await Promise.all(
      workers.map((w) =>
        w.close().catch((err) => logger.error({ err }, 'worker close failed')),
      ),
    );
    logger.info('workers drained');

    // 3. Close the Prisma pool.
    await prisma.$disconnect().catch((err) => logger.error({ err }, 'prisma disconnect failed'));
    logger.info('prisma disconnected');

    clearTimeout(hardTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'shutdown error');
    clearTimeout(hardTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
