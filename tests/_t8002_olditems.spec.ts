// J-Accounts › Migration › Old Items: no "Combined", second labels are Deleted, heads are picked.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_olditems --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('Old Items shows stock heads and three states', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/ja-old-items');
  const p = page.locator('#page-ja-old-items');
  await expect(p.locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
  await expect(p.locator('.oi-kpis')).not.toContainText('Combined');
  await expect(p.locator('.oi-kpis')).toContainText('No stock head');
  const row = p.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: /^DIAMOND ORNAMENTS 18CT$/ }) });
  await expect(row.locator('.oi-s')).toHaveText('Deleted');
  await expect(row.locator('td.nn')).toContainText('DIAMOND ORNAMENTS 18KT');
  await row.locator('td.nn').click();
  const dlg = page.locator('.modal.show');
  await expect(dlg.locator('select[data-fieldname="head"]')).toHaveValue('DIAMOND ORNAMENTS 18KT');
  expect(await dlg.locator('select[data-fieldname="head"] option').count()).toBeGreaterThan(30);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: process.env.SHOT || 'olditems.png' });
  expect(errors).toEqual([]);
});
