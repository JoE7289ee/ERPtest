import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('bench list shows the roster inline', async ({ page }) => {
  await page.goto('/desk/bench');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
  await expect(page.locator('.list-row-container', { hasText: 'FILING' })).toContainText('SUBRATA NATH', { timeout: 20_000 });
  await expect(page.locator('.list-row-container', { hasText: 'BAG EXTRACTION' })).toContainText('SREEKUTTY SINTO');
  await page.screenshot({ path: 'test-results/bench-list.png' });
});
