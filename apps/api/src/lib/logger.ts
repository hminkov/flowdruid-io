import crypto from 'crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { NextFunction, Request, Response } from 'express';

/**
 * Structured logger. Writes JSON in production (easily parsed by log
 * collectors) and pretty-printed in development (easier to eyeball).
 *
 * Every line carries the request-id when emitted from inside an HTTP
 * handler — the pino-http middleware stamps `req.id` on the request
 * and the logger picks it up automatically via the child binding.
 */
const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
  base: {
    // Keep the base context tiny — we add request context per-call.
    service: 'flowdruid-api',
    env: process.env.NODE_ENV ?? 'development',
  },
});

/**
 * HTTP logger. Logs one line per response with method, url, status,
 * duration, and a per-request id that the SPA can mirror via an
 * X-Request-ID header so a single trace spans browser → API.
 *
 * The generated id is compact (16 hex chars) to keep log lines
 * skim-friendly; collisions over the lifetime of one org are
 * effectively zero.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, _res) => {
    const incoming = (req.headers['x-request-id'] as string | undefined)?.trim();
    return incoming && incoming.length <= 64 ? incoming : crypto.randomBytes(8).toString('hex');
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} (${err.message})`,
  // Don't log the two health/ping endpoints — they're too noisy.
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
});

/**
 * Echoes the request-id on the response so the SPA can thread it
 * into its own error reports. Pairs with the X-Request-ID header
 * the client sends on each tRPC call.
 */
export function echoRequestId(req: Request, res: Response, next: NextFunction) {
  const id = (req as Request & { id?: string }).id;
  if (id) res.setHeader('X-Request-ID', id);
  next();
}
