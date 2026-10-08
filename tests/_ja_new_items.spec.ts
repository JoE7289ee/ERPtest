// J - Accounts: Migration › New Items and the Stock Book after the item rework of 8 Oct 2026
// (items keep stones kind by kind — DMD, CZ, CS, CVD, PS; a party's stock sits under BASE - PARTY).
// Run on the Mac dev bench (or any site: set BASE_URL and SMOKE_SID):
//   SMOKE_SID=<minted with LoginManager.login_as> npx playwright test _ja_new_items --project=chromium --no-deps
// Everything it makes is named "… - ZZT" and is deleted at the end; the tick it changes is put back.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });

const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
const SHOTS = process.env.SHOT_DIR || 'shots';

test('new items and the stock book', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto(BASE + '/desk/ja-new-items');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const call = (method: string, args: any = {}) => page.evaluate(([m, a]) => new Promise((res, rej) => {
    (window as any).frappe.call({ method: m, args: a, freeze: false, error: () => rej(new Error(m)) }).then((r: any) => res(r.message), () => rej(new Error(m)));
  }), [method, args] as any) as Promise<any>;
  const zzt = async () => { for (const r of await call('frappe.client.get_list', { doctype: 'JA Item', filters: { name: ['like', '% - ZZT'] }, fields: ['name'] })) await call('frappe.client.delete', { doctype: 'JA Item', name: r.name }); };
  const row = (name: string) => page.locator('table.ni-t tbody tr').filter({ has: page.locator(`td.it[data-name="${name}"]`) });
  const kept = async (name: string) => row(name).locator('td.st input:checked').evaluateAll((els) => els.map((e: any) => e.dataset.k.replace('holds_', '')));

  await expect(row('DIAMOND ORNAMENTS 18KT')).toBeVisible({ timeout: 30_000 });
  expect(await kept('DIAMOND ORNAMENTS 18KT')).toEqual(['dmd', 'cz', 'cs', 'cvd', 'ps']);
  expect(await kept('GOLD JEWELLERY 18KT')).not.toContain('dmd');
  await expect(row('DIAMOND').locator('td.st input')).toHaveCount(0);          // a loose stone has no stones set in it

  // a party item keeps what its base keeps, and follows a tick made on the base
  await zzt();
  await call('j_accounts.stockbook.add_party_item', { base: 'GOLD ARTICLE 14KT', party: 'zzt' });
  await page.getByRole('button', { name: 'Refresh' }).first().click();
  await expect(row('GOLD ARTICLE 14KT - ZZT')).toBeVisible();
  await expect(row('GOLD ARTICLE 14KT - ZZT').locator('td.st input').first()).toBeDisabled();
  const before = await kept('GOLD ARTICLE 14KT');
  const cz = row('GOLD ARTICLE 14KT').locator('td.st input[data-k="holds_cz"]');
  await cz.click();
  await expect.poll(() => kept('GOLD ARTICLE 14KT - ZZT')).toContain('cz');
  await page.screenshot({ path: `${SHOTS}/ja-new-items.png` });
  await row('GOLD ARTICLE 14KT').locator('td.st input[data-k="holds_cz"]').click();
  await expect.poll(() => kept('GOLD ARTICLE 14KT')).toEqual(before);

  // the dialogs open
  await page.getByRole('button', { name: 'New party item' }).click();
  await expect(page.locator('.modal.show .modal-title')).toHaveText('New party item');
  await page.screenshot({ path: `${SHOTS}/ja-new-party-item.png` });
  await page.locator('.modal.show .btn-modal-close').click();
  await row('DIAMOND ORNAMENTS 18KT').locator('td.it').click();
  await expect(page.locator('.modal.show .modal-title')).toHaveText('DIAMOND ORNAMENTS 18KT');
  await page.screenshot({ path: `${SHOTS}/ja-new-items-edit.png` });
  await page.locator('.modal.show .btn-modal-close').click();

  // the stock book carries the five stone balances
  await page.evaluate(() => (window as any).frappe.set_route('ja-stock-book'));
  await expect(page.locator('table.sb-t thead th', { hasText: 'CVD ct' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Add entry' }).click();
  await expect(page.locator('.modal.show .modal-title')).toHaveText('Stock entry');
  await page.screenshot({ path: `${SHOTS}/ja-stock-book-entry.png` });
  await page.locator('.modal.show .btn-modal-close').click();

  await zzt();
  expect(errors).toEqual([]);
});
