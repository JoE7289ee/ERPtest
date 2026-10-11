// Casting Queue > Weigh wax: the gold the weight comes to shows as it is typed, and a weight
// that leaves no gold says why.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_wax_dialog --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('wax dialog shows the gold live', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let edit: any = null;
  page.on('response', async (r) => { if (r.url().includes('get_tree_edit')) edit = (await r.json()).message; });
  await page.goto('/desk/casting-queue');
  const tile = page.locator('.cq-grid > *').first();
  await expect(tile).toBeVisible({ timeout: 60_000 });
  await tile.click();
  await page.locator('.cq-panel .p-wax').click();
  const wax = page.locator('.modal.show input[data-fieldname="wax"]');
  await expect(wax).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => edit).not.toBeNull();
  const stem = edit.stem, st = edit.stone_weight, mult = edit.multiplier;
  expect(stem).toBe(3); expect(mult).toBeGreaterThan(0);
  await wax.fill('10');
  const want = ((10 - stem - st) * mult).toFixed(3);
  await expect(page.locator('.modal.show [data-fieldname="approx"]')).toContainText(want + ' g');
  await wax.fill('2.5');
  await expect(page.locator('.modal.show [data-fieldname="approx"]')).toContainText('leaves no gold');
  await wax.fill('');
  await expect(page.locator('.modal.show [data-fieldname="approx"]')).toHaveText('');
  await wax.fill('12.345');
  await page.screenshot({ path: 'test-results/wax-dialog.png' });
  console.log('TREE', edit.tree, edit.karat, 'stones', st, 'mult', mult, '10 g ->', want);
  await page.locator('.modal.show .btn-modal-close, .modal.show .close').first().click();
  expect(errors).toEqual([]);
});
