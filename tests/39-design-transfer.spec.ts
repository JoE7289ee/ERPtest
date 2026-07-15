// Design Export / Import: pick what to export, read a file, pick what to import.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('export picker selects designs and downloads a zip', async ({ page }) => {
  await gotoApp(page, 'design-transfer');
  await expect(page.locator('.dx-elist tbody tr').first()).toBeVisible({ timeout: 20_000 });
  const total = await page.locator('.dx-elist tbody tr').count();
  expect(total).toBeGreaterThan(1);
  await expect(page.locator('.dx-count')).toContainText(`0 of ${total}`);

  // tick two designs
  await page.locator('.dx-elist tbody tr').nth(0).click();
  await page.locator('.dx-elist tbody tr').nth(1).click();
  await expect(page.locator('.dx-count')).toContainText(`2 of ${total}`);
  await expect(page.locator('.dx-elist .dx-cb:checked')).toHaveCount(2);

  const dl = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('.dx-export').click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^designs-\d{4}-\d{2}-\d{2}-2\.zip$/);   // exactly the 2 picked
  await page.screenshot({ path: 'test-results/design-transfer.png' });
});
