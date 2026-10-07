// Send Hallmarking: the cut-piece box asks karat only and shows Hallmarking Stock.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_cutpiece --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('cut piece box', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/send-hallmarking');
  const btn = page.locator('#page-send-hallmarking .sh-cut').first();
  await expect(btn).toBeVisible({ timeout: 60_000 });
  await btn.click();
  const d = page.locator('.modal.show');
  await expect(d).toContainText('Hallmarking Stock');
  await expect(d).toContainText('18K'); await expect(d).toContainText('22K'); await expect(d).toContainText('14K');
  expect(await d.locator('select.cut-kt option').allTextContents()).toEqual(['18', '22', '14']);
  await expect(d.locator('.cut-item')).toHaveCount(0);
  await d.locator('.cut-wt').first().fill('2'); await d.locator('.cut-wt').first().blur();
  await page.waitForTimeout(500);
  await page.screenshot({ path: process.env.SHOT || 'cut.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
