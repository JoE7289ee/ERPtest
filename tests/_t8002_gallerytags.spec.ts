// Design Gallery: a new tag can be typed; Remove shows the selected designs' tags with crosses.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_gallerytags --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('gallery tags', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/design-gallery');
  const g = page.locator('#page-design-gallery');
  await expect(g.locator('.dg-tile').first()).toBeVisible({ timeout: 60_000 });
  const tag = 'ZZT ' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const pick = async () => { for (const i of [0, 1]) await g.locator('.dg-tile').nth(i).locator('.dg-check').dispatchEvent('click'); };
  await pick();
  await g.locator('.dg-apply').click();
  await page.locator('.modal.show .dg-newtag').fill(tag);
  await page.locator('.modal.show .btn-primary').first().click();
  await expect(g.locator('.dg-chip', { hasText: tag })).toContainText('2', { timeout: 15_000 });
  await pick();
  await g.locator('.dg-remove').click();
  const chip = page.locator('.modal.show .dg-prev-tags .t', { hasText: tag });
  await expect(chip).toBeVisible();
  await chip.locator('[data-rm]').click();
  await expect(chip).toHaveCount(0, { timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(g.locator('.dg-chip', { hasText: tag })).toContainText('0', { timeout: 15_000 });
  await page.evaluate((t) => (window as any).frappe.call({ method: 'frappe.client.delete', args: { doctype: 'Design Tag', name: t } }), tag);
  expect(errors).toEqual([]);
});
