import { test, expect } from '@playwright/test';

test('Hallmark: E-less scan, bracket KPI, PREP lands on Send Hallmarking', async ({ page }) => {
  const pieces = (process.env.PIECES || '').split(',').filter(Boolean);
  test.skip(!pieces.length, 'need a free finished piece');
  await page.goto('/app/hallmark');
  await page.waitForSelector('.hm-scan input', { timeout: 30000 });

  const eless = pieces[0].replace(/^E/i, '');
  console.log('typing', JSON.stringify(eless));
  await page.locator('.hm-scan input').fill(eless);
  await page.locator('.hm-scan input').press('Enter');
  await page.waitForTimeout(1800);

  const first = (await page.locator('.hm-t tbody tr').first().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('row:', first.slice(0, 70));
  expect(first).toContain(pieces[0]);

  const tiles = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.hm-tiles .hm-tile')].map((t) => [
      (t.querySelector('.k')?.textContent || '').trim(),
      (t.querySelector('.v')?.textContent || '').trim()])));
  console.log('tiles:', JSON.stringify(tiles));
  const brk = (await page.locator('.hm-tile.brk .hm-bt').textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
  console.log('brackets:', brk || '(no stones on this piece)');

  console.log('PREP says:', (await page.locator('.hm-go').textContent() || '').trim());
  await page.locator('.hm-go').click();
  await page.waitForTimeout(4000);
  console.log('landed on:', page.url().replace(/^https?:\/\/[^/]+/, ''));
  expect(page.url()).toContain('/send-hallmarking');
});

test('Send Hallmarking: design-type boxes, Print slip, no Recent', async ({ page }) => {
  await page.goto('/app/send-hallmarking');
  await page.waitForSelector('.sh-card, .sh-empty', { timeout: 30000 });
  test.skip(!(await page.locator('.sh-card').count()), 'no prepared batch');

  const card = page.locator('.sh-card').first();
  console.log('batch:', (await card.locator('.nm').textContent() || '').trim());
  const boxes = await card.locator('.sh-ty').evaluateAll((els) => els.map((e) => [
    (e.querySelector('.t')?.textContent || '').trim(),
    (e.querySelector('.p')?.textContent || '').trim(),
    (e.querySelector('.w')?.textContent || '').trim()].join(' ')));
  console.log('design-type boxes:', JSON.stringify(boxes));
  expect(boxes.length, 'a box per design type').toBeGreaterThan(0);

  console.log('buttons:', (await card.locator('.sh-actions button').allTextContents()).join(' / '));
  await expect(card.locator('.sh-print')).toBeVisible();

  // Recent is gone
  const secs = await page.locator('.sh-sec').allTextContents();
  console.log('sections:', JSON.stringify(secs));
  expect(secs.join('|').toLowerCase()).not.toContain('recent');

  // the slip really builds and reaches a print frame
  await page.evaluate(() => { (window as any).__printed = 0; });
  await page.addInitScript(() => {});
  await card.locator('.sh-print').click();
  await page.waitForTimeout(2500);
  const slip = await page.evaluate(() => {
    const f = document.getElementById('jw-slip-frame') as HTMLIFrameElement | null;
    if (!f?.contentDocument) return null;
    const d = f.contentDocument;
    return { title: d.title, a6: d.documentElement.innerHTML.includes('148mm 105mm'),
             qr: !!d.querySelector('img[src^="data:image"]'),
             rows: [...d.querySelectorAll('table.it tbody tr')].map((r) =>
               [...r.querySelectorAll('td')].map((c) => (c.textContent || '').trim()).join(' ')) };
  });
  console.log('slip:', JSON.stringify(slip));
  expect(slip, 'the slip rendered into the print frame').toBeTruthy();
  expect(slip!.a6, 'A6 landscape').toBe(true);
  expect(slip!.qr, 'QR on the slip').toBe(true);
});
