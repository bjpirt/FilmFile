import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Count every source file, not only those a test imported.
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        // Runs in a child process in startup.test.ts. Coverage from child processes
        // (autoAttachSubprocess) corrupts the figures for files both processes load.
        'apps/service/src/main.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        'apps/service/src/domain/**': { lines: 90, branches: 90 },
        'apps/service/src/application/**': { lines: 90, branches: 90 },
      },
    },
  },
});
