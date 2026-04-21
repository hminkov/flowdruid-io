import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('app — HTTP bootstrap smoke', () => {
  const app = createApp();

  it('/health returns ok + version + timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.version).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('sends helmet security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['cross-origin-opener-policy']).toBeDefined();
  });

  it('echoes X-Request-ID from the request or generates one', async () => {
    // Inbound id echoed back.
    const echo = await request(app).get('/health').set('x-request-id', 'req-abc-123');
    expect(echo.headers['x-request-id']).toBe('req-abc-123');

    // No inbound id → one is generated.
    const gen = await request(app).get('/health');
    expect(gen.headers['x-request-id']).toMatch(/^[0-9a-f]{16}$/);
  });

  it('/api/events rejects without a token', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('/api/events rejects a bogus token', async () => {
    const res = await request(app).get('/api/events?token=not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('unknown routes 404', async () => {
    const res = await request(app).get('/does/not/exist');
    expect(res.status).toBe(404);
  });

  it('CORS sends credentials-allowed + origin header for preflight', async () => {
    const res = await request(app)
      .options('/trpc/auth.login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    // The CORS middleware responds with an Access-Control-Allow-* set
    // for an origin it accepts.
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('/ready returns 200 + per-dependency timings when Postgres + Redis are reachable', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks?.postgres?.ok).toBe(true);
    expect(res.body.checks?.redis?.ok).toBe(true);
    expect(typeof res.body.checks.postgres.ms).toBe('number');
    expect(typeof res.body.checks.redis.ms).toBe('number');
  });
});
