import { defineConfig, devices } from '@playwright/test';

// Teaching-video config: every tutorial records a clean 1280x800 video with an
// injected cursor + caption overlay (see tests/helpers/tutorial.ts). Runs one at
// a time against the dev bench (or BASE_URL for the live server).
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 300_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://development.localhost:8000',
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    trace: 'off',
    screenshot: 'off',
    launchOptions: { slowMo: 60 }, // a touch of pacing so clicks read on video
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, storageState: '.auth/user.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  outputDir: 'test-results',
});
