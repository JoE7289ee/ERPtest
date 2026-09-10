import { test, expect } from '@playwright/test';

test('Purchased KPI, + Sieve waits for a pick, and approving shows the purchase sheet', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-keep .ls-kt', { timeout: 20000 });
  await page.waitForTimeout(1200);

  const kpis = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.ls-top .ls-kpi')].map((k) => [
      (k.querySelector('.k')?.textContent || '').trim(),
      (k.querySelector('.v')?.textContent || '').trim()])));
  console.log('KPIs:', JSON.stringify(kpis));
  expect(Object.keys(kpis)).toContain('Purchased');

  // + Sieve is hidden until a sieve is picked
  console.log('+ Sieve visible with nothing picked:', await page.locator('.ls-addbtn').isVisible());
  expect(await page.locator('.ls-addbtn').isVisible()).toBe(false);
  const opts = await page.locator('.ls-pick select option').allTextContents();
  await page.locator('.ls-pick select').selectOption(opts.filter((o) => o.trim())[0]);
  await page.waitForTimeout(500);
  console.log('after picking a sieve   :', await page.locator('.ls-addbtn').isVisible());
  expect(await page.locator('.ls-addbtn').isVisible()).toBe(true);

  // approving opens the purchase sheet
  await page.waitForSelector('.ls-rq', { timeout: 15000 });
  const pending = page.locator('.ls-rq').filter({ hasText: 'Pending' }).first();
  await pending.locator('.ls-yes').click();
  await page.waitForSelector('.modal.show .ls-pt', { timeout: 15000 });
  const head = await page.locator('.modal.show .ls-po .r').allTextContents();
  console.log('purchase sheet header:'); head.forEach((h) => console.log('   ', h.replace(/\s+/g, ' ').trim()));
  const rows = await page.locator('.modal.show .ls-pt tbody tr').allTextContents();
  console.log('lines:'); rows.forEach((r) => console.log('   ', r.replace(/\s+/g, ' ').trim()));
  expect(head.join(' ')).toContain('SLT');
  // nothing on it is editable
  console.log('editable fields in the sheet:', await page.locator('.modal.show .ls-pt input, .modal.show .ls-po input').count());
  expect(await page.locator('.modal.show .ls-pt input').count()).toBe(0);
  console.log('button:', (await page.locator('.modal.show .btn-primary').first().textContent() || '').trim());

  await page.locator('.modal.show .btn-primary', { hasText: 'PURCHASE' }).click();
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.ls-top .ls-kpi')].map((k) => [
      (k.querySelector('.k')?.textContent || '').trim(),
      (k.querySelector('.v')?.textContent || '').trim()])));
  console.log('Purchased after:', after['Purchased'], '(was', kpis['Purchased'] + ')');
  const rec = await page.locator('.ls-pr').allTextContents();
  console.log('purchase records shown on the requests:', rec.join(', '));
  expect(rec.join(' ')).toContain('SLT-');
});
