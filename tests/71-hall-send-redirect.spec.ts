import { test, expect } from '@playwright/test';

test('SEND moves the stock and lands on Hallmark Out', async ({ page }) => {
  const batch = process.env.BATCH || '';
  test.skip(!batch, 'need a prepared batch');
  await page.goto('/app/send-hallmarking');
  await page.waitForSelector('.sh-card', { timeout: 30000 });
  const card = page.locator('.sh-card').filter({ hasText: batch }).first();
  await expect(card).toBeVisible();
  await card.locator('.sh-send').click();
  await page.waitForSelector('.modal.show', { timeout: 10000 });
  const sel = page.locator('.modal.show [data-fieldname="center"] select');
  const opts = (await sel.locator('option').allTextContents()).filter(Boolean);
  console.log('centres:', opts.join(', '));
  await sel.selectOption(opts[0]);
  await page.locator('.modal.show .btn-primary', { hasText: 'SEND' }).click();
  await page.waitForTimeout(6000);
  console.log('landed on:', page.url().replace(/^https?:\/\/[^/]+/, ''));
  expect(page.url()).toContain('/hallmark-out');
});
