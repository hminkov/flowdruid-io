// Sentry init has side-effects that must run before Express / Prisma
// so auto-instrumentation can patch those modules. Keep this import
// first.
import './lib/sentry';
import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { Sentry, sentryEnabled } from './lib/sentry';
import { appRouter } from './routers';
import { createContext, type UserPayload } from './context';
import { slackEventsHandler } from './middleware/slack-events';
import { createSubscriber, eventPattern } from './lib/events';
import { httpLogger, echoRequestId } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import promBundle from 'express-prom-bundle';

/**
 * Build the Express app with every route + middleware wired.
 *
 * Split from index.ts so tests can SuperTest it without calling
 * .listen() and starting the BullMQ workers. The server bootstrap
 * (index.ts) imports this, listens on a port, and starts workers.
 */
export function createApp(): Express {
  const app = express();
  const VERSION = process.env.npm_package_version ?? '0.0.1';

  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(httpLogger);
  app.use(echoRequestId);

  // Prometheus request metrics. Exposes /metrics with per-route
  // duration histograms + request counters. The include* flags keep
  // cardinality bounded — we drop query strings (token leak risk)
  // and collapse paths under /trpc/<procedure> to a single label.
  app.use(
    promBundle({
      includeMethod: true,
      includePath: true,
      includeStatusCode: true,
      metricsPath: '/metrics',
      // Merge /trpc/auth.login and /trpc/auth.login,auth.refresh
      // (batched tRPC) into the first procedure — keeps the label
      // cardinality sane on a dashboard.
      normalizePath: (req) => {
        const url = req.originalUrl || req.url || '';
        if (url.startsWith('/trpc/')) {
          const path = url.split('?')[0] ?? '';
          const first = path.slice('/trpc/'.length).split(',')[0] ?? 'unknown';
          return `/trpc/${first}`;
        }
        return (url.split('?')[0] ?? '/').replace(/\/\d+/g, '/:id');
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL
          : 'http://localhost:5173',
      credentials: true,
    }),
  );

  // Slack's HMAC signature check needs the raw request bytes — JSON
  // parsing mutates whitespace and order, which would make the HMAC
  // never match. Register this route with express.raw BEFORE the
  // global JSON parser claims everything.
  app.post(
    '/api/slack/events',
    express.raw({ type: 'application/json' }),
    slackEventsHandler,
  );

  app.use(express.json());
  app.use(cookieParser());

  // Per-IP rate limit on auth endpoints. 10 attempts per 15 min window.
  // skipSuccessfulRequests ensures a valid login doesn't count toward
  // the quota — only failures + retries do, which is what catches
  // credential stuffing.
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
  app.use((req, res, next) => {
    if (req.path.startsWith('/trpc/') && [...authRoutes].some((r) => req.path.includes(r))) {
      return authLimiter(req, res, next);
    }
    next();
  });

  // Shallow liveness check. Always 200 if the process is alive —
  // used by the sidebar footer to read the running API version and
  // by cheap uptime monitors that just want "is the box up?".
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION, timestamp: new Date().toISOString() });
  });

  // Deep readiness check. 200 only if every dependency we need to
  // serve real requests is actually reachable. Load balancers should
  // route traffic based on this one, not /health, so an unready node
  // (Postgres down, Redis unreachable) is taken out of rotation.
  app.get('/ready', async (_req, res) => {
    const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

    const check = async <T>(name: string, fn: () => Promise<T>): Promise<void> => {
      const start = Date.now();
      try {
        // Race against a 2 s timeout — a dependency that takes longer is
        // effectively down for request-serving purposes.
        await Promise.race([
          fn(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
        ]);
        checks[name] = { ok: true, ms: Date.now() - start };
      } catch (err) {
        checks[name] = {
          ok: false,
          ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    await Promise.all([
      check('postgres', () => prisma.$queryRaw`SELECT 1`),
      check('redis', () => redis.ping()),
    ]);

    const allOk = Object.values(checks).every((c) => c.ok);
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

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
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(':ok\n\n');

    const sub = createSubscriber();
    const pattern = eventPattern(user.orgId);
    await sub.psubscribe(pattern);

    sub.on('pmessage', (_pattern, channel, message) => {
      const parts = channel.split(':');
      const target = parts[2];
      if (target === 'broadcast' || target === user.id) {
        res.write(`data: ${message}\n\n`);
      }
    });

    const hb = setInterval(() => {
      res.write(':hb\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(hb);
      sub.quit().catch(() => {});
    });
  });

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => createContext({ req, res }),
    }),
  );

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  return app;
}
