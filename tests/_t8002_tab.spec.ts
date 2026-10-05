import { test } from '@playwright/test';
test.use({ video: 'off' });
test('admin at 1280', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  await page.goto('/desk'); await page.waitForTimeout(4000);
  console.log('LANDED ' + new URL(page.url()).pathname);
});
