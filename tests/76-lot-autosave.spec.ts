import { test, expect } from '@playwright/test';

test('Lot Selection: KPIs on top, ring, ceiling error, and save on every input', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  let saves = 0;
  page.on('request', (r) => { if (r.url().includes('save_stone_lot_selection')) saves++; });

  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-card', { timeout: 30000 });
  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-one:visible .ls-t', { timeout: 15000 });

  // no save button anywhere
  console.log('save buttons on the page:', await page.locator('.ls-save').count());
  expect(await page.locator('.ls-save').count()).toBe(0);
  console.log('save state:', (await page.locator('.ls-state').textContent() || '').trim());

  const kpis = () => page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.ls-top .ls-kpi')].map((k) => [
      (k.querySelector('.k')?.textContent || '').trim(),
      (k.querySelector('.v')?.textContent || '').trim()])));

  // two sieves
  for (const [a, s] of [[8, 5], [7, 2]]) {
    await page.locator('.ls-addbtn').click();
    await page.waitForTimeout(350);
    await page.keyboard.type(String(a));
    await page.keyboard.press('Enter');
    await page.keyboard.type(String(s));
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1600);
  console.log('KPIs:', JSON.stringify(await kpis(), null, 1));
  console.log('ring slices:', await page.locator('.ls-ring').count(),
              '| legend:', (await page.locator('.ls-leg').textContent() || '').replace(/\s+/g, ' ').trim());
  console.log('saves so far:', saves, '| state:', (await page.locator('.ls-state').textContent() || '').trim());
  expect(saves, 'typing alone saved it').toBeGreaterThan(0);

  // it really landed on the server
  const stored = await page.evaluate(async (nm) => {
    const r = await (window as any).frappe.call({ method: 'jewelima.jewelima.api.get_stone_lot', args: { name: nm } });
    return { sieves: (r.message.items || []).length, actual: r.message.actual, selected: r.message.selected };
  }, lot);
  console.log('on the server without pressing anything:', JSON.stringify(stored));
  expect(stored.sieves).toBe(2);

  // now break the ceiling: 8 + 7 -> 18 + 7 = 25 against a 20 ct parcel
  await page.locator('.ls-t tbody tr').first().locator('input[data-f=actual]').fill('18');
  await page.waitForTimeout(1800);
  const err = (await page.locator('.ls-err').textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('ceiling error:', err);
  expect(err).toContain('more than');
  const k2 = await kpis();
  console.log('the Left tile flips to:', Object.keys(k2).find((x) => /Over/.test(x)), '->', k2['Over the parcel']);
  const before = saves;
  await page.waitForTimeout(1500);
  console.log('saves while over the ceiling:', saves - before, '(must be 0)');
  expect(saves - before).toBe(0);

  // fix it and it saves again on its own
  await page.locator('.ls-t tbody tr').first().locator('input[data-f=actual]').fill('9');
  await page.waitForTimeout(2000);
  console.log('after fixing -> state:', (await page.locator('.ls-state').textContent() || '').trim(),
              '| total saves:', saves);
  expect((await page.locator('.ls-state').textContent() || '')).toContain('saved');
});
