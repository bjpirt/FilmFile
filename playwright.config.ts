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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node test/e2e/serve.ts',
    url: 'http://127.0.0.1:4311/api/health',
    reuseExistingServer: false,
    // Stop it as Ctrl+C would, so it removes its temporary archive.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
