import { redis } from './redis';

export interface RateLimitOptions {
  // Bucket key segment — distinguishes different limiters (e.g. "mutation", "sync").
  scope: string;
  // Maximum requests allowed in the window.
  limit: number;
  // Window length in seconds.
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter per (scope, key). Cheap — one INCR + one EXPIRE per
 * call, no Lua script. Fixed-window has the known edge case of double-burst
 * at window rollover, which is acceptable for our use-case (the global
 * per-IP auth limiter still catches credential stuffing at the edge).
 *
 * Fails open if Redis is unreachable — we'd rather serve degraded than
 * 500 every request because the limiter can't talk to its store.
 */
export async function hit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / opts.windowSec);
  const redisKey = `rl:${opts.scope}:${key}:${bucket}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, opts.windowSec + 1);
    }
    const remaining = Math.max(0, opts.limit - count);
    const allowed = count <= opts.limit;
    const retryAfterSec = allowed
      ? 0
      : opts.windowSec - (Math.floor(Date.now() / 1000) % opts.windowSec);
    return { allowed, remaining, retryAfterSec };
  } catch {
    return { allowed: true, remaining: opts.limit, retryAfterSec: 0 };
  }
}
