import { test, expect } from '@playwright/test';

// A closed lot is a record, not a tray: no inputs, no + Sieve, no REQUEST or
// CLOSE, and the KPIs answer what the parcel CAME TO rather than what is left.
test('a closed lot reads as the whole picture and nothing on it can be typed', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a closed lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });

  const card = (await page.locator('.ls-card').filter({ hasText: lot }).first()
    .textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('board card :', card);

  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-t tbody tr', { timeout: 20000 });
  await page.waitForTimeout(1500);

  console.log('closed badge:', await page.locator('.ls-shut').textContent());
  await expect(page.locator('.ls-shut')).toBeVisible();

  const kpis: Record<string, string> = {};
  for (const k of await page.locator('.ls-kpi').all()) {
    kpis[(await k.locator('.k').textContent())!.trim()] =
      (await k.locator('.v').textContent())!.replace(/\s+/g, '').trim();
  }
  console.log('KPIs       :', JSON.stringify(kpis));
  // the labels are uppercased by CSS, not in the markup
  const labels = Object.keys(kpis).join('|').toLowerCase();
  expect(labels).not.toContain('left to assort');
  expect(labels).toContain('returned');

  const head = await page.locator('.ls-t thead th').allTextContents();
  console.log('columns    :', head.map((h) => h.trim()).filter(Boolean).join(' | '));

  for (const r of await page.locator('.ls-t tbody tr').all())
    console.log('   ', (await r.textContent())!.replace(/\s+/g, ' ').trim());

  console.log('inputs     :', await page.locator('.ls-in, .ls-kin').count());
  console.log('+ Sieve    :', await page.locator('.ls-addbtn').count());
  console.log('remove x   :', await page.locator('.ls-x').count());
  console.log('REQUEST    :', await page.locator('.ls-ask').count());
  console.log('CLOSE LOT  :', await page.locator('.ls-close').count());
  console.log('APPROVE    :', await page.locator('.ls-yes, .ls-no').count());
  expect(await page.locator('.ls-in, .ls-kin, .ls-addbtn, .ls-x, .ls-ask, .ls-close, .ls-yes, .ls-no').count()).toBe(0);

  console.log('trail      :', (await page.locator('.ls-keep .hd').textContent())!.replace(/\s+/g, ' ').trim());
  for (const r of await page.locator('.ls-rq').all())
    console.log('   ', (await r.textContent())!.replace(/\s+/g, ' ').trim().slice(0, 95));
  expect(await page.locator('.ls-rq').count()).toBeGreaterThan(0);

  console.log('totals row :', (await page.locator('.ls-tot').textContent())!.replace(/\s+/g, ' ').trim());
  console.log('foot hint  :', await page.locator('.ls-hint').textContent());
});
