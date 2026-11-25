import { defineConfig, devices } from '@playwright/test';

// A sweep across releases expects many failures on old ones, so it gives up on each sooner.
const sweep = Boolean(process.env.HOLT_SWEEP);

export default defineConfig({
  testDir: '.',
  timeout: sweep ? 15_000 : 30_000,
  expect: { timeout: sweep ? 3_000 : 5_000 },
  // Each worker starts its own wiki container.
  workers: 4,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: sweep ? 'off' : 'retain-on-failure',
    actionTimeout: sweep ? 5_000 : 0,
  },
});
