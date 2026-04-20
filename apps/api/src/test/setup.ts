import { beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Tests talk to a dedicated database so they can truncate freely
// without touching the dev data. Defaults to flowdruid_test on the
// local Postgres; override with TEST_DATABASE_URL.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://flowdruid:flowdruid@localhost:5432/flowdruid_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;
// Give the auth router something deterministic to sign with. These
// values only exist for the test process.
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-real-builds';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-do-not-use-in-real-builds';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex

export const testPrisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

/**
 * Before the first test runs, make sure the schema exists on the test
 * database. Uses `prisma db push --skip-generate` since the test DB
 * is disposable and we don't need migration history there.
 *
 * We shell out via dynamic import so the setup file doesn't pull the
 * Prisma CLI as a runtime dependency when it's not needed.
 */
beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  try {
    execSync('pnpm exec prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    // Likely the test DB doesn't exist yet — create it and retry.
    const url = new URL(TEST_DATABASE_URL);
    const dbName = url.pathname.slice(1);
    const adminUrl = new URL(TEST_DATABASE_URL);
    adminUrl.pathname = '/postgres';
    const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    await admin.$disconnect();
    execSync('pnpm exec prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    if (err instanceof Error) {
      // eslint-disable-next-line no-console
      console.debug('test DB bootstrap retry ok after:', err.message);
    }
  }
});

/**
 * Truncate every table before each test so state from one test can't
 * leak into the next. Order matters because of FKs — use RESTART
 * IDENTITY CASCADE so sequences reset and FK-dependent rows drop too.
 */
beforeEach(async () => {
  const rows = await testPrisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const tables = rows
    .map((r) => r.tablename)
    .filter((t) => !t.startsWith('_'))
    .map((t) => `"public"."${t}"`)
    .join(', ');
  if (tables) {
    await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
