import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('clicking Home collapses all sidebar sections', async ({ page }) => {
  await gotoApp(page, 'item-stock');
  await page.waitForTimeout(1200);
  // open a couple of sections
  const mfg = page.locator('[data-title="Jewelima"] .section-item', { hasText: 'Manufacturing' }).first();
  await mfg.locator('.drop-icon').first().click();
  await page.waitForTimeout(400);
  const openBefore = await page.evaluate(() =>
    [...document.querySelectorAll('[data-title="Jewelima"] .section-item .drop-icon')]
      .filter((d: any) => d.getAttribute('data-state') === 'opened').length);
  expect(openBefore).toBeGreaterThan(0);
  // click Home
  await page.locator('.body-sidebar .standard-sidebar-item', { hasText: 'Home' }).first().click();
  await page.waitForTimeout(1200);
  const openAfter = await page.evaluate(() =>
    [...document.querySelectorAll('[data-title="Jewelima"] .section-item .drop-icon')]
      .filter((d: any) => d.getAttribute('data-state') === 'opened').length);
  expect(openAfter).toBe(0);
});
