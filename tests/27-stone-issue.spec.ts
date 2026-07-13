// Stone Issue station: scan a card, BOM stone lines show plan/issued/available,
// edit a line (sieve swap + piece count scales plan ct by the per-piece average),
// add a brand-new stone (blank plan fills from the actual), issuing (with
// Issued By) moves ct from the warehouse into In Bags + ledger + Material Issue
// record; right side shows the issuer's day and the warehouse stock.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZSI ${uid()}`;
const STONE = 'VS-FG 5-5.5';
const SWAPPED = 'VS-FG 3-3.5'; // the sieve size that "works"
const ADDED = 'SI-IJ 1-1.5'; // the extra stone the design never had
let BAG = '';
let EMP = '';
let EMP_NAME = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiCreateDesign(page, D, { type: 'RING', gold: '22KYG', goldWt: 5, stoneRows: [{ item: STONE, qty: 3, weight: 0.45 }] });
  const emps = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Employee', filters: { status: 'Active' }, fields: ['name', 'employee_name'], limit_page_length: 1,
  });
  EMP = emps[0].name;
  EMP_NAME = emps[0].employee_name;
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  if (BAG) {
    // reverse the issued stones precisely: In Bags -> back to Stone Issue
    await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
      order_bag: BAG,
      lines: [{ item: SWAPPED, weight: 0.6 }, { item: ADDED, weight: 0.1 }],
      to_warehouse: 'Stone Issue - JD',
    }).catch(() => {});
    // paper trail + ledger rows don't cascade with the bag — remove them explicitly
    const mis = await frappeCall(page, 'frappe.client.get_list', {
      doctype: 'Material Issue', filters: { order_bag: BAG }, fields: ['name'], limit_page_length: 0,
    });
    for (const m of mis || []) {
      await frappeCall(page, 'frappe.client.delete', { doctype: 'Material Issue', name: m.name }).catch(() => {});
    }
    const rows = await frappeCall(page, 'frappe.client.get_list', {
      doctype: 'Bag Material Ledger', filters: { order_bag: BAG }, fields: ['name'], limit_page_length: 0,
    });
    for (const r of rows || []) {
      await frappeCall(page, 'frappe.client.delete', { doctype: 'Bag Material Ledger', name: r.name }).catch(() => {});
    }
  }
  await apiDeleteDesign(page, D);
  await page.close();
});

test('place an order carrying stones', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  await page.locator('table.po-grid tbody tr').first().locator('input[type="number"]').fill('1');
  await setLink(page, 'input[data-fieldname="customer"]', 'JD Stock');
  await page.locator('input[data-fieldname="days"]').fill('5');
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Order placed', { timeout: 30_000 });
  await page.keyboard.press('Escape');
  const bags = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Order Bag', filters: { design: D }, fields: ['name'], limit_page_length: 1,
  });
  BAG = bags[0].name;
  expect(BAG).toBeTruthy();
});

test('edit (swap + pcs), add a new stone, issue with Issued By, panels update', async ({ page }) => {
  await gotoApp(page, 'stone-issue');
  // the stock panel renders without any card
  await expect(page.locator('.si-stock-b table, .si-stock-b .p-empty')).toBeVisible({ timeout: 10_000 });

  await page.locator('.si-scan-box input').fill(BAG);
  await page.locator('.si-scan-box input').press('Enter');
  await expect(page.locator('.si-bag')).toHaveText(BAG);
  const row = page.locator('table.si-grid tbody tr').first();
  await expect(row).toContainText(STONE);
  await expect(row.locator('td').nth(1)).toHaveText('3 / 0.450'); // plan

  // edit: swap the sieve size AND bump pieces 3 -> 4; plan ct scales 0.45/3*4 = 0.600
  await row.locator('.si-edit').click();
  await setLink(page, '.modal:visible input[data-fieldname="to_item"]', SWAPPED);
  await page.locator('.modal:visible input[data-fieldname="pcs"]').fill('4');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Save' }).click();
  await expect(row).toContainText(SWAPPED, { timeout: 15_000 });
  await expect(row.locator('td').nth(1)).toHaveText('4 / 0.600');

  // add a stone the design never had — plan weight left BLANK
  await page.locator('.si-add').click();
  await setLink(page, '.modal:visible input[data-fieldname="item"]', ADDED);
  await page.locator('.modal:visible input[data-fieldname="pcs"]').fill('2');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Add' }).click();
  const row2 = page.locator('table.si-grid tbody tr', { hasText: ADDED }).first();
  await expect(row2).toBeVisible({ timeout: 15_000 });
  await expect(row2.locator('td').nth(1)).toHaveText('2 / 0.000'); // blank plan

  const binBefore = await frappeCall(page, 'frappe.client.get_value', {
    doctype: 'Bin', filters: { item_code: SWAPPED, warehouse: 'Stone Issue - JD' }, fieldname: 'actual_qty',
  });

  // no Issued By -> refused
  await row.locator('.si-pcs').fill('4');
  await row.locator('.si-ct').fill('0.6');
  await row2.locator('.si-pcs').fill('2');
  await row2.locator('.si-ct').fill('0.1');
  await page.locator('.si-go').click();
  await expect(page.locator('.modal:visible')).toContainText('who is issuing');
  await page.keyboard.press('Escape');

  // with Issued By -> goes through; the day panel appears
  await setLink(page, '.si-by-box input', EMP_NAME);
  await expect(page.locator('.si-today-panel')).toBeVisible({ timeout: 10_000 });
  await page.locator('.si-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(row.locator('td').nth(2)).toHaveText('4 / 0.600', { timeout: 20_000 }); // issued
  await expect(row2.locator('td').nth(2)).toHaveText('2 / 0.100');
  await expect(row2.locator('td').nth(1)).toHaveText('2 / 0.100'); // blank plan filled from the actual

  // day history lists both lines; totals add up
  await expect(page.locator('.si-today-t')).toHaveText('6 pcs · 0.700 ct');
  await expect(page.locator('.si-today-b')).toContainText(SWAPPED);
  await expect(page.locator('.si-today-b')).toContainText(ADDED);

  // real stock left the warehouse (of the SWAPPED item)
  const binAfter = await frappeCall(page, 'frappe.client.get_value', {
    doctype: 'Bin', filters: { item_code: SWAPPED, warehouse: 'Stone Issue - JD' }, fieldname: 'actual_qty',
  });
  expect(Number(binBefore.actual_qty) - Number(binAfter.actual_qty)).toBeCloseTo(0.6, 3);

  // ledger rows carry the employee; one Material Issue record with both lines
  const led = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Bag Material Ledger', filters: { order_bag: BAG, entry_type: 'Stone Issue' },
    fields: ['item', 'qty', 'pcs', 'employee'], limit_page_length: 0,
  });
  expect(led.length).toBe(2);
  expect(led.every((r: any) => r.employee === EMP)).toBe(true);
  const mis = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Material Issue', filters: { order_bag: BAG, issue_type: 'Stone' },
    fields: ['name', 'issued_by'], limit_page_length: 0,
  });
  expect(mis.length).toBe(1);
  const mi = await frappeCall(page, 'frappe.client.get', { doctype: 'Material Issue', name: mis[0].name });
  expect(mi.items.length).toBe(2);
});

test('a finished / non-floor card is refused', async ({ page }) => {
  await gotoApp(page, 'stone-issue');
  await page.locator('.si-scan-box input').fill('NOPE-000');
  await page.locator('.si-scan-box input').press('Enter');
  await expect(page.locator('.modal:visible')).toContainText('not found');
});
