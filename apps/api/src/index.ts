import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './context';
import { slackEventsHandler } from './middleware/slack-events';
import { startSlackWorker } from './workers/slack.worker';
import { startJiraWorker } from './workers/jira.worker';
import { startLeaveWorker } from './workers/leave.worker';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Slack events webhook
app.post('/api/slack/events', slackEventsHandler);

// tRPC
app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: ({ req, res }) => createContext({ req, res }),
}));

app.listen(port, () => {
  console.log(`API server running on port ${port}`);

  // Start background workers
  startSlackWorker();
  startJiraWorker().catch(console.error);
  startLeaveWorker().catch(console.error);
});
