import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Avoid Bun's test runner accidentally executing Playwright specs.
  // Keep Playwright-only tests with a dedicated suffix.
  testMatch: '**/*.pw.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Start daemon + dashboard together so admin APIs are available during E2E.
    command: 'bun run --cwd ../.. start',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
