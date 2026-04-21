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

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION, timestamp: new Date().toISOString() });
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
