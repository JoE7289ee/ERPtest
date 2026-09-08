// The Jewelima sidebar rules (jewelima/public/js/sidebar.bundle.js).
//
//   - one MENU open at a time, EXCEPT the menu holding the page you are on.
//     Sub-menus (item.indent) are not menus and are covered by 56-.
//   - a menu that opens is scrolled into view
//   - clicking a PAGE inside a menu is a navigation, not a menu action: it must
//     not run the close-the-others sweep (that was the lag)
import { test, expect, Page } from '@playwright/test';

const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

async function openMenus(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    return (sb.items || [])
      .filter((i: any) => i?.$nested_items?.length && i.wrapper?.length && !i.$nested_items.hasClass('hidden'))
      .map((i: any) => i.wrapper.attr('title') || i.item?.label);
  });
}
async function menuTitles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    return (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length)
      .map((i: any) => i.wrapper.attr('title'));
  });
}
// menus actually painted on screen — the sidebar also carries a standard block
// whose items are built but hidden, and a hidden element has a zero rect
async function visibleMenus(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    return (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length
      && i.wrapper.get(0).getBoundingClientRect().height > 0)
      .map((i: any) => i.wrapper.attr('title'));
  });
}
// click a menu's own header through the DOM, and time what the click costs
async function clickHeader(page: Page, title: string) {
  return page.evaluate((t) => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
    const el = s.wrapper.find('.standard-sidebar-item').get(0);
    const t0 = performance.now();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise<number>((r) => requestAnimationFrame(() =>
      requestAnimationFrame(() => r(Math.round(performance.now() - t0)))));
  }, title);
}
// click the first PAGE inside a menu — the click that used to be slow
async function clickPage(page: Page, title: string) {
  return page.evaluate((t) => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
    const el = s.$nested_items.find('.standard-sidebar-item').get(0);
    const t0 = performance.now();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise<number>((r) => requestAnimationFrame(() =>
      requestAnimationFrame(() => r(Math.round(performance.now() - t0)))));
  }, title);
}

