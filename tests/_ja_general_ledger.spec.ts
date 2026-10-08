// J - Accounts General Ledger, kept plain (8 Oct 2026): no tiles, no chart — period, filters, search, list.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
test('general ledger is a plain searchable list', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(BASE + '/desk/ja-general-ledger');
  await expect(page.locator('table.rt thead th').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.r-kpis')).toHaveCount(0);
  await expect(page.locator('.c-gl')).toHaveCount(0);
  await expect(page.locator('.gl-count')).toContainText('entries');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('general_ledger') && (r.request().postData() || '').includes('zzz')),
    page.locator('input.r-q').fill('zzz'),
  ]);
  expect(resp.ok()).toBeTruthy();
  await expect(page.locator('table.rt tbody')).toContainText('No entries match');
  await page.locator('input.r-q').fill('');
  await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-general-ledger.png` });
  expect(errors).toEqual([]);
});
