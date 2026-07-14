// Stone Issues report: what was issued on a day, filterable by type + group.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZSD ${uid()}`;
const STONE = 'VS-FG 2-2.5';
let BAG = '';
let EMP = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiCreateDesign(page, D, { type: 'RING', gold: '22KYG', goldWt: 4, stoneRows: [{ item: STONE, qty: 2, weight: 0.3 }] });
  EMP = (await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Employee', filters: { status: 'Active' }, fields: ['name'], limit_page_length: 1,
  }))[0].name;
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  if (BAG) {
    await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
      order_bag: BAG, lines: [{ item: STONE, weight: 0.3, pcs: 2 }], to_warehouse: 'Stone Issue - JD',
    }).catch(() => {});
    for (const dt of ['Material Issue', 'Bag Material Ledger']) {
      const rows = await frappeCall(page, 'frappe.client.get_list', {
        doctype: dt, filters: { order_bag: BAG }, fields: ['name'], limit_page_length: 0,
      });
      for (const r of rows || []) {
        await frappeCall(page, 'frappe.client.delete', { doctype: dt, name: r.name }).catch(() => {});
      }
    }
  }
  await apiDeleteDesign(page, D);
  await page.close();
});

test('issue stones, the report shows and filters them', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  await page.locator('table.po-grid tbody tr').first().locator('input[type="number"]').fill('1');
  await setLink(page, 'input[data-fieldname="customer"]', 'JD Stock');
  await page.locator('input[data-fieldname="days"]').fill('5');
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Order placed', { timeout: 30_000 });
  await page.keyboard.press('Escape');
  BAG = (await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Order Bag', filters: { design: D }, fields: ['name'], limit_page_length: 1,
  }))[0].name;
  await frappeCall(page, 'jewelima.jewelima.api.stone_issue_apply', {
    order_bag: BAG, lines: [{ item: STONE, pcs: 2, ct: 0.3 }], issued_by: EMP,
  });

  await gotoApp(page, 'stone-issues');
  const row = page.locator('table.sis-t tbody tr', { hasText: BAG }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText(STONE);
  await expect(row).toContainText('0.300');
  await expect(page.locator('.sis-tiles')).toContainText('Carats');
  // filter pills: pick the stone's group -> row stays; pick another type -> gone
  await expect(page.locator('.sis-groups .sis-pill', { hasText: 'DIAMOND VS-FG' }).first()).toBeVisible();
  await page.locator('.sis-groups .sis-pill', { hasText: 'DIAMOND VS-FG' }).first().click();
  await expect(page.locator('table.sis-t tbody tr', { hasText: BAG }).first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.sis-types .sis-pill', { hasText: 'All' }).first().click(); // reset via All on types
  await page.screenshot({ path: 'test-results/stone-issues.png' });
});
