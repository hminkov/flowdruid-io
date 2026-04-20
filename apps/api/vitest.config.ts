import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Serialize test files — they share a single Postgres schema so
    // parallel files would clobber one another. Within a file, tests
    // run sequentially via the setup helper's beforeEach reset.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
