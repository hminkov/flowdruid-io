import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext, type UserPayload } from './context';
import { slackEventsHandler } from './middleware/slack-events';
import { startSlackWorker } from './workers/slack.worker';
import { startJiraWorker } from './workers/jira.worker';
import { startLeaveWorker } from './workers/leave.worker';
import { createSubscriber, eventPattern } from './lib/events';

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

// ─── Live events (SSE) ───────────────────────────────────────────────────
// EventSource can't send an Authorization header, so the access token
// is passed as a query param. Access tokens are short-lived (15 min)
// so query-string exposure is acceptable; production should configure
// nginx to scrub query strings from access logs on this route.
//
// Each connection subscribes to two Redis pubsub patterns:
//   evt:<orgId>:<userId>     — events directed at this user
//   evt:<orgId>:broadcast    — events visible to anyone in the org
// Handled via a single PSUBSCRIBE on evt:<orgId>:*.
app.get('/api/events', async (req, res) => {
  const token = (req.query.token as string | undefined) ?? '';
  let user: UserPayload;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on this route
  res.flushHeaders();

  // One-time comment so proxies that need an initial byte see something.
  res.write(':ok\n\n');

  const sub = createSubscriber();
  const pattern = eventPattern(user.orgId);
  await sub.psubscribe(pattern);

  sub.on('pmessage', (_pattern, channel, message) => {
    const parts = channel.split(':'); // evt:<orgId>:<userId|broadcast>
    const target = parts[2];
    // Only forward broadcast events and events addressed to this user.
    if (target === 'broadcast' || target === user.id) {
      res.write(`data: ${message}\n\n`);
    }
  });

  // Heartbeat every 25 s to keep idle-timeout proxies (nginx default
  // is 60 s) from closing the stream.
  const hb = setInterval(() => {
    res.write(':hb\n\n');
  }, 25_000);

  req.on('close', () => {
    clearInterval(hb);
    sub.quit().catch(() => {});
  });
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
