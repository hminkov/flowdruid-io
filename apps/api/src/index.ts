import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './context';
import { slackEventsHandler } from './middleware/slack-events';
import { startSlackWorker } from './workers/slack.worker';
import { startJiraWorker } from './workers/jira.worker';
import { startLeaveWorker } from './workers/leave.worker';

const app = express();
const port = Number(process.env.PORT) || 3000;
// Pulled from the package.json at start-up by the npm/pnpm runner.
// Falls back for the rare case we're run outside a script context.
const VERSION = process.env.npm_package_version ?? '0.0.1';

// Trust the first proxy (nginx / load balancer) so req.ip reflects the
// real client for rate-limit bookkeeping. Do not enable in dev where
// requests arrive direct.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Security headers. Content-Security-Policy is off by default for now
// because the SPA is served from a different origin; turn it on once
// we move behind a shared nginx in prod.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:5173',
  credentials: true,
}));
// Slack's HMAC signature check needs the raw request bytes — JSON
// parsing mutates whitespace and order, which would make the HMAC
// never match. Register the slack-events route with express.raw
// BEFORE the global JSON parser claims everything.
app.post(
  '/api/slack/events',
  express.raw({ type: 'application/json' }),
  slackEventsHandler,
);

app.use(express.json());
app.use(cookieParser());

// Per-IP rate limit on auth endpoints. Credential-stuffing protection —
// 10 attempts per 15 min window, then 429 with a Retry-After. Scopes
// only the two auth routes so regular tRPC calls stay unlimited.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later.' },
  skipSuccessfulRequests: true,
});
const authRoutes = new Set(['auth.login', 'auth.refresh', 'auth.register']);
app.use('/trpc/auth.login', authLimiter);
app.use('/trpc/auth.refresh', authLimiter);
app.use('/trpc/auth.register', authLimiter);
// Batched tRPC requests hit /trpc/auth.login,auth.refresh — a generic
// prefix match handles those.
app.use((req, res, next) => {
  if (req.path.startsWith('/trpc/') && [...authRoutes].some((r) => req.path.includes(r))) {
    return authLimiter(req, res, next);
  }
  next();
});

// Health check — also surfaces the running API version so the frontend
// can show it in the sidebar footer without needing a dedicated route.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: VERSION, timestamp: new Date().toISOString() });
});

// Slack events route is registered above (needs raw body — see comment).

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
