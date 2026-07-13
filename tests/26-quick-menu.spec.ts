// Ctrl+Space quick menu: opens anywhere, number keys route, Esc closes.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('Ctrl+Space opens the quick menu; 1 routes to Transfer Order Bag; Esc closes', async ({ page }) => {
  await gotoApp(page, 'item-stock');
  await page.keyboard.press('Control+Space');
  const menu = page.locator('.jqm-wrap');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Transfer Order Bag');
  await expect(menu).toContainText('Assign / Collect');
  await expect(menu).toContainText('Job Work');
  await expect(menu).toContainText('Sell');
  // Esc closes
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // reopen, press 1 -> routes to the first item
  await page.keyboard.press('Control+Space');
  await expect(menu).toBeVisible();
  await page.keyboard.press('1');
  await page.waitForURL(/transfer-order-bag/, { timeout: 15_000 });
  await expect(menu).toBeHidden();
  // arrows + Enter: down twice = 3rd item (Job Work)
  await page.keyboard.press('Control+Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL(/job-work/, { timeout: 15_000 });
});
