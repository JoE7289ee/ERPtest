// Stone Audit: pcs/ct drift detection + fixes. Weight Reduce now demands pcs on
// stone lines; the audit page zeroes orphaned counts and sweeps residual carats
// into a stage's -LOSS bucket.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZSA ${uid()}`;
const STONE = 'VS-FG 5-5.5';
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
    // undo the sweep: cancel + delete ITS Stock Entry (In Bags -> Casting -LOSS,
    // the newest one for this item today), which puts 0.449 back into In Bags…
    await page.evaluate(async () => {
      const f = (window as any).frappe;
      const se = await f.call({ method: 'frappe.client.get_list', args: {
        doctype: 'Stock Entry Detail', parent: 'Stock Entry',
        filters: { item_code: 'VS-FG 5-5.5', t_warehouse: 'Casting -LOSS - JD', qty: 0.449 },
        fields: ['parent'], limit_page_length: 1, order_by: 'creation desc', parent_doctype: 'Stock Entry',
      } });
      for (const r of (se.message || [])) {
        await f.call({ method: 'frappe.client.cancel', args: { doctype: 'Stock Entry', name: r.parent } }).catch(() => {});
        await f.call({ method: 'frappe.client.delete', args: { doctype: 'Stock Entry', name: r.parent } }).catch(() => {});
      }
    });
    // …then return those 0.449 ct from In Bags to the Stone Issue warehouse
    await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
      order_bag: BAG, lines: [{ item: STONE, weight: 0.449, pcs: 0 }], to_warehouse: 'Stone Issue - JD',
    }).catch(() => {});
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

test('setup: order + issue stones', async ({ page }) => {
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
    order_bag: BAG, lines: [{ item: STONE, pcs: 3, ct: 0.45 }], issued_by: EMP,
  });
});

test('weight-reduce page demands pcs on stone lines', async ({ page }) => {
  await gotoApp(page, 'weight-reduce');
  const scan = page.locator('input').first();
  await scan.fill(BAG);
  await scan.press('Enter');
  const srow = page.locator('tbody tr', { hasText: STONE }).first();
  await expect(srow).toBeVisible({ timeout: 15_000 });
  await expect(srow).toContainText('(3 pcs)');
  await srow.locator('.wt-redwt').fill('0.45');
  await page.locator('button', { hasText: 'Weight Reduce' }).click();
  await expect(page.locator('.modal:visible')).toContainText('is a stone'); // refused without pcs
  await page.keyboard.press('Escape');
});

test('audit: zero the orphaned count, then sweep residual carats', async ({ page }) => {
  // create drift ON PURPOSE via the API (page now blocks it): all carats out, no pcs
  await gotoApp(page, 'stone-audit');
  await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
    order_bag: BAG, lines: [{ item: STONE, weight: 0.45, pcs: 0 }], to_warehouse: 'Stone Issue - JD',
  });
  await page.reload();
  const row = page.locator('table.sa-grid tbody tr', { hasText: BAG }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText('Count without weight');
  await expect(row).toContainText('3'); // net pcs
  await row.locator('.sa-fix').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('table.sa-grid tbody tr', { hasText: BAG })).toHaveCount(0, { timeout: 15_000 });

  // now the reverse: residual carats with no pcs — issue again, reduce only the count
  await frappeCall(page, 'jewelima.jewelima.api.stone_issue_apply', {
    order_bag: BAG, lines: [{ item: STONE, pcs: 3, ct: 0.45 }], issued_by: EMP,
  });
  await frappeCall(page, 'jewelima.jewelima.api.weight_reduce', {
    order_bag: BAG, lines: [{ item: STONE, weight: 0.001, pcs: 3 }], to_warehouse: 'Stone Issue - JD',
  });
  await page.reload();
  const row2 = page.locator('table.sa-grid tbody tr', { hasText: BAG }).first();
  await expect(row2).toBeVisible({ timeout: 15_000 });
  await expect(row2).toContainText('Weight without count');
  await expect(row2).toContainText('0.449');
  await row2.locator('.sa-fix').click();
  const dlg = page.locator('.modal:visible');
  await dlg.locator('select').selectOption('Casting');
  await dlg.locator('.btn-primary', { hasText: 'Sweep' }).click();
  await expect(page.locator('table.sa-grid tbody tr', { hasText: BAG })).toHaveCount(0, { timeout: 15_000 });

  // the residue landed in the Casting -LOSS bucket as real stock
  const loss = await frappeCall(page, 'frappe.client.get_value', {
    doctype: 'Bin', filters: { item_code: STONE, warehouse: 'Casting -LOSS - JD' }, fieldname: 'actual_qty',
  });
  expect(Number(loss.actual_qty)).toBeGreaterThanOrEqual(0.449);
});
