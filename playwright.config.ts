import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: critical journeys only, against the real backend serving
// the built UI (run `pnpm e2e`, which builds it first).
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: process.env.CI !== undefined,
  reporter:
    process.env.CI === undefined
      ? 'list'
      : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4311',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['desktop.e2e.ts', 'packaged-app.e2e.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // The desktop app, launched by the tests themselves (U82).
    { name: 'desktop', testMatch: 'desktop.e2e.ts' },
    // The packaged app, when built (U84). After the desktop journeys, never
    // alongside them: the app runs one copy at a time (U82), whichever is open.
    {
      name: 'packaged',
      testMatch: 'packaged-app.e2e.ts',
      dependencies: ['desktop'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Stopped as Ctrl+C would stop them, so each removes its temporary archive.
  webServer: [
    {
      // Set up already, for every journey but first-run setup.
      command: 'node test/e2e/serve.ts 4311 set-up',
      url: 'http://127.0.0.1:4311/api/health',
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    {
      // Never set up: first-run setup's own (first-run.e2e.ts).
      command: 'node test/e2e/serve.ts 4312',
      url: 'http://127.0.0.1:4312/api/health',
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
  ],
});
