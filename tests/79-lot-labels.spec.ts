import { test, expect } from '@playwright/test';
test('Lot Selection reads assort, not sieve', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  // the lot has a selection on it, so it is Selected, not Open
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  const tile = (await page.locator('.ls-card').filter({ hasText: lot }).first().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('board tile:', tile);
  expect(tile).toContain('Assorted');
  expect(tile).not.toContain('Sieved');

  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-top .ls-kpi', { timeout: 15000 });
  const kpis = await page.evaluate(() => [...document.querySelectorAll('.ls-top .ls-kpi')].map((k) => ({
    k: (k.querySelector('.k')?.textContent || '').trim(),
    v: (k.querySelector('.v')?.textContent || '').trim(),
    sub: (k.querySelector('.sub')?.textContent || '').trim() })));
  kpis.forEach((x) => console.log('   ' + x.k.padEnd(16) + x.v.padEnd(12) + x.sub));
  const labels = kpis.map((x) => x.k);
  expect(labels).toContain('Left to assort');
  expect(labels).toContain('Assorted');
  expect(labels.join('|')).not.toContain('Sieved');
  expect(labels.join('|')).not.toContain('Left to sieve');

  // the table column still says Sieve — that IS the sieve, and must not change
  const cols = (await page.locator('.ls-t thead th').allTextContents()).filter(Boolean);
  console.log('table columns:', JSON.stringify(cols));
  expect(cols[0]).toBe('Sieve');
});
