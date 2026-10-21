// The shared test bot: plays the real game in headless Chromium with keyboard input.
// Run it with `npm run bot` from hafnia/. See bot/README.md.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BOT_PORT || 4317);
const url = process.env.BOT_URL || `http://127.0.0.1:${port}/`;

export default defineConfig({
  testDir: './scenarios',
  testMatch: '**/*.bot.ts',
  outputDir: './results/artifacts',
  globalSetup: './lib/global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: './results/report', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: url,
    viewport: { width: 1100, height: 900 },
    trace: 'on-first-retry',  // the bot polls the page a lot, so traces are big: only on CI's retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.BOT_URL ? undefined : {
    command: 'node bot/serve.mjs',
    cwd: '..',
    url: `${url}play.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe'
  }
});
