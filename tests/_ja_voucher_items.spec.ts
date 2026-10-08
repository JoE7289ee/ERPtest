// Purchase / Sales voucher grid (9 Oct 2026): a line opens only the columns its item has.
// Items come from the stock book's New Items list: metal has purity, labour and the stones it is ticked for;
// a loose stone is carats and a rate; anything not on the list is left open.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
test('voucher columns follow the item', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto(BASE + '/desk/ja-purchase-invoice');
  const item = (i: number) => page.locator(`.jv-g tr[data-i="${i}"] input.item`);
  await expect(item(0)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('datalist option[value="DIAMOND ORNAMENTS 18KT"]')).toHaveCount(1, { timeout: 20_000 });
  const cell = (i: number, k: string) => page.locator(`.jv-g tr[data-i="${i}"] [data-k="${k}"]`);
  const set = async (i: number, name: string) => { await item(i).fill(name); await item(i).dispatchEvent('change'); };

  // typing goes forwards: key by key, as a person types (the box must not be redrawn under the cursor)
  await item(0).click();
  await page.keyboard.type('ZZT TYPED', { delay: 30 });
  await expect(item(0)).toHaveValue('ZZT TYPED');
  await cell(0, 'gross_wt').click();
  await page.keyboard.type('12.345', { delay: 30 });
  await expect(cell(0, 'gross_wt')).toHaveValue('12.345');
  await cell(0, 'rate').click();
  await page.keyboard.type('6789', { delay: 30 });
  await expect(cell(0, 'rate')).toHaveValue('6789');
  await expect(page.locator('.jv-g tr[data-i="0"] .c-amt')).toContainText('83,810.21');
  await cell(0, 'gross_wt').fill('');
  await cell(0, 'rate').fill('');

  await set(0, 'DIAMOND');                       // loose stone: carats and a rate
  await expect(cell(0, 'gross_wt')).toBeEnabled();
  await expect(cell(0, 'rate')).toBeEnabled();
  for (const k of ['purity', 'ps_wt', 'dm_wt', 'dm_rate', 'cs_wt', 'labour_type', 'service_rate']) await expect(cell(0, k)).toBeDisabled();
  await cell(0, 'gross_wt').fill('2.5');
  await cell(0, 'rate').fill('40000');
  await expect(page.locator('.jv-g tr[data-i="0"] .c-net')).toContainText('ct');
  await expect(page.locator('.jv-g tr[data-i="0"] .c-amt')).toContainText('1,00,000.00');
  await expect(page.locator('.t-dm')).toContainText('2.500 ct');
  await expect(page.locator('.t-gross')).toContainText('0.000 gm');

  await set(1, 'GOLD JEWELLERY 18KT');           // no DMD; CZ / CS / PS stones
  await expect(cell(1, 'purity')).toBeEnabled();
  await expect(cell(1, 'ps_wt')).toBeEnabled();
  await expect(cell(1, 'cs_wt')).toBeEnabled();
  await expect(cell(1, 'dm_wt')).toBeDisabled();
  await expect(cell(1, 'labour_type')).toBeEnabled();

  await set(2, 'DIAMOND ORNAMENTS 18KT');        // everything
  for (const k of ['gross_wt', 'purity', 'rate', 'ps_wt', 'dm_wt', 'dm_rate', 'cs_wt', 'service_rate']) await expect(cell(2, k)).toBeEnabled();

  await set(3, 'ZZT ONE-OFF CHARGE');            // not on the list: left open
  await expect(cell(3, 'dm_wt')).toBeEnabled();
  await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-voucher-items.png` });
  expect(errors).toEqual([]);
});
