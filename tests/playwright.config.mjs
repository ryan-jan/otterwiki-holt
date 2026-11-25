import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Each worker starts its own wiki container.
  workers: 4,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
});
