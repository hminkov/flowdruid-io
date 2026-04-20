import IORedis from 'ioredis';
import type { LiveEvent } from '@flowdruid/shared';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Dedicated publisher connection. BullMQ's `redis` instance is already
 * in blocking mode (`maxRetriesPerRequest: null`); using it for
 * pub/sub would risk crossing stream and pubsub semantics. A second
 * connection is cheap and keeps the two subsystems isolated.
 */
const pub = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });

pub.on('error', (err) => {
  // Pub/sub failures must not crash the request — log and continue.
  // If Redis is down the 30-second poll fallback keeps the UI live.
  console.error('events.publish: redis error', err.message);
});

/**
 * Channel naming:
 *  - `evt:<orgId>:<userId>` — directed events (notifications, DMs).
 *  - `evt:<orgId>:broadcast` — org-wide events (e.g. ticket board
 *    updates that everyone in the org should see).
 *
 * SSE handlers subscribe to their user-specific channel AND the
 * broadcast channel via PSUBSCRIBE on `evt:<orgId>:*`.
 */
function channelFor(orgId: string, userId: string | null): string {
  return `evt:${orgId}:${userId ?? 'broadcast'}`;
}

/**
 * Fire an event. Never throws — if Redis is unreachable we swallow
 * and log; the mutation that produced the event has already
 * committed and clients will catch up via their poll.
 */
export async function publish(
  orgId: string,
  userId: string | null,
  event: LiveEvent,
): Promise<void> {
  try {
    await pub.publish(channelFor(orgId, userId), JSON.stringify(event));
  } catch (err) {
    console.error('events.publish: failed', (err as Error).message);
  }
}

/**
 * Subscriber connection factory — each SSE handler gets its own so
 * closing one connection doesn't affect others. Caller is responsible
 * for `.quit()` on client disconnect.
 */
export function createSubscriber(): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
}

export function eventPattern(orgId: string): string {
  return `evt:${orgId}:*`;
}
