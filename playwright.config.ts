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
    launchOptions: {
      slowMo: process.env.FAST ? 0 : 60, // pacing so clicks read on video; FAST=1 drops it
      // RESOLVE_MAP routes a hostname straight to an IP inside the browser, so the
      // URL and the Host header stay exactly as they are while the connection skips
      // the public path. Used to reach prod over Tailscale instead of Cloudflare.
      args: process.env.RESOLVE_MAP ? [`--host-resolver-rules=MAP ${process.env.RESOLVE_MAP}`] : [],
    },
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
