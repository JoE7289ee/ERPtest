// Place Order: Remark all adds one remark to every filled line, after what a line already says.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_remark_all --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('remark all', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/place-order');
  const btn = page.locator('.page-actions .btn, .page-actions button', { hasText: 'Remark all' }).first();
  await expect(btn).toBeVisible({ timeout: 60_000 });
  // with no line filled it says so and changes nothing
  await btn.click();
  await page.locator('.modal.show textarea').fill('URGENT');
  await page.locator('.modal.show .btn-primary').first().click();
  await expect(page.locator('.alert, .desk-alert').filter({ hasText: 'No lines to remark yet' }).first()).toBeVisible({ timeout: 8000 });
  expect(errors).toEqual([]);
});
