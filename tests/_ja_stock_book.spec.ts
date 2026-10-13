// J - Accounts Stock Book (13 Oct 2026): balance, average rate and value per item; a column shows only when the
// page has a figure for it; an item's entries show in / out / balance, with the bill as a link.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
test('stock book shows balance, average and value', async ({ page, context }) => {
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(BASE + '/desk/ja-stock-book');
  const head = (t: string) => page.locator('#page-ja-stock-book table.sb-t thead th', { hasText: t });
  await expect(head('Balance')).toBeVisible({ timeout: 60_000 });
  await expect(head('Average rate')).toBeVisible();
  await expect(head('Value')).toBeVisible();
  await expect(page.locator('.sb-kpi.main .k')).toHaveText('Stock value (own)');
  await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-stock-book.png` });
  const first = page.locator('#page-ja-stock-book table.sb-t tbody td.it').first();
  if (await first.count()) {
    await first.click();
    const dlg = page.locator('.modal.show');
    await expect(dlg.locator('th', { hasText: 'Balance' })).toBeVisible({ timeout: 20_000 });
    await expect(dlg.locator('th', { hasText: 'Average after' })).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${process.env.SHOT_DIR || 'shots'}/ja-stock-book-item.png` });
  }
  expect(errors).toEqual([]);
});
