// Sell layout: buyer dropdown must not collide with the bottom strip.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('dropdown opens clear of the pinned strip', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1100 }); // narrow like the report
  await gotoApp(page, 'sell');
  // strip pinned to the bottom of the viewport area even with an empty table
  const strip = await page.locator('.sl-strip').boundingBox();
  const vp = page.viewportSize()!;
  expect(strip!.y + strip!.height).toBeGreaterThan(vp.height - 60);
  // open the buyer dropdown
  await page.locator('.sl-buyer input').fill('JO');
  await page.waitForTimeout(600);
  const opt = page.getByRole('option').first();
  await expect(opt).toBeVisible();
  const o = await opt.boundingBox();
  // options render above the strip, no overlap
  expect(o!.y + o!.height).toBeLessThan(strip!.y);
  await page.screenshot({ path: 'test-results/sell-layout.png' });
});
