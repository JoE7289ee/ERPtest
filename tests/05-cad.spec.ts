// CAD-first orders: budgets dialog, routing/collect gates, finalize, CAD Jobs page.
import { expect, test } from '@playwright/test';
import { apiDeleteDesign, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const REAL = `ZZCADFIN ${uid()}`;
let bagName = '';

test('CAD line: dialog -> order places without a design', async ({ page }) => {
  await gotoApp(page, 'place-order');
  const row = page.locator('table.po-grid tbody tr').first();
  await row.locator('button', { hasText: /^CAD$/ }).click();
  const d = page.locator('.modal:visible');
  await setLink(page, '.modal:visible input[data-fieldname="design_type"]', 'RING');
  await setLink(page, '.modal:visible input[data-fieldname="karat"]', '22KYG');
  await d.locator('input[data-fieldname="gold_weight"]').fill('RANGE 8 to 9');
  await d.locator('input[data-fieldname="diamond_weight"]').fill('0.5');
  await d.locator('input[data-fieldname="stone_no"]').fill('6');
  await d.locator('input[data-fieldname="reference"]').fill('CAT-REF-77');
  await d.locator('.btn-primary', { hasText: 'Set CAD Line' }).click();
  // line locks the Design input and flags CAD
  await expect(row.locator('button', { hasText: 'CAD ✓' })).toBeVisible();
  await expect(row).toContainText('RING · CAD');
  await row.locator('input[type="number"]').fill('1');
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Order placed', { timeout: 30_000 });
  const modalText = await page.locator('.modal:visible .modal-body').innerText();
  const orderNo = (modalText.match(/E\d+/) || [''])[0]; // "E0005 created with N Order Bag(s)".
  await page.keyboard.press('Escape');
  bagName = `${orderNo}.1.1`;
  const bag = await frappeCall(page, 'frappe.client.get', { doctype: 'Order Bag', name: bagName });
  expect(bag.is_cad).toBe(1);
  expect(bag.cad_gold_weight).toBe('RANGE 8 to 9');
  expect(bag.cad_reference).toBe('CAT-REF-77');
});

test('gates: only CAD accepts it; pinned at CAD; collect refused', async ({ page }) => {
  await gotoApp(page, 'cad-jobs');
  // must appear on the CAD Jobs list
  await expect(page.locator('table.cj-tbl')).toContainText(bagName);
  // transfer to a work bench is refused, CAD is fine, out of CAD refused
  const err1 = await page.evaluate(async (nm) => {
    const f = (window as any).frappe;
    try { await f.call({ method: 'jewelima.jewelima.api.transfer_order_bag', args: { order_bag: nm, to_location: 'GRINDING' } }); return ''; }
    catch (e: any) { return String(e && e.message || 'blocked'); }
  }, bagName);
  expect(err1).not.toBe('');
  await frappeCall(page, 'jewelima.jewelima.api.transfer_order_bag', { order_bag: bagName, to_location: 'CAD' });
  const collect = await frappeCall(page, 'jewelima.jewelima.api.collect_bench_cards', { names: JSON.stringify([bagName]), location: 'CAD' });
  expect(collect.errors[0].error).toContain('CAD design not finalized');
});

test('finalize from CAD Jobs: real design attaches, flag clears, bag flows on', async ({ page }) => {
  await gotoApp(page, 'cad-jobs');
  const row = page.locator('table.cj-tbl tr', { hasText: bagName });
  await expect(row).toContainText('RANGE 8 to 9');
  await row.locator('button', { hasText: 'Finalize' }).click();
  const d = page.locator('.modal:visible');
  await expect(d).toContainText('CAD budget');
  await d.locator('input[data-fieldname="design_name"]').fill(REAL);
  // the gold row is prefilled with the budget karat — add nothing else, just create
  await d.locator('.btn-primary', { hasText: 'Create & Attach' }).click();
  await expect(page.locator('table.cj-tbl tr', { hasText: bagName })).toHaveCount(0, { timeout: 30_000 });
  const bag = await frappeCall(page, 'frappe.client.get', { doctype: 'Order Bag', name: bagName });
  expect(bag.is_cad).toBe(0);
  expect(bag.design).toBe(REAL);
  expect(bag.bag_bom.length).toBeGreaterThan(0);
  // now it assigns + collects + moves on
  await frappeCall(page, 'jewelima.jewelima.api.assign_bench_cards', { names: JSON.stringify([bagName]), location: 'CAD' });
  const collect = await frappeCall(page, 'jewelima.jewelima.api.collect_bench_cards', { names: JSON.stringify([bagName]), location: 'CAD' });
  expect(collect.count).toBe(1);
  await frappeCall(page, 'jewelima.jewelima.api.transfer_order_bag', { order_bag: bagName, to_location: 'WAX INJECTING' });
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiDeleteDesign(page, REAL);
  await page.close();
});
