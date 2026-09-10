import { test, expect } from '@playwright/test';

// OFI-0059 "NK 26313": 13 pieces, DW 11.18 ct / 2350 stones, CS 14.13 ct / 22 stones
test('OLD FORMAT KPI shows Total DW, and CS in the sheet unit', async ({ page }) => {
  await page.goto('/app/saved-imports');
  await page.waitForSelector('.si-card', { timeout: 30000 });
  await page.locator('.si-card').filter({ hasText: 'NK 26313' }).first().locator('.si-resume').click();
  await page.waitForSelector('.of-info .of-tile', { timeout: 30000 });

  // read every tile in ONE pass — some .of-tile blocks (the item x colour
  // matrix) carry no .k at all, and a per-locator textContent on those just
  // auto-waits until the test times out
  const tiles = () => page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('.of-info .of-tile')].map((t) => [
      (t.querySelector('.k')?.textContent || '').trim(),
      (t.querySelector('.v')?.textContent || '').trim() +
        ((t.querySelector('.sub')?.textContent || '').trim()
          ? '  (' + (t.querySelector('.sub')?.textContent || '').trim() + ')' : ''),
    ]).filter(([k]) => k)));

  const a = await tiles();
  console.log('KPI:', JSON.stringify(a, null, 1));
  expect(a['Total DW'], 'Total DW tile').toBeTruthy();
  expect(a['Total DW']).toContain('11.180 ct');
  expect(a['Total DW']).toContain('2350');
  expect(a['Total CS'], 'Total CS tile').toBeTruthy();

  // flip the sheet to grams — the CS tile must follow, DW must not
  const before = a['Total CS'];
  await page.locator('.of-units:visible').first().click();
  await page.waitForTimeout(800);
  const b = await tiles();
  console.log('after unit flip -> CS:', b['Total CS'], '| DW:', b['Total DW']);
  expect(b['Total CS']).not.toBe(before);
  expect(b['Total DW']).toBe(a['Total DW']);

  // flip back so the next run starts where this one did
  await page.locator('.of-units:visible').first().click();
  await page.waitForTimeout(600);
  const c = await tiles();
  expect(c['Total CS']).toBe(before);
  console.log('restored to:', c['Total CS']);
});
