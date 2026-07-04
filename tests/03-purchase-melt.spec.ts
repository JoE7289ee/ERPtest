// Purchase Raw Material (gram/carat split) and the Melting blend calculator.
import { expect, test } from '@playwright/test';
import { apiPurchase, apiWarehouseByName, expectToast, frappeCall, gotoApp, setLink } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });

test('Purchase: metal fills Gram, stone fills Qty+Carat, PR posts', async ({ page }) => {
  await gotoApp(page, 'purchase-raw-material');
  // row 1: a metal — Gram enabled, Carat/Qty disabled
  const r1 = page.locator('table.pr-grid tbody tr').first();
  await setLink(page, 'table.pr-grid tbody tr >> nth=0 >> input[data-fieldname="item"]', 'Standard Gold 999');
  await expect(r1.locator('input').nth(2)).toBeDisabled(); // Qty (count)
  const gram1 = r1.locator('td:nth-child(6) input');
  await expect(gram1).toBeEnabled();
  await gram1.fill('25');
  // entering a weight auto-appends a fresh row
  await expect(page.locator('table.pr-grid tbody tr')).toHaveCount(2);
  // row 2: alloy
  await setLink(page, 'table.pr-grid tbody tr >> nth=1 >> input[data-fieldname="item"]', 'Alloy');
  await page.locator('table.pr-grid tbody tr').nth(1).locator('td:nth-child(6) input').fill('10');
  // totals show grams
  await expect(page.locator('table.pr-grid tfoot')).toContainText('35.000');
  await page.locator('.page-actions .btn-primary', { hasText: 'Post Purchase' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Purchase Receipt', { timeout: 30_000 });
  await page.keyboard.press('Escape');
});

test('Melting: required grams + tick stock + strict out -> melt to 18KPG', async ({ page }) => {
  await gotoApp(page, 'melt-gold');
  // seed stock in the melt warehouse through the app's own API
  const wh = await page.locator('input[data-fieldname="warehouse"]').inputValue();
  expect(wh).toBeTruthy(); // defaults to the first is_melt_warehouse
  await apiPurchase(page, wh, [
    { item: 'Standard Gold 999', weight: 120 },
    { item: 'Standard Gold 998', weight: 120 },
    { item: 'Alloy', weight: 60 },
  ]);
  await page.locator('.page-actions .btn', { hasText: 'Reset' }).click(); // reload stock panel
  await setLink(page, 'input[data-fieldname="out"]', '18KPG');
  await page.locator('input[data-fieldname="required"]').fill('100');
  // materials table starts EMPTY
  await expect(page.locator('.ml-body')).toContainText('Tick stock');
  // tick 999, 998 and Alloy from the stock panel
  for (const item of ['Standard Gold 999', 'Standard Gold 998', 'Alloy']) {
    await page.locator(`.ml-stock-cb[data-item="${item}"]`).check();
  }
  await expect(page.locator('.ml-body tr')).toHaveCount(3);
  // strict out: total in == required, blend at target purity
  await expect(page.locator('.ml-tin')).toContainText('100.000');
  await expect(page.locator('.ml-cur')).toContainText('75.1');
  await expect(page.locator('.ml-exp')).toContainText('75.10');
  await page.locator('.page-actions .btn-primary', { hasText: 'Melt' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Stock Entry', { timeout: 30_000 });
  await page.keyboard.press('Escape');
});

test('Melting: over-stock is flagged and blocked', async ({ page }) => {
  await gotoApp(page, 'melt-gold');
  await setLink(page, 'input[data-fieldname="out"]', '18KPG');
  await page.locator('input[data-fieldname="required"]').fill('50');
  await page.locator('.ml-stock-cb[data-item="Standard Gold 999"]').check();
  const row = page.locator('.ml-body tr').first();
  const avail = parseFloat((await row.locator('td.avail').innerText()) || '0');
  await row.locator('input.ml-wt').fill(String(avail + 500)); // way past stock
  await expect(page.locator('.ml-warn')).toContainText('Not enough stock');
  await page.locator('.page-actions .btn-primary', { hasText: 'Melt' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Not enough stock');
  await page.keyboard.press('Escape');
});
