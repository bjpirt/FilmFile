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
});
