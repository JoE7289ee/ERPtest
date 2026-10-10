// Lots -> click a lot -> Lot Selection opens THAT lot, the first time and every time after.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_lot_click --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('lot click opens the lot', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/stone-lots');
  const rows = page.locator('.sl-grid-t tr.clickable');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const first = await rows.nth(0).getAttribute('data-name');
  const second = await rows.nth(1).getAttribute('data-name');
  await rows.nth(0).click();
  await expect(page).toHaveURL(new RegExp('lot-selection/' + first));
  await expect(page.locator('.ls-one')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(first!, { exact: true }).locator('visible=true').first()).toBeVisible();
  await expect(page.locator('.ls-one')).toBeVisible();
  // back to Lots, another lot
  await page.locator('.page-actions button:visible', { hasText: 'Stone Lots' }).first().click();
  await expect(page.locator('.sl-grid-t tr.clickable').nth(1)).toBeVisible({ timeout: 30_000 });
  await page.locator('.sl-grid-t tr.clickable').nth(1).click();
  await expect(page).toHaveURL(new RegExp('lot-selection/' + second));
  await expect(page.getByText(second!, { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(first!, { exact: true }).locator('visible=true')).toHaveCount(0);
  // and the bare page shows the board again
  await page.evaluate(() => (window as any).frappe.set_route('stone-lots'));
  await expect(page.locator('.sl-grid-t tr.clickable').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => (window as any).frappe.set_route('lot-selection'));
  await expect(page.locator('.ls-board')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
