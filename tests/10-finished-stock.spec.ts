// Finished Stock + At Certification (Reports > Stock Reports): design-type x
// holder matrices of the finished pool, one page per status.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
let flipped: string[] = [];

test('finished-stock groups by design type and matches the API', async ({ page }) => {
  await gotoApp(page, 'finished-stock');
  const api = await frappeCall(page, 'jewelima.jewelima.api.get_finished_stock_matrix', { status: 'In Stock' });
  expect(api.totals.types).toBeGreaterThan(0);

  const cards = page.locator('.fm-card .v');
  await expect(cards.nth(0)).toHaveText(String(api.totals.pieces));
  await expect(cards.nth(1)).toHaveText(String(api.totals.types));
  await expect(cards.nth(2)).toHaveText(String(api.totals.holders));
  await expect(cards.nth(3)).toHaveText(`${api.totals.gold.toFixed(3)} g`);
  await expect(cards.nth(4)).toHaveText(`${api.totals.stones.toFixed(3)} ct`);

  // one row per DESIGN TYPE, one column per holder
  await expect(page.locator('table.fm-tbl thead th')).toHaveCount(api.locations.length + 2);
  await expect(page.locator('table.fm-tbl tbody tr')).toHaveCount(api.types.length);
  const first = api.types[0];
  const row0 = page.locator('table.fm-tbl tbody tr').first();
  await expect(row0).toContainText(first.design_type);
  await expect(row0.locator('td.tot')).toContainText(String(first.pieces));
  const cellSum = Object.values(first.cells as Record<string, any>).reduce((s: number, c: any) => s + c.pc, 0);
  expect(cellSum).toBe(first.pieces);

  // search narrows
  await page.locator('.fm-search').fill(first.design_type);
  await expect(page.locator('table.fm-tbl tbody tr').first()).toContainText(first.design_type);
  await page.locator('.fm-search').fill('');
  await expect(page.locator('table.fm-tbl tbody tr')).toHaveCount(api.types.length);
  await page.screenshot({ path: 'test-results/finished-stock.png' });
});

test('at-certification page shows flipped pieces; finished-stock drops them', async ({ page }) => {
  await gotoApp(page, 'finished-stock');
  const before = await frappeCall(page, 'jewelima.jewelima.api.get_finished_stock_matrix', { status: 'In Stock' });
  // send two pieces "to certification" (status flip; restored below)
  flipped = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.get_list', args: {
      doctype: 'Order Bag', filters: { is_finished: 1, stock_status: 'In Stock' }, limit_page_length: 2, pluck: 'name' } });
    const names = r.message.map((x: any) => x.name || x);
    for (const nm of names) {
      await f.call({ method: 'frappe.client.set_value', args: { doctype: 'Order Bag', name: nm, fieldname: 'stock_status', value: 'At Certification' } });
    }
    return names;
  });
  expect(flipped.length).toBe(2);

  await gotoApp(page, 'at-certification');
  const cert = await frappeCall(page, 'jewelima.jewelima.api.get_finished_stock_matrix', { status: 'At Certification' });
  expect(cert.totals.pieces).toBe(2);
  await expect(page.locator('.fm-card .v').nth(0)).toHaveText('2');
  await expect(page.locator('td.fm-cell.cert').first()).toBeVisible(); // amber cells
  await page.screenshot({ path: 'test-results/at-certification.png' });

  // finished stock now shows 2 fewer pieces
  const after = await frappeCall(page, 'jewelima.jewelima.api.get_finished_stock_matrix', { status: 'In Stock' });
  expect(after.totals.pieces).toBe(before.totals.pieces - 2);

  // restore
  await page.evaluate(async (names) => {
    const f = (window as any).frappe;
    for (const nm of names) {
      await f.call({ method: 'frappe.client.set_value', args: { doctype: 'Order Bag', name: nm, fieldname: 'stock_status', value: 'In Stock' } });
    }
  }, flipped);
  const restored = await frappeCall(page, 'jewelima.jewelima.api.get_finished_stock_matrix', { status: 'In Stock' });
  expect(restored.totals.pieces).toBe(before.totals.pieces);
});
