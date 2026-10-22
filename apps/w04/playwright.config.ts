import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { outputFolder: 'docs/playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    browserName: 'chromium',
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    baseURL: 'http://127.0.0.1:4180',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node scripts/serve-static.mjs --port 4180', url: 'http://127.0.0.1:4180/', reuseExistingServer: false, timeout: 15_000 },
    { command: 'node scripts/serve-static.mjs --port 4181 --base /stereo-perception-lab/', url: 'http://127.0.0.1:4181/stereo-perception-lab/', reuseExistingServer: false, timeout: 15_000 },
  ],
});
