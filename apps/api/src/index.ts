import { createApp } from './app';
import { logger } from './lib/logger';
import { startSlackWorker } from './workers/slack.worker';
import { startJiraWorker } from './workers/jira.worker';
import { startLeaveWorker } from './workers/leave.worker';
import { sentryEnabled } from './lib/sentry';

const app = createApp();
const port = Number(process.env.PORT) || 3000;
const VERSION = process.env.npm_package_version ?? '0.0.1';

app.listen(port, () => {
  logger.info({ port, version: VERSION, sentryEnabled }, 'API server ready');

  // Start background workers (only in the server bootstrap — never in tests).
  startSlackWorker();
  startJiraWorker().catch((err) => logger.error({ err }, 'jira worker failed'));
  startLeaveWorker().catch((err) => logger.error({ err }, 'leave worker failed'));
});
