import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Count every source file, not only those a test imported.
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        // Stand-ins for the service in the web app's tests, not app code.
        'apps/web/src/testing/**',
        // Runs in a child process in startup.test.ts. Coverage from child processes
        // (autoAttachSubprocess) corrupts the figures for files both processes load.
        'apps/backend/src/main.ts',
        // Run only inside Electron, covered by the desktop journeys (desktop.e2e.ts).
        'apps/desktop/src/app-menu.ts',
        'apps/desktop/src/choose-folder.ts',
        'apps/desktop/src/find-folder.ts',
        'apps/desktop/src/main.ts',
        'apps/desktop/src/open-window.ts',
        'apps/desktop/src/start-service.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        'apps/backend/src/domain/**': { lines: 90, branches: 90 },
        'apps/backend/src/application/**': { lines: 90, branches: 90 },
      },
    },
  },
});
