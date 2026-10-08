// A journal opened from the records shows ledgers, debit, credit and narration — no balance columns (8 Oct 2026).
// A new journal still shows Balance now and Balance after.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
test('journal view has no balance columns', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(BASE + '/desk/ja-journal');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const th = page.locator('.jj-g thead th', { hasText: 'Balance' });
  await expect(th).toHaveCount(2);
  await expect(th.first()).toBeVisible();
  const name = await page.evaluate(() => new Promise<string>((res) => (window as any).frappe.call({ method: 'frappe.client.get_list',
    args: { doctype: 'Journal Entry', filters: { docstatus: 1 }, fields: ['name'], limit_page_length: 1 } }).then((r: any) => res((r.message[0] || {}).name || ''))));
  test.skip(!name, 'no posted journal on this site');
  await page.evaluate((n) => (window as any).frappe.set_route('ja-journal', n), name);
  await expect(page.locator('.jj-ro.h-no')).toContainText(name, { timeout: 20_000 });
  await expect(th.first()).toBeHidden();
  await expect(th.nth(1)).toBeHidden();
  await expect(page.locator('.jj-g tbody td.c-now').first()).toBeHidden();
  await expect(page.locator('.jj-g tbody input.dr').first()).toBeVisible();
  await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-journal-view.png` });
  expect(errors).toEqual([]);
});
