import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI === 'true' ? 2 : 4,
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], colorScheme: 'light' },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], colorScheme: 'light' },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 14'], colorScheme: 'light' },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
  ],
  reporter: process.env.CI === 'true' ? [['github'], ['html', { open: 'never' }]] : 'list',
  retries: 0,
  testDir: './e2e',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      process.env.DSCORE_USE_EXISTING_BUILD === '1'
        ? 'pnpm serve:web'
        : 'pnpm export:web && pnpm serve:web',
    reuseExistingServer: false,
    timeout: 180_000,
    url: 'http://127.0.0.1:4173',
  },
});
