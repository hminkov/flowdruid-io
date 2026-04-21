import { describe, it, expect } from 'vitest';
import { hit } from './rate-limit';
import { redis } from './redis';

describe('rate-limit.hit', () => {
  it('allows up to limit, denies past limit, reports retry-after', async () => {
    // Unique key so a re-run inside the same window doesn't collide.
    const key = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opts = { scope: 'unit', limit: 3, windowSec: 60 };

    const r1 = await hit(key, opts);
    const r2 = await hit(key, opts);
    const r3 = await hit(key, opts);
    const r4 = await hit(key, opts);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterSec).toBeGreaterThan(0);
    expect(r4.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('isolates independent keys', async () => {
    const a = `iso-a-${Math.random().toString(36).slice(2)}`;
    const b = `iso-b-${Math.random().toString(36).slice(2)}`;
    const opts = { scope: 'unit', limit: 1, windowSec: 60 };

    expect((await hit(a, opts)).allowed).toBe(true);
    expect((await hit(a, opts)).allowed).toBe(false);
    // Different key is untouched by the exhaustion above.
    expect((await hit(b, opts)).allowed).toBe(true);
  });

  it('isolates independent scopes', async () => {
    const key = `scope-${Math.random().toString(36).slice(2)}`;
    expect((await hit(key, { scope: 'alpha', limit: 1, windowSec: 60 })).allowed).toBe(true);
    expect((await hit(key, { scope: 'alpha', limit: 1, windowSec: 60 })).allowed).toBe(false);
    expect((await hit(key, { scope: 'beta', limit: 1, windowSec: 60 })).allowed).toBe(true);
  });
});

// The ioredis client in tests keeps the process alive unless we quit it.
// Other test files share the same client via the shared module instance,
// so only disconnect after everything in this file runs.
import { afterAll } from 'vitest';
afterAll(async () => {
  // Leave the shared client connected for other suites; just drop our
  // test keys so they don't bloat the Redis keyspace.
  const keys = await redis.keys('rl:unit:*');
  if (keys.length) await redis.del(keys);
});
