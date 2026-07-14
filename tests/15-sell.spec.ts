// Sell page: chart pricing, red holder-mismatch lines, bottom strip, the sale.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp, setLink } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const BAGS = ['E0068.1.1', 'E0073.1.1'];
let saleName = '';

test('scan, price, red lines, totals', async ({ page }) => {
  await gotoApp(page, 'sell');
  await setLink(page, '.sl-buyer input', 'KAVITHA');
  await setLink(page, '.sl-chart input', 'PCH-0002');
  await page.locator('.sl-rate input').fill('10581');
  await page.locator('.sl-rate input').blur();

  for (const b of BAGS) {
    await page.locator('.sl-scan input').fill(b);
    await page.locator('.sl-scan input').press('Enter');
    await expect(page.locator(`.sl-rows tr:has-text("${b}")`)).toBeVisible();
  }
  // both pieces held by others -> red mismatch lines + warning
  await expect(page.locator('.sl-rows tr.mismatch')).toHaveCount(2);
  await expect(page.locator('.sl-warn')).toContainText('reserved for someone else');

  // server pricing matches the verified math for E0065.1.1
  const m = await frappeCall(page, 'jewelima.jewelima.api.get_sale_piece',
    { barcode: 'E0068.1.1', price_chart: 'PCH-0002', gold_rate: 10581 });
  expect(m.gold_value).toBeCloseTo(m.nett * 10581, 1);
  expect(m.diamond_value).toBeCloseTo(m.dmd_ct * 56000, 1);
  expect(m.labour_value).toBeCloseTo(Math.max(m.nett * 650, 650), 1);
  expect(m.charges_value).toBe(30);

  // bottom strip grand = sum of both rows' totals
  const rows = await Promise.all(BAGS.map((b) => frappeCall(page, 'jewelima.jewelima.api.get_sale_piece',
    { barcode: b, price_chart: 'PCH-0002', gold_rate: 10581 })));
  const grand = rows.reduce((s: number, r: any) =>
    s + r.gold_value + r.diamond_value + r.stone_value + r.labour_value + r.charges_value, 0);
  const shown = await page.locator('.sl-t-grand').innerText();
  expect(parseFloat(shown.replace(/[₹,]/g, ''))).toBeCloseTo(grand, 0);

  // editing a value updates the strip live
  await page.locator('.sl-rows tr').first().locator('input[data-k="labour_value"]').fill('5000');
  await page.locator('.sl-rows tr').first().locator('input[data-k="labour_value"]').dispatchEvent('input');
  const shown2 = await page.locator('.sl-t-grand').innerText();
  expect(parseFloat(shown2.replace(/[₹,]/g, ''))).not.toBeCloseTo(grand, 0);
  // put it back
  const orig = rows[0].labour_value.toFixed(2);
  await page.locator('.sl-rows tr').first().locator('input[data-k="labour_value"]').fill(orig);
  await page.locator('.sl-rows tr').first().locator('input[data-k="labour_value"]').dispatchEvent('input');
  await page.screenshot({ path: 'test-results/sell.png' });

  // SELL
  await page.locator('.sl-sell').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Sold', { timeout: 20_000 });
  const txt = await page.locator('.modal:visible .modal-body').innerText();
  saleName = (txt.match(/S-\d+/) || [''])[0];
  expect(saleName).toMatch(/^S-\d+$/);
  await page.keyboard.press('Escape');
});

test('sale record, write-off and Sold bags verified', async ({ page }) => {
  await gotoApp(page, 'sell');
  const sale = await frappeCall(page, 'frappe.client.get', { doctype: 'Product Sale', name: saleName });
  expect(sale.customer).toBe('KAVITHA');
  expect(sale.items.length).toBe(2);
  expect(sale.grand_total).toBeGreaterThan(0);
  expect(sale.stock_entry).toBeTruthy();
  const se = await frappeCall(page, 'frappe.client.get', { doctype: 'Stock Entry', name: sale.stock_entry });
  expect(se.stock_entry_type).toBe('Material Issue');
  expect(se.docstatus).toBe(1);

  for (const b of BAGS) {
    const v = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Order Bag', filters: b, fieldname: ['stock_status', 'held_by'] });
    expect(v.stock_status).toBe('Sold');
    expect(v.held_by).toBe('KAVITHA');
  }
  // sold pieces vanish from the sellable pool; holder move logged with the sale ref
  const pool = await frappeCall(page, 'jewelima.jewelima.api.get_certifiable_pieces');
  expect(pool.some((p: any) => BAGS.includes(p.order_bag))).toBe(false);
  const log = await frappeCall(page, 'jewelima.jewelima.api.get_recent_holder_transfers');
  expect(log[0].reason).toContain(saleName);
});
