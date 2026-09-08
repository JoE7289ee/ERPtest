// The Jewelima sidebar (jewelima/public/js/sidebar.bundle.js).
//
//   - menus STAY where you put them. Nothing is closed for you: the closing was
//     tried twice and got in the way both times — closing a menu above the one
//     you clicked yanks the list up and the menu leaves from under your finger.
//   - a menu that opens is brought into view if it was out of it.
//   - clicking a PAGE inside a menu is a navigation and must cost nothing.
import { test, expect, Page } from '@playwright/test';

const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

async function openMenus(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    return (sb.items || [])
      .filter((i: any) => i?.$nested_items?.length && i.wrapper?.length && !i.$nested_items.hasClass('hidden'))
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
async function clickHeader(page: Page, title: string) {
  return page.evaluate((t) => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
    s.wrapper.find('.standard-sidebar-item').get(0)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }, title);
}
async function clickPage(page: Page, title: string) {
  return page.evaluate((t) => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
    s.$nested_items.find('.standard-sidebar-item').get(0)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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

  test('menus stay open — nothing is closed for you', async ({ page }) => {
    await page.evaluate(() => {
      const sb = (window as any).frappe.app.sidebar;
      (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length)
        .forEach((i: any) => { try { i.close(); } catch (e) {} });
    });
    for (const t of ['Stock', 'Certification', 'Costing']) await clickHeader(page, t);
    const open = (await openMenus(page)).sort();
    console.log('after opening three:', JSON.stringify(open));
    expect(open, 'all three stay open').toEqual(['Certification', 'Costing', 'Stock']);

    await clickHeader(page, 'Certification');   // and clicking one again closes just it
    expect((await openMenus(page)).sort(), 'only the one clicked closes').toEqual(['Costing', 'Stock']);
    expect(errs, 'no errors').toEqual([]);
  });

  // Every row is a .standard-sidebar-item, so a handler that fires on all of
  // them fires on navigation too. Nothing may move because of a page click.
  test('clicking a page inside a menu changes nothing in the sidebar', async ({ page }) => {
    await clickHeader(page, 'Stock');
    await clickHeader(page, 'Costing');
    const before = (await openMenus(page)).sort();
    await clickPage(page, 'Costing');
    const after = (await openMenus(page)).sort();
    console.log('menus before', JSON.stringify(before), 'after', JSON.stringify(after));
    expect(after, 'a page click closes nothing').toEqual(before);
    expect(errs, 'no errors').toEqual([]);
  });

  test('the page you land on has its menu open', async ({ page }) => {
    await page.goto('/desk/confirm-certifications');
    await page.waitForFunction(READY, undefined, { timeout: 60_000 });
    await page.waitForTimeout(1200);
    const open = await openMenus(page);
    console.log('on Confirm, open:', JSON.stringify(open));
    expect(open, 'the menu you are in is open').toContain('Certification');
    expect(errs, 'no errors').toEqual([]);
  });

  // The scroll box is Frappe's (.body-sidebar-top), not .sidebar-items — there
  // is more than one of those and the first is a different list entirely.
  test('an opened menu is brought into view', async ({ page }) => {
    const titles = await visibleMenus(page);
    console.log(`visible menus: ${titles.length} (of ${(await openMenus(page)).length} open)`);
    for (const last of [titles[titles.length - 1], titles[Math.floor(titles.length / 2)]]) {
      await page.evaluate(() => {
        (document.querySelector('.body-sidebar-top') as HTMLElement).scrollTop = 0;
      });
      await clickHeader(page, last);
      await page.waitForTimeout(150);
      const seen = await page.evaluate((t) => {
        const sb = (window as any).frappe.app.sidebar;
        const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
        const el = s.wrapper.find('.standard-sidebar-item').get(0);
        const box = document.querySelector('.body-sidebar-top') as HTMLElement;
        const e = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        return { title: t, top: Math.round(e.top - b.top), scrollTop: box.scrollTop,
          headerVisible: e.top >= b.top - 2 && e.top <= b.bottom - 10 };
      }, last);
      console.log('revealed:', JSON.stringify(seen));
      expect(seen.headerVisible, `${last} header is in view`).toBe(true);
    }
    expect(errs, 'no errors').toEqual([]);
  });
});
