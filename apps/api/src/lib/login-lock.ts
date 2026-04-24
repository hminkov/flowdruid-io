import { redis } from './redis';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_SECONDS = 10 * 60;

function key(email: string): string {
  return `login:fail:${email.toLowerCase().trim()}`;
}

export interface LockState {
  locked: boolean;
  retryAfterSec: number;
}

// Fails open if Redis is unreachable — a Redis outage should not lock
// every user out of the product.
export async function getLockState(email: string): Promise<LockState> {
  try {
    const k = key(email);
    const raw = await redis.get(k);
    const count = raw ? Number(raw) : 0;
    if (count >= MAX_LOGIN_ATTEMPTS) {
      const ttl = await redis.ttl(k);
      return { locked: true, retryAfterSec: ttl > 0 ? ttl : LOGIN_LOCK_SECONDS };
    }
    return { locked: false, retryAfterSec: 0 };
  } catch {
    return { locked: false, retryAfterSec: 0 };
  }
}

export interface FailureResult {
  count: number;
  lockedNow: boolean;
  retryAfterSec: number;
}

// The first failure sets the 10-min TTL, so the count always expires
// on its own if the user never comes back. The 5th failure refreshes
// the TTL so the lockout always runs the full 10 minutes from that
// point. Failures past the 5th are never recorded — getLockState
// short-circuits the caller before we get here.
export async function recordFailure(email: string): Promise<FailureResult> {
  try {
    const k = key(email);
    const count = await redis.incr(k);
    if (count === 1 || count >= MAX_LOGIN_ATTEMPTS) {
      await redis.expire(k, LOGIN_LOCK_SECONDS);
    }
    const lockedNow = count >= MAX_LOGIN_ATTEMPTS;
    return { count, lockedNow, retryAfterSec: lockedNow ? LOGIN_LOCK_SECONDS : 0 };
  } catch {
    return { count: 0, lockedNow: false, retryAfterSec: 0 };
  }
}

export async function resetFailures(email: string): Promise<void> {
  try {
    await redis.del(key(email));
  } catch {
    // ignore
  }
}
