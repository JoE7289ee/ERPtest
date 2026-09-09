// Five buttons on a 340px card. They must stay INSIDE it — Cancel hanging off
// the edge is what this guards.
import { test, expect } from '@playwright/test';

// Print slip goes STRAIGHT to the printer through a hidden iframe — a download
// means somebody has to go and find it before any paper comes out.
test('print slip builds an A6 landscape page and prints it', async ({ page }) => {
  await page.goto('/app/send-certifications');
  await page.waitForFunction(() => document.querySelectorAll('.sc-card').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(600);

  // catch the print call rather than letting a dialog hang the run
  await page.addInitScript(() => { (window as any).__printed = 0; });
  await page.evaluate(() => {
    const w = window as any;
    w.__printed = 0;
    const orig = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
    void orig;
    // stub print on any iframe the page creates
    const obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n: any) => {
      if (n.tagName === 'IFRAME') {
        const iv = setInterval(() => {
          if (n.contentWindow) { n.contentWindow.print = () => { w.__printed++; }; clearInterval(iv); }
        }, 10);
      }
    })));
    obs.observe(document.body, { childList: true });
  });

  await page.locator('.sc-card .sc-slip').first().click();
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const fr = document.getElementById('jw-slip-frame') as HTMLIFrameElement;
    const d = fr?.contentDocument;
    const css = Array.from(d?.querySelectorAll('style') || []).map((s) => s.textContent).join('');
    const rows = Array.from(d?.querySelectorAll('table.it tbody tr') || [])
      .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()));
    return { printed: (window as any).__printed, a6: /size:\s*148mm\s+105mm/.test(css),
      title: d?.querySelector('.nm')?.textContent?.trim(),
      qr: !!d?.querySelector('.qr img'),
      rows };
  });
  console.log('slip:', r.title, '| A6 rule:', r.a6, '| QR:', r.qr, '| printed:', r.printed);
  console.log('rows:', JSON.stringify(r.rows));
  expect(r.a6, 'the page size is A6 landscape').toBe(true);
  expect(r.qr, 'the batch QR is on it').toBe(true);
  expect(r.printed, 'print() was called — no download').toBeGreaterThan(0);
  expect(r.rows[r.rows.length - 1][0], 'the last row totals it').toMatch(/TOTAL/i);
});

test('the batch card holds its own buttons at every width', async ({ page }) => {
  for (const w of [1280, 900, 620, 420]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/app/send-certifications');
    await page.waitForFunction(() => document.querySelectorAll('.sc-card').length > 0, undefined, { timeout: 60_000 });
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const card = document.querySelector('.sc-card') as HTMLElement;
      const cb = card.getBoundingClientRect();
      const btns = Array.from(card.querySelectorAll('.sc-actions .btn')) as HTMLElement[];
      const worst = btns.map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.textContent || '').replace(/\s+/g, ' ').trim(),
          over: Math.round(r.right - cb.right), lines: Math.round(r.height) };
      });
      return { cardW: Math.round(cb.width), btns: worst,
        rowH: Math.round((card.querySelector('.sc-actions') as HTMLElement).getBoundingClientRect().height) };
    });
    const spill = r.btns.filter((b) => b.over > 0);
    console.log(`w=${w} card=${r.cardW}px actions=${r.rowH}px | ` +
      (spill.length ? `SPILLS: ${JSON.stringify(spill)}` : 'all inside') +
      ` | tallest button ${Math.max(...r.btns.map((b) => b.lines))}px`);
    expect(spill, `nothing hangs off the card at ${w}px`).toEqual([]);
    // a button whose label wrapped is ~2x tall — the labels should stay on one line
    expect(Math.max(...r.btns.map((b) => b.lines)),
      `labels stay on one line at ${w}px`).toBeLessThan(46);
  }
});
