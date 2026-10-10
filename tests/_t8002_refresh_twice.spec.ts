// Refresh on a page whose button action is a jQuery promise: works every time, never throws, never stays grey.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_refresh_twice --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
for (const route of ['job-work-records', 'transfer-records', 'parcel', 'sales-history', 'my-bucket']) {
  test('refresh twice: ' + route, async ({ page, context }) => {
    test.setTimeout(120_000);
    await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/desk/' + route);
    const btn = page.locator('.page-actions button:visible', { hasText: 'Refresh' }).first();
    await expect(btn).toBeVisible({ timeout: 60_000 });
    for (let i = 0; i < 3; i++) {
      await btn.click();
      await expect(btn).toBeEnabled({ timeout: 30_000 });
    }
    expect(errors).toEqual([]);
  });
}
