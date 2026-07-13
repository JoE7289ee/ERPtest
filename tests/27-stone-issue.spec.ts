// Stone Issue station: scan a card, BOM stone lines show plan/issued/available,
// issuing moves ct from the Stone Issue warehouse into In Bags + writes the ledger.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZSI ${uid()}`;
const STONE = 'VS-FG 5-5.5';
let BAG = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiCreateDesign(page, D, { type: 'RING', gold: '22KYG', goldWt: 5, stoneRows: [{ item: STONE, qty: 3, weight: 0.45 }] });
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  if (BAG) {
    // reverse the issued stones precisely: In Bags -> back to Stone Issue
    await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
      order_bag: BAG, lines: [{ item: STONE, weight: 0.45 }], to_warehouse: 'Stone Issue - JD',
    }).catch(() => {});
    // ledger rows don't cascade with the bag — remove them explicitly
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

test('scan shows the BOM stones; issuing updates ledger + stock', async ({ page }) => {
  await gotoApp(page, 'stone-issue');
  const binBefore = await frappeCall(page, 'frappe.client.get_value', {
    doctype: 'Bin', filters: { item_code: STONE, warehouse: 'Stone Issue - JD' }, fieldname: 'actual_qty',
  });

  await page.locator('.si-scan-box input').fill(BAG);
  await page.locator('.si-scan-box input').press('Enter');
  await expect(page.locator('.si-bag')).toHaveText(BAG);
  await expect(page.locator('.si-wh')).toHaveText('Stone Issue - JD');
  const row = page.locator('table.si-grid tbody tr').first();
  await expect(row).toContainText(STONE);
  await expect(row.locator('td').nth(1)).toHaveText('3 / 0.450'); // plan
  await expect(row.locator('td').nth(2)).toHaveText('0 / 0.000'); // nothing issued yet

  await row.locator('.si-pcs').fill('3');
  await row.locator('.si-ct').fill('0.45');
  await expect(page.locator('.si-sum')).toContainText('3 pcs');
  await page.locator('.si-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(row.locator('td').nth(2)).toHaveText('3 / 0.450', { timeout: 20_000 }); // issued column caught up

  // real stock left the Stone Issue warehouse
  const binAfter = await frappeCall(page, 'frappe.client.get_value', {
    doctype: 'Bin', filters: { item_code: STONE, warehouse: 'Stone Issue - JD' }, fieldname: 'actual_qty',
  });
  expect(Number(binBefore.actual_qty) - Number(binAfter.actual_qty)).toBeCloseTo(0.45, 3);

  // and the bag's ledger holds a Stone Issue row
  const led = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Bag Material Ledger', filters: { order_bag: BAG, entry_type: 'Stone Issue' }, fields: ['qty', 'pcs'], limit_page_length: 0,
  });
  expect(led.length).toBe(1);
  expect(Number(led[0].qty)).toBeCloseTo(0.45, 3);
  expect(Number(led[0].pcs)).toBe(3);
});

test('a finished / non-floor card is refused', async ({ page }) => {
  await gotoApp(page, 'stone-issue');
  await page.locator('.si-scan-box input').fill('NOPE-000');
  await page.locator('.si-scan-box input').press('Enter');
  await expect(page.locator('.modal:visible')).toContainText('not found');
});
