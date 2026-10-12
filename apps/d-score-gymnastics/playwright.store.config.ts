import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: 'test-results/store-screenshots',
  projects: [
    {
      name: 'app-store-6.9-inch',
      use: {
        browserName: 'chromium',
        colorScheme: 'light',
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        viewport: { height: 956, width: 440 },
      },
    },
  ],
  reporter: 'list',
  testDir: './e2e',
  testMatch: 'store-screenshots.store.ts',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4180',
    locale: 'en-US',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'pnpm export:web && pnpm exec expo serve dist --port 4180',
    reuseExistingServer: false,
    timeout: 180_000,
    url: 'http://127.0.0.1:4180',
  },
  workers: 1,
});
