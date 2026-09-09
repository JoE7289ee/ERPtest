// The pieces scroll, the page does not — the totals above them have to stay
// readable while you type into the last piece.
import { test, expect } from '@playwright/test';

test('only the pieces scroll, and the totals stay on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/bag-split');
  await page.waitForFunction(() => document.querySelector('.bs-scan input'), undefined, { timeout: 60_000 });
  await page.waitForTimeout(600);

  // scan a seeded card, then EXTRACT
  const bag = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({ method: 'frappe.client.get_list',
      args: { doctype: 'Order Bag', filters: { location: 'BAG EXTRACTION', qty: 10 },
              limit_page_length: 1, fields: ['name'] } });
    return r.message[0]?.name;
  });
  console.log('card:', bag);
  test.skip(!bag, 'no qty-10 card at BAG EXTRACTION on this site');

  await page.locator('.bs-scan input').fill(bag);
  await page.locator('.bs-scan input').press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.bs-card .btn-primary').length > 0, undefined, { timeout: 30_000 });

  const btn = (await page.locator('.bs-card .btn-primary').textContent() || '').trim();
  console.log('button reads:', btn);
  expect(btn, 'the button says what it does').toBe('EXTRACT');

  await page.locator('.bs-card .btn-primary').click();
  await page.waitForFunction(() => document.querySelectorAll('.bs-piece').length > 0, undefined, { timeout: 30_000 });
  await page.waitForTimeout(900);

  const m = await page.evaluate(() => {
    const pieces = document.querySelector('.bs-pieces') as HTMLElement;
    const foot = document.querySelector('.bs-foot') as HTMLElement;
    return {
      count: document.querySelectorAll('.bs-piece').length,
      piecesScrolls: pieces.scrollHeight > pieces.clientHeight + 1,
      piecesBottom: Math.round(pieces.getBoundingClientRect().bottom),
      viewport: window.innerHeight,
      pageScrollable: document.documentElement.scrollHeight > window.innerHeight + 1,
      footTop: Math.round(foot.getBoundingClientRect().top),
      footText: (foot.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  });
  console.log(`pieces: ${m.count} | its own scroll: ${m.piecesScrolls} | box bottom ${m.piecesBottom} of ${m.viewport}`);
  console.log('totals:', m.footText);

  expect(m.count, 'ten piece blocks').toBe(10);
  expect(m.piecesScrolls, 'the pieces box scrolls itself').toBe(true);
  expect(m.piecesBottom, 'and it ends inside the viewport').toBeLessThanOrEqual(m.viewport);
  expect(m.footText, 'the gold line is gone').not.toMatch(/Gold remaining/i);
  expect(m.footText, 'the gross picture leads').toMatch(/Product gross/);

  // scroll the pieces to the very bottom — the totals must not move
  await page.evaluate(() => {
    const p = document.querySelector('.bs-pieces') as HTMLElement;
    p.scrollTop = p.scrollHeight;
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const foot = document.querySelector('.bs-foot') as HTMLElement;
    const p = document.querySelector('.bs-pieces') as HTMLElement;
    return { footTop: Math.round(foot.getBoundingClientRect().top),
      scrolled: Math.round(p.scrollTop), pageY: Math.round(window.scrollY),
      lastPiece: (document.querySelectorAll('.bs-piece .nm')[9]?.textContent || '').trim() };
  });
  console.log(`scrolled pieces by ${after.scrolled}px -> last piece "${after.lastPiece}", page moved ${after.pageY}px`);
  expect(after.footTop, 'the totals did not move').toBe(m.footTop);
  expect(after.pageY, 'the page itself never scrolled').toBe(0);
});
