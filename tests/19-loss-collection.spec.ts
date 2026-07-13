// Loss Collection (Option B) + management Write-off.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
let before: any, seCollect = '', seWrite = '';

test('collect recovery: purity allocation balances and posts a repack', async ({ page }) => {
  await gotoApp(page, 'loss-collection');
  before = await frappeCall(page, 'jewelima.jewelima.api.get_loss_report');
  await expect(page.locator('.lc-rows tr[data-i]').first()).toBeVisible();

  // recover 0.2 g Standard 999 (needs 0.1998 g pure)
  await page.locator('.lc-got input').fill('0.2');
  await page.locator('.lc-got input').dispatchEvent('input');
  // karat checkboxes: uncheck 14K on the Grinding row -> its available pure drops
  const grind = page.locator('.lc-rows tr', { hasText: 'Grinding' });
  const avail0 = parseFloat(await grind.locator('.lc-avail').innerText());
  await grind.locator('.lc-k', { hasText: '14K' }).locator('input').uncheck();
  const avail1 = parseFloat(await grind.locator('.lc-avail').innerText());
  expect(avail1).toBeLessThan(avail0);
  // tick two benches -> AUTO-BALANCE splits the need equally
  const set = page.locator('.lc-rows tr', { hasText: 'Setting' });
  await grind.locator('.lc-rowcb').check();
  await set.locator('.lc-rowcb').check();
  await expect(page.locator('.lc-bal')).toHaveClass(/ok/, { timeout: 5000 });
  const gAuto = parseFloat(await grind.locator('.lc-g').inputValue());
  const sAuto = parseFloat(await set.locator('.lc-g').inputValue());
  expect(gAuto).toBeCloseTo(sAuto, 3); // equal split
  // manual weight on Grinding PINS it; Setting rebalances around it
  await grind.locator('.lc-g').fill('0.15');
  await grind.locator('.lc-g').dispatchEvent('input');
  await expect(grind).toHaveClass(/on/);
  const sRebal = parseFloat(await set.locator('.lc-g').inputValue());
  expect(sRebal).toBeCloseTo(0.2 * 0.999 - 0.15, 2);
  await expect(page.locator('.lc-bal')).toHaveClass(/ok/, { timeout: 5000 });
  await expect(page.locator('.lc-bal')).toContainText('balanced');
  await page.screenshot({ path: 'test-results/loss-collection.png' });

  await page.locator('.lc-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.lc-bal')).toContainText('Recovering 0.000', { timeout: 15_000 });

  const after = await frappeCall(page, 'jewelima.jewelima.api.get_loss_report');
  expect(before.totals.pure - after.totals.pure).toBeCloseTo(0.2 * 0.999, 2);
  // 14K was UNCHECKED on Grinding -> its 14K dust must be untouched
  const g14b = before.items.filter((r: any) => r.group === 'GOLD 14K')
    .reduce((s: number, r: any) => s + (r.cells['Grinding -LOSS - JD'] || 0), 0);
  const g14a = after.items.filter((r: any) => r.group === 'GOLD 14K')
    .reduce((s: number, r: any) => s + (r.cells['Grinding -LOSS - JD'] || 0), 0);
  expect(g14a).toBeCloseTo(g14b, 3);
  // recovered gold landed
  const se = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.get_list', args: { doctype: 'Stock Entry',
      filters: { stock_entry_type: 'Repack' }, order_by: 'creation desc', limit_page_length: 1 } });
    return r.message[0].name;
  });
  seCollect = se;
  // server guard: unbalanced lines refused
  const err = await page.evaluate(async () => {
    const f = (window as any).frappe;
    try {
      await f.call({ method: 'jewelima.jewelima.api.collect_loss', args: { payload: {
        output_item: 'Standard Gold 999', got_grams: 1, warehouse: 'Gold Issue - JD',
        lines: [{ item: '22KYG', warehouse: 'Filing -LOSS - JD', grams: 0.01 }] } } });
      return '';
    } catch { return 'blocked'; }
  });
  expect(err).toBe('blocked');
});

test('management write-off removes residue with a reason', async ({ page }) => {
  await gotoApp(page, 'loss-writeoff');
  const pre = await frappeCall(page, 'jewelima.jewelima.api.get_loss_report');
  await page.locator('.lw-rows tr[data-i]').first().locator('.lw-cb').check();
  const g0 = await page.locator('.lw-rows tr[data-i]').first().locator('.lw-g').inputValue();
  await page.locator('.lw-reason input').fill('test residue write-off');
  await page.screenshot({ path: 'test-results/loss-writeoff.png' });
  await page.locator('.lw-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.lw-sum')).toContainText('0 line(s)', { timeout: 15_000 });
  const post = await frappeCall(page, 'jewelima.jewelima.api.get_loss_report');
  expect(pre.totals.gross - post.totals.gross).toBeCloseTo(parseFloat(g0), 2);
  seWrite = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.get_list', args: { doctype: 'Stock Entry',
      filters: { stock_entry_type: 'Material Issue' }, order_by: 'creation desc', limit_page_length: 1 } });
    return r.message[0].name;
  });
  console.log('SES', seCollect, seWrite);
});
