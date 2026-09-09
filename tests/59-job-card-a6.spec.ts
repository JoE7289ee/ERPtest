// Job cards print ONE PER A6 LANDSCAPE PAGE (148x105mm), from ws-ordering and
// from Print Order Bags — one renderer, so a reprint is the same paper.
import { test, expect } from '@playwright/test';

test('a job card is one A6 landscape page', async ({ page }) => {
  await page.goto('/app/ws-ordering');
  await page.waitForFunction(() => (window as any).jewelima?.printJobCards, undefined, { timeout: 60_000 });
  await page.waitForTimeout(500);

  // three real cards, straight from the same endpoint the page uses
  const cards = await page.evaluate(async () => {
    const names = (await (window as any).frappe.call({
      method: 'frappe.client.get_list',
      args: { doctype: 'Order Bag', limit_page_length: 3, fields: ['name'] } })).message.map((r: any) => r.name);
    const r = await (window as any).frappe.call({
      method: 'jewelima.jewelima.api.get_order_bag_cards', args: { names: JSON.stringify(names) } });
    return r.message || [];
  });
  console.log('cards fetched:', cards.length, cards.map((c: any) => c.name).join(', '));
  expect(cards.length, 'got cards to print').toBeGreaterThan(0);

  await page.evaluate((cs) => {
    const w = window as any;
    w.__printed = 0;
    const obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n: any) => {
      if (n.tagName === 'IFRAME') {
        const iv = setInterval(() => {
          if (n.contentWindow) { n.contentWindow.print = () => { w.__printed++; }; clearInterval(iv); }
        }, 10);
      }
    })));
    obs.observe(document.body, { childList: true });
    w.jewelima.printJobCards(cs);
  }, cards);
  await page.waitForTimeout(1000);

  const r = await page.evaluate(() => {
    const fr = document.getElementById('jw-cards-frame') as HTMLIFrameElement;
    const d = fr.contentDocument!;
    const css = Array.from(d.querySelectorAll('style')).map((s) => s.textContent).join('');
    const pages = Array.from(d.querySelectorAll('.jc-page'));
    const box = pages.map((p) => {
      const c = p.querySelector('.card') as HTMLElement;
      const cr = c.getBoundingClientRect(), pr = (p as HTMLElement).getBoundingClientRect();
      return { pw: Math.round(pr.width), ph: Math.round(pr.height),
        cw: Math.round(cr.width), ch: Math.round(cr.height),
        // does anything inside spill past the card?
        spill: Array.from(c.querySelectorAll('*')).some((e) => {
          const r = (e as HTMLElement).getBoundingClientRect();
          return r.bottom > cr.bottom + 1 || r.right > cr.right + 1;
        }) };
    });
    return { printed: (window as any).__printed, pages: pages.length,
      a6: /size:\s*148mm\s+105mm/.test(css),
      breakOnBlock: /\.jc-page[^}]*page-break-after:\s*always/.test(css.replace(/\s+/g, ' ')),
      box };
  });
  const mm = (px: number) => +(px / 96 * 25.4).toFixed(1);
  console.log(`pages: ${r.pages} | printed: ${r.printed} | A6 rule: ${r.a6}`);
  r.box.forEach((b, i) => console.log(
    `  page ${i + 1}: ${mm(b.pw)} x ${mm(b.ph)} mm, card ${mm(b.cw)} x ${mm(b.ch)} mm, spill=${b.spill}`));

  expect(r.a6, 'page size is A6 landscape').toBe(true);
  expect(r.pages, 'one page per card').toBe(cards.length);
  expect(r.printed, 'it printed').toBeGreaterThan(0);
  r.box.forEach((b, i) => {
    expect(mm(b.cw), `card ${i + 1} is 148mm wide`).toBeCloseTo(148, 0);
    expect(mm(b.ch), `card ${i + 1} is 105mm tall`).toBeCloseTo(105, 0);
    expect(b.spill, `nothing spills out of card ${i + 1}`).toBe(false);
  });

  // and a picture of the first one, at print size
  const fr = page.frameLocator('#jw-cards-frame');
  await fr.locator('.jc-page').first().screenshot({ path: 'shots/job-card-a6.png' });
});
