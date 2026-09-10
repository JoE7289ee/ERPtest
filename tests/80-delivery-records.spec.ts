import { test, expect } from '@playwright/test';

const PAGES = [
  ['hallmarking-records',      'Hallmarking Records'],
  ['certification-records',    'Certification Records'],
  ['product-transfer-records', 'Product Transfer Records'],
  ['holder-transfer-records',  'Transfer Holder Records'],
  ['bucket-transfer-records',  'Transfer Bucket Records'],
];

for (const [route, title] of PAGES) {
  test(`${title} opens and lists`, async ({ page }) => {
    await page.goto(`/app/${route}`);
    await page.waitForSelector('.dr-t', { timeout: 30000 });
    // widen to everything so the period is not the reason a page looks empty
    await page.evaluate(() => {
      const el = document.querySelector('.f-from input') as HTMLInputElement;
      if (el) { el.value = '01-01-2000'; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(2500);
    const kpis = await page.evaluate(() => [...document.querySelectorAll('.dr-kpi')].map((k) =>
      (k.querySelector('.k')?.textContent || '').trim() + '=' + (k.querySelector('.v')?.textContent || '').trim()));
    const cols = (await page.locator('.dr-t thead th').allTextContents()).filter(Boolean);
    const rows = await page.locator('.dr-t tbody tr').count();
    const first = rows ? (await page.locator('.dr-t tbody tr').first().textContent() || '').replace(/\s+/g, ' ').trim() : '(empty)';
    console.log(`${title}`);
    console.log('   KPIs   :', kpis.join('  '));
    console.log('   columns:', cols.join(' | '));
    console.log('   rows   :', rows, '| first:', first.slice(0, 100));
    expect(cols.length).toBeGreaterThan(3);
  });
}

test('a hallmarking batch opens to its pieces', async ({ page }) => {
  await page.goto('/app/hallmarking-records');
  await page.waitForSelector('.dr-t tbody tr.dr-open', { timeout: 30000 });
  await page.locator('.dr-t tbody tr.dr-open').first().click();
  await page.waitForSelector('.modal.show', { timeout: 10000 });
  const t = (await page.locator('.modal.show .modal-title').textContent() || '').trim();
  const body = (await page.locator('.modal.show .modal-body').textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('batch dialog:', t);
  console.log('   ', body.slice(0, 160));
  expect(t).toContain('piece');
});

test('the product timeline filters by kind', async ({ page }) => {
  await page.goto('/app/product-transfer-records');
  await page.waitForSelector('.dr-c', { timeout: 30000 });
  const chips = await page.locator('.dr-c').allTextContents();
  console.log('kind chips:', chips.join(' / '));
  expect(chips).toContain('Holder');
  await page.evaluate(() => {
    const el = document.querySelector('.f-from input') as HTMLInputElement;
    if (el) { el.value = '01-01-2000'; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(2000);
  const all = await page.locator('.dr-t tbody tr').count();
  await page.locator('.dr-c', { hasText: 'Rework' }).click();
  await page.waitForTimeout(2000);
  const kinds = await page.locator('.dr-t tbody tr td:first-child').allTextContents();
  console.log('all rows:', all, '| after picking Rework:', kinds.length, '->', [...new Set(kinds.map((x) => x.trim()))].join(','));
  expect([...new Set(kinds.map((x) => x.trim()))]).toEqual(['Rework']);
});
