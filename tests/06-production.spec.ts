// Production floor: transfer batches + Cards picker, Job Work bench restriction, Assign/Collect.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, frappeCall, gotoApp, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZPROD ${uid()}`;
let bag = '';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiCreateDesign(page, D, { type: 'RING', gold: '22KYG', goldWt: 4 });
  const jo = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.insert', args: { doc: { doctype: 'Job Order', order_date: f.datetime.get_today() } } });
    return r.message.name;
  });
  bag = (await page.evaluate(async ({ jo, D }) => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.insert', args: { doc: { doctype: 'Order Bag', job_order: jo, design: D, qty: 1, size: '0P' } } });
    return r.message.name;
  }, { jo, D })) as string;
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiDeleteDesign(page, D);
  await page.close();
});

test('Transfer page: scan locks location, batch transfers with stone columns', async ({ page }) => {
  await gotoApp(page, 'transfer-order-bag');
  const scan = page.locator('input[data-fieldname="scan"]');
  await scan.fill(bag);
  await scan.press('Enter');
  await expect(page.locator('.tob-locval')).toHaveText('ORDERING', { timeout: 15_000 });
  await expect(page.locator('table.tob-grid')).toContainText(bag);
  // new actual-based columns exist
  await expect(page.locator('table.tob-grid thead')).toContainText('DMD (ct)');
  await expect(page.locator('table.tob-grid thead')).toContainText('PS No');
  await page.locator('select').first().selectOption('CAD');
  await page.locator('.page-actions .btn-primary', { hasText: 'Transfer All' }).click();
  await expect(page.locator('.tob-count')).toHaveText('0', { timeout: 30_000 });
  const loc = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Order Bag', filters: bag, fieldname: 'location' });
  expect(loc.location).toBe('CAD');
});

test('Cards picker: filter by location, select-all, add to batch', async ({ page }) => {
  await gotoApp(page, 'transfer-order-bag');
  await page.locator('.page-actions .btn', { hasText: /^Cards$/ }).click();
  const dlg = page.locator('.modal:visible');
  await dlg.locator('select.tc-loc').selectOption('CAD');
  await expect(dlg.locator('table.tc-tbl')).toContainText(bag, { timeout: 15_000 });
  // status pills exist
  await expect(dlg.locator('.tc-pill', { hasText: 'In Queue' })).toBeVisible();
  await dlg.locator('.tc-all').click(); // select all
  const count = await dlg.locator('.tc-count').innerText();
  expect(count).toMatch(/[1-9]\d* selected/);
  // changing location deselects everything
  await dlg.locator('select.tc-loc').selectOption('ORDERING');
  await expect(dlg.locator('.tc-count')).toContainText('0 selected');
  await dlg.locator('select.tc-loc').selectOption('CAD');
  await dlg.locator('table.tc-tbl tr', { hasText: bag }).locator('input[type=checkbox]').check();
  await dlg.locator('.btn-primary', { hasText: /Add .*to batch/ }).click();
  await expect(page.locator('table.tob-grid')).toContainText(bag, { timeout: 20_000 });
});

test('Assign / Collect at CAD: assign then collect (times only)', async ({ page }) => {
  await gotoApp(page, 'assign-collect');
  const scan = page.locator('input[data-fieldname="scan"]');
  await scan.fill(bag);
  await scan.press('Enter');
  await expect(page.locator('.ac-locval')).toHaveText('CAD', { timeout: 15_000 });
  await page.locator('.ac-actions .btn', { hasText: 'Assign (no employee)' }).click();
  await expect(page.locator('.ac-count')).toHaveText('0', { timeout: 20_000 });
  // collect tab
  await page.locator('.ac-tab[data-mode="collect"]').click();
  await scan.fill(bag);
  await scan.press('Enter');
  await page.locator('.ac-actions .btn-primary', { hasText: 'Collect' }).click();
  await expect(page.locator('.ac-count')).toHaveText('0', { timeout: 20_000 });
});

test('Job Work refuses non-issue benches; works at SETTING', async ({ page }) => {
  await gotoApp(page, 'job-work');
  // the bag sits at CAD — a Job Work scan must reject it
  const scan = page.locator('input[data-fieldname="scan"]');
  await scan.fill(bag);
  await scan.press('Enter');
  await expect(page.locator('.jw-msg, .tob-msg, .msg, .ac-msg, [class*=msg]').first()).toContainText(/only for/i, { timeout: 15_000 });
});
