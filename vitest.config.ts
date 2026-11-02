import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Count lines run by child processes, e.g. the startup test running main.ts.
      autoAttachSubprocess: true,
      // Count every source file, not only those a test imported.
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: {
        lines: 80,
        branches: 80,
        'apps/service/src/domain/**': { lines: 90, branches: 90 },
        'apps/service/src/application/**': { lines: 90, branches: 90 },
      },
    },
  },
});
