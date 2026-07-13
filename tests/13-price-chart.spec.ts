// Price Chart: rate-chart letter print view renders.
import { expect, test } from '@playwright/test';

test('rate chart letter print view', async ({ page }) => {
  await page.goto('/printview?doctype=Price%20Chart&name=PCH-0001&format=Rate%20Chart%20Letter&no_letterhead=1');
  await expect(page.locator('body')).toContainText('RATE CHART - KAVITHA');
  await expect(page.locator('body')).toContainText('DIAMOND CENTS');
  await expect(page.locator('body')).toContainText('55,000');
  await expect(page.locator('body')).toContainText('Making Charges');
  await expect(page.locator('body')).toContainText('Jiyanto');
  await page.screenshot({ path: 'test-results/rate-chart-letter.png', fullPage: true });
});
