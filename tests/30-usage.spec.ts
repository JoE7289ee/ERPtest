// Usage dashboard: tiles, doc counts, heaviest tables, sessions, trend render.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('usage page renders the capacity dashboard', async ({ page }) => {
  await gotoApp(page, 'usage');
  await expect(page.locator('.us-tiles .us-tile')).toHaveCount(5, { timeout: 15_000 });
  await expect(page.locator('.us-tiles')).toContainText('Database');
  await expect(page.locator('.us-tiles')).toContainText('free');
  await expect(page.locator('.us-docs')).toContainText('Stock Ledger Entries');
  await expect(page.locator('.us-tables')).toContainText('MB');
  await expect(page.locator('.us-users')).toContainText('Administrator');
  await page.screenshot({ path: 'test-results/usage.png' });
});
