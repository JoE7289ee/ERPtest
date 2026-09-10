import { test, expect } from '@playwright/test';

test('Merge is one button at the top, quality locks, rename works', async ({ page }) => {
  await page.goto('/app/saved-imports');
  await page.waitForSelector('.si-card', { timeout: 30000 });

  // no per-card Merge any more
  expect(await page.locator('.si-merge').count(), 'per-card Merge is gone').toBe(0);
  const cards = await page.locator('.si-card').count();
  console.log('cards:', cards, '| per-card buttons:',
    (await page.locator('.si-card').first().locator('button').allTextContents()).join(' / '));

  // the top button
  const top = page.locator('.primary-action', { hasText: 'Merge lots' });
  await expect(top, 'top Merge button').toBeVisible();
  await top.click();
  await page.waitForSelector('.modal.show .frappe-control[data-fieldname="lots"]', { timeout: 15000 });

  const boxes = page.locator('.modal.show [data-fieldname="lots"] input[type=checkbox]');
  const n = await boxes.count();
  console.log('lots offered:', n);
  expect(n).toBeGreaterThan(1);

  // tick the first — everything of another quality must grey out
  await boxes.first().check();
  await page.waitForTimeout(400);
  const disabled = await page.locator('.modal.show [data-fieldname="lots"] input[type=checkbox]:disabled').count();
  console.log('locked out by quality:', disabled, 'of', n);

  // shop line appeared for the ticked lot
  await expect(page.locator('.modal.show .mg-shop'), 'a name box per ticked lot').toHaveCount(1);

  // tick a second one of the SAME quality
  const enabled = page.locator('.modal.show [data-fieldname="lots"] input[type=checkbox]:not(:disabled)');
  await enabled.nth(1).check();
  await page.waitForTimeout(400);
  await expect(page.locator('.modal.show .mg-shop')).toHaveCount(2);
  console.log('summary:', (await page.locator('.modal.show .mg-sum').textContent() || '').replace(/\s+/g, ' ').trim());

  await page.locator('.modal.show .btn-modal-close').first().click();
  await page.waitForTimeout(500);

  // rename round trip
  const card = page.locator('.si-card').first();
  const was = (await card.locator('.t').textContent() || '').trim();
  await card.locator('.si-ren').click();
  const input = page.locator('.modal.show [data-fieldname="title"] input');
  await input.waitFor({ timeout: 10000 });
  await input.fill(was + ' ZZ');
  await page.locator('.modal.show .btn-primary').click();
  await page.waitForTimeout(1500);
  const now = (await page.locator('.si-card').filter({ hasText: was + ' ZZ' }).first().locator('.t').textContent() || '').trim();
  console.log('renamed:', JSON.stringify(was), '->', JSON.stringify(now));
  expect(now).toBe(was + ' ZZ');

  // put it back
  const c2 = page.locator('.si-card').filter({ hasText: was + ' ZZ' }).first();
  await c2.locator('.si-ren').click();
  const i2 = page.locator('.modal.show [data-fieldname="title"] input');
  await i2.waitFor();
  await i2.fill(was);
  await page.locator('.modal.show .btn-primary').click();
  await page.waitForTimeout(1500);
  console.log('restored');
});
