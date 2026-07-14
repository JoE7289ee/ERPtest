// Transfer Order Bag: pinned strip totals + dynamic stone-bucket columns.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('scan two cards -> strip + dynamic columns', async ({ page }) => {
  await gotoApp(page, 'transfer-order-bag');
  await expect(page.locator('.tob-strip')).toBeVisible();
  await expect(page.locator('.tob-s-bags')).toHaveText('0');
  // find two cards at the same location carrying diamonds
  const rows = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Order Bag',
    filters: [['stock_status', '=', 'In Production'], ['is_finished', '=', 0], ['location', '=', 'CASTING']],
    fields: ['name'], limit_page_length: 6,
  });
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (const r of rows.slice(0, 2)) {
    await page.locator('.tob-scan input').fill(r.name);
    await page.locator('.tob-scan input').press('Enter');
    await expect(page.locator(`table.tob-grid tr:has-text("${r.name}")`)).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.locator('.tob-s-bags')).toHaveText('2');
  const pcs = await page.locator('.tob-s-pcs').innerText();
  expect(Number(pcs)).toBeGreaterThanOrEqual(2);
  // bucket columns exist ONLY for buckets present in the batch
  const heads = await page.locator('table.tob-grid thead th').allInnerTexts();
  const bucketHeads = heads.filter((h) => /(DMD|PS|CS|CVD|PDMD|POTH)/.test(h));
  const chips = await page.locator('.tob-s-buckets .b .bk').allInnerTexts();
  expect(bucketHeads.length).toBe(chips.length); // strip chips mirror the live columns
  await page.screenshot({ path: 'test-results/transfer-strip.png' });
});
