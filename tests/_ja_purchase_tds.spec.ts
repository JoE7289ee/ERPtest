// Purchase (Goods): TDS under section 194Q — 0.1 % on what a supplier's purchases this year come to above ₹50 lakh.
// It switches itself on when the limit is crossed, on the part that is over; a person can change it. (9 Oct 2026)
// Needs an accounts-only supplier "ZZT TDS SUPPLIER" (the console check of the same date makes it).
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
const SUP = process.env.JA_SUPPLIER || 'ZZT TDS SUPPLIER';      // it never saves: safe to point at a real supplier
test('TDS on a goods purchase', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1700, height: 950 });
  await page.goto(BASE + '/desk/ja-purchase-invoice');
  const item = page.locator('.jv-g tr[data-i="0"] input.item');
  await expect(item).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('datalist option[value="DIAMOND"]')).toHaveCount(1, { timeout: 20_000 });
  const bought = await page.evaluate((sup) => new Promise<number>((res) => (window as any).frappe.call({ method: 'j_accounts.voucher.get_party',
    args: { kind: 'purchase', party: sup } }).then((r: any) => res(r.message.tds.bought), () => res(-1))), SUP);
  test.skip(bought < 0, 'no such supplier on this site');
  const box = page.locator('.h-party input').first();
  await box.click();
  await Promise.all([page.waitForResponse((r) => r.url().includes('get_party')),
    (async () => { await page.keyboard.type(SUP, { delay: 20 }); await page.keyboard.press('Tab'); })()]);
  await item.fill('DIAMOND'); await item.dispatchEvent('change');
  await page.locator('.jv-g tr[data-i="0"] [data-k="gross_wt"]').fill('200');
  await page.locator('.jv-g tr[data-i="0"] [data-k="rate"]').fill('60000');
  // DIAMOND brings its own GST: 1.5 %, shown in a closed box
  await expect(page.locator('.h-gst')).toBeDisabled();
  await expect(page.locator('.h-gst')).toHaveValue('1.5');
  const over = Math.min(Math.max(bought + 12000000 - 5000000, 0), 12000000), tds = Math.round(over * 0.001);
  await expect(page.locator('.h-tds')).toHaveValue('1');
  await expect(page.locator('.h-tdson')).toHaveValue(String(over));
  await expect(page.locator('.f-tds')).toContainText(tds.toLocaleString('en-IN') + '.00');
  await expect(page.locator('.f-grand')).toContainText((12180000 - tds).toLocaleString('en-IN'));
  await page.locator('.h-tds').selectOption('0');                       // switched off by hand
  await expect(page.locator('.f-tds')).toBeHidden();
  await expect(page.locator('.f-grand')).toContainText('1,21,80,000.00');
  await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-purchase-tds.png` });
  expect(errors).toEqual([]);
});