test.describe('jewelima sidebar', () => {
  let errs: string[] = [];
  test.beforeEach(async ({ page }) => {
    errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).split('\n')[0]));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
    await page.goto('/desk/jewelima');
    await page.waitForFunction(READY, undefined, { timeout: 60_000 });
    await page.waitForTimeout(800);
  });

  test('one menu at a time, and the one you are in stays', async ({ page }) => {
    const titles = await menuTitles(page);
    console.log(`menus: ${titles.length}`);
    const [a, b, c] = ['Stock', 'Delivery', 'Costing'];   // all three are MENUS
    for (const t of [a, b, c]) expect(titles, `${t} exists`).toContain(t);

    // start from nothing open
    await page.evaluate(() => {
      const sb = (window as any).frappe.app.sidebar;
      (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length)
        .forEach((i: any) => { try { i.close(); } catch (e) {} });
    });

    const t1 = await clickHeader(page, a);
    expect(await openMenus(page), 'first menu opens').toEqual([a]);
    const t2 = await clickHeader(page, b);
    expect(await openMenus(page), 'second closes the first').toEqual([b]);
    const t3 = await clickHeader(page, c);
    expect(await openMenus(page), 'third closes the second').toEqual([c]);
    console.log(`header clicks: ${t1}ms ${t2}ms ${t3}ms`);
    expect(Math.max(t1, t2, t3), 'a menu opens in one frame').toBeLessThan(120);
    expect(errs, 'no errors').toEqual([]);
  });

  // The lag was this: every row in the sidebar is a .standard-sidebar-item, so
  // clicking a PAGE inside a menu ran the whole close-the-others sweep — 38
  // menus closed and 38 separate localStorage writes — before the navigation
  // had even started. A page click must now cost nothing at all.
  test('clicking a page inside a menu is not a menu action', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as any;
      w.__writes = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...a: any[]) { w.__writes++; return orig.apply(this, a as any); };
    });

    await clickHeader(page, 'Stock');
    await clickHeader(page, 'Delivery');
    const headerWrites = await page.evaluate(() => { const n = (window as any).__writes; (window as any).__writes = 0; return n; });
    const before = await openMenus(page);

    const ms = await clickPage(page, 'Delivery');
    const after = await openMenus(page);
    const pageWrites = await page.evaluate(() => (window as any).__writes);
    console.log(`page click: ${ms}ms, ${pageWrites} storage write(s) | menus before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
    console.log(`for comparison, two header clicks cost ${headerWrites} write(s)`);

    // one write at most, and that one is the route sweep after the navigation,
    // not the click handler running the whole close-the-others pass itself
    expect(pageWrites, 'a page click costs at most the one route sweep').toBeLessThanOrEqual(1);
    expect(headerWrites, 'a header click is one merged write, not one per menu').toBeLessThanOrEqual(4);
    expect(errs, 'no errors').toEqual([]);
  });

  // The menu you are in stays open while you look elsewhere. Closing it as well
  // was tried and reverted: it is usually the menu above the one you are
  // reaching for, so closing it yanks the list out from under the click.
  test('the menu you are in survives, then hands over on arrival', async ({ page }) => {
    await page.goto('/desk/confirm-certifications');
    await page.waitForFunction(READY, undefined, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    // Confirm lives in the Certification SUB-menu, which lives under Delivery
    const home = await openMenus(page);
    console.log('on Confirm, open:', JSON.stringify(home));
    expect(home, 'the sub-menu holding the page is open').toContain('Certification');
    expect(home, 'and so is the menu it lives under').toContain('Delivery');

    await clickHeader(page, 'Stock');
    expect(await openMenus(page), 'browse Stock, Delivery stays — it is where you are')
      .toEqual(expect.arrayContaining(['Delivery', 'Stock']));
    await clickHeader(page, 'Costing');
    const browsing = await openMenus(page);
    expect(browsing, 'Stock closed for Costing').not.toContain('Stock');
    expect(browsing, 'Delivery still stays').toContain('Delivery');

    await page.goto('/desk/scrub');
    await page.waitForFunction(READY, undefined, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    const after = await openMenus(page);
    console.log('on Scrub, open:', JSON.stringify(after));
    expect(after, 'arriving hands over to Stock').toContain('Stock');
    expect(after, 'and Costing is gone').not.toContain('Costing');
    expect(errs, 'no errors').toEqual([]);
  });

  // The scroll box is Frappe's (.body-sidebar-top), not .sidebar-items — there
  // is more than one of those and the first is a different list entirely.
  // Clicking a menu now holds it in place rather than scrolling to it, so what
  // this checks is the weaker, still-necessary thing: it did not leave the view.
  test('an opened menu is brought into view', async ({ page }) => {
    const titles = await visibleMenus(page);
    console.log(`visible menus: ${titles.length} (of ${(await menuTitles(page)).length} built)`);
    for (const last of [titles[titles.length - 1], titles[Math.floor(titles.length / 2)]]) {
      await page.evaluate(() => {
        const box = document.querySelector('.body-sidebar-top') as HTMLElement;
        box.scrollTop = 0;
      });
      await clickHeader(page, last);
      await page.waitForTimeout(150);
      const seen = await page.evaluate((t) => {
        const sb = (window as any).frappe.app.sidebar;
        const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
        const el = s.wrapper.get(0), box = document.querySelector('.body-sidebar-top') as HTMLElement;
        const e = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        return { title: t, top: Math.round(e.top - b.top), h: Math.round(b.height),
          scrollTop: box.scrollTop, canScroll: box.scrollHeight - box.clientHeight,
          headerVisible: e.top >= b.top - 2 && e.top <= b.bottom - 10 };
      }, last);
      console.log('revealed:', JSON.stringify(seen));
      expect(seen.headerVisible, `${last} header is in view`).toBe(true);
    }
    expect(errs, 'no errors').toEqual([]);
  });

  test('localStorage stays one coherent map', async ({ page }) => {
    await clickHeader(page, 'Stock');
    await clickHeader(page, 'Costing');
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('section-breaks-state') || '{}'));
    const ws = Object.keys(st)[0];
    console.log('stored keys:', Object.keys(st[ws] || {}).length, 'closed:',
      Object.values(st[ws] || {}).filter(Boolean).length);
    expect(Object.keys(st[ws] || {}).length, 'many menus remembered, not one').toBeGreaterThan(1);
    expect(errs, 'no errors').toEqual([]);
  });
});
