import { test, expect } from '@playwright/test';

test('Lot Selection: the table, the keyboard, and the derived rejection', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-card', { timeout: 30000 });
  console.log('board tabs:', (await page.locator('.ls-f').allTextContents()).join(' / '));
  console.log('a tile:', (await page.locator('.ls-card').first().textContent() || '').replace(/\s+/g, ' ').trim());

  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-one:visible .ls-t', { timeout: 15000 });

  const heads = await page.locator('.ls-t thead th').allTextContents();
  console.log('columns:', JSON.stringify(heads.filter(Boolean)));
  expect(heads.filter(Boolean)).toEqual(['Sieve', 'Actual cts', 'Select cts', 'Rejection cts']);

  // the purchase / return controls are gone
  const bar = (await page.locator('.ls-bar').textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('top bar:', bar);
  for (const gone of ['Claimed', 'returned', 'Parcel weight']) {
    expect(bar.toLowerCase()).not.toContain(gone.toLowerCase());
  }

  // add a sieve, then drive the rest from the KEYBOARD only
  await page.locator('.ls-addbtn').click();
  await page.waitForTimeout(400);
  await page.keyboard.type('8.4');
  await page.keyboard.press('Enter');          // -> select box, same row
  console.log('after Enter, focus is on:', await page.evaluate(() =>
    (document.activeElement as HTMLElement)?.getAttribute('data-f') + '/' + (document.activeElement as HTMLElement)?.getAttribute('data-i')));
  await page.keyboard.type('5.15');
  await page.waitForTimeout(300);

  let row = await page.locator('.ls-t tbody tr').first().evaluateAll((els) => els.map((e) =>
    [...e.querySelectorAll('td')].map((c) => (c.querySelector('input') as HTMLInputElement)?.value ?? (c.textContent || '').trim()).join(' | ')));
  console.log('row 1:', row[0]);

  await page.locator('.ls-addbtn').click();
  await page.waitForTimeout(400);
  await page.keyboard.type('4.2');
  await page.keyboard.press('Enter');
  await page.keyboard.type('0');
  await page.waitForTimeout(400);

  const rows = await page.locator('.ls-t tbody tr').evaluateAll((els) => els.map((e) =>
    [...e.querySelectorAll('td')].map((c) => (c.querySelector('input') as HTMLInputElement)?.value ?? (c.textContent || '').trim()).join(' | ')));
  console.log('rows:', JSON.stringify(rows, null, 1));
  const foot = (await page.locator('.ls-t tfoot').textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('footer totals:', foot);

  // over-selecting turns the line red and locks SAVE
  await page.locator('.ls-t tbody tr').last().locator('input[data-f=selected]').fill('9');
  await page.waitForTimeout(400);
  console.log('over-selected -> row red:', await page.locator('.ls-t tbody tr.ls-bad').count(),
              '| SAVE disabled:', await page.locator('.ls-save').isDisabled());
  expect(await page.locator('.ls-save').isDisabled()).toBe(true);
  await page.locator('.ls-t tbody tr').last().locator('input[data-f=selected]').fill('0');
  await page.waitForTimeout(400);
  expect(await page.locator('.ls-save').isDisabled()).toBe(false);

  await page.locator('.ls-save').click();
  await page.waitForTimeout(3000);
  console.log('after save, footer:', (await page.locator('.ls-t tfoot').textContent() || '').replace(/\s+/g, ' ').trim());
  await page.locator('.ls-back').click();
  await page.waitForTimeout(1500);
  // it is Selected now, so it has left the Open tab — that IS the behaviour
  console.log('still on the Open tab?', await page.locator('.ls-card').filter({ hasText: lot }).count());
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForTimeout(800);
  const tile = page.locator('.ls-card').filter({ hasText: lot }).first();
  await expect(tile).toBeVisible();
  console.log('tile on All:', (await tile.textContent() || '').replace(/\s+/g, ' ').trim());
});
