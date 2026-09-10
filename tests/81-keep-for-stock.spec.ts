import { test, expect } from '@playwright/test';

test('Keep for stock: asking drops it off the tray, rejecting brings it back', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-keep .ls-kt', { timeout: 20000 });
  await page.waitForTimeout(1200);

  const tray = async () => {
    const r = page.locator('.ls-t tbody tr').first();
    return {
      actual: await r.locator('input[data-f=actual]').inputValue(),
      assorted: await r.locator('input[data-f=selected]').inputValue(),
      rejection: (await r.locator('td.ls-rej').textContent() || '').trim(),
    };
  };
  console.log('tray at open :', JSON.stringify(await tray()));
  console.log('keep row     :', (await page.locator('.ls-keep .ls-kt tbody tr').first().textContent() || '').replace(/\s+/g, ' ').trim());

  // ask for 5 of what is assorted
  await page.locator('.ls-keep .ls-kin').first().fill('5');
  await page.waitForTimeout(400);
  await page.locator('.ls-ask').click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4000);
  const after = await tray();
  console.log('after asking 5:', JSON.stringify(after), ' <- the editable fields themselves moved');
  expect(Number(after.actual)).toBe(35);
  expect(Number(after.assorted)).toBe(20);
  expect(after.rejection).toBe('15.000');

  // reject it -> back on the tray
  const pending = page.locator('.ls-rq').filter({ hasText: 'Pending' }).first();
  await pending.locator('.ls-no').click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4000);
  const back = await tray();
  console.log('after reject  :', JSON.stringify(back), ' <- and back again');
  expect(Number(back.actual)).toBe(40);
  expect(Number(back.assorted)).toBe(25);
});
