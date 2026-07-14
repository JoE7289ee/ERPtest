// Bench boards: per-bench info page — KPIs, stock buckets, pills filter.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('bench-casting board renders KPIs, stock and filters', async ({ page }) => {
  await gotoApp(page, 'bench-casting');
  await expect(page.locator('.page-title, h3')).toContainText('Casting', { timeout: 15_000 });
  const kpi = page.locator('.bb-kpi .bb-tile');
  await expect(kpi.first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.bb-kpi')).toContainText('Cards');
  await expect(page.locator('.bb-kpi')).toContainText('Pieces');
  await expect(page.locator('.bb-stock')).toContainText('Pure Gold');
  // filter by first party pill (if any cards) -> board repaints without error
  const pill = page.locator('.bb-party .bb-pill').nth(1);
  if (await pill.count()) {
    await pill.click();
    await expect(page.locator('.bb-party .bb-pill.on')).not.toHaveText('All');
  }
  await page.screenshot({ path: 'test-results/bench-board.png' });
});

test('an empty bench still renders cleanly', async ({ page }) => {
  await gotoApp(page, 'bench-wax-cleaning');
  await expect(page.locator('.bb-kpi')).toContainText('Cards', { timeout: 15_000 });
  await expect(page.locator('.bb-stock')).toContainText('Pure Gold');
});
