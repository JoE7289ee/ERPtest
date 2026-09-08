// Menus and SUB-MENUS are different things, and the sidebar only tells them
// apart by item.indent — every section is a sibling at the same DOM depth.
//
//   1. opening a MENU closes the other open menus
//   2. opening a SUB-MENU closes nothing — several can be open together
//   3. and it certainly does not close its own parent (that was the bug)
import { test, expect, Page } from '@playwright/test';
const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

async function state(page: Page) {
  return page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    const secs = (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length);
    const open = secs.filter((s: any) => !s.$nested_items.hasClass('hidden'));
    return {
      menus: open.filter((s: any) => !s.item?.indent).map((s: any) => s.wrapper.attr('title')),
      subs: open.filter((s: any) => s.item?.indent).map((s: any) => s.wrapper.attr('title')),
    };
  });
}
async function click(page: Page, title: string) {
  return page.evaluate((t) => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === t);
    if (!s) throw new Error(`no section ${t}`);
    s.wrapper.find('.standard-sidebar-item').get(0)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }, title);
}

test.describe('menus and sub-menus', () => {
  let errs: string[] = [];
  test.beforeEach(async ({ page }) => {
    errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).split('\n')[0]));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
    await page.goto('/desk/jewelima');
    await page.waitForFunction(READY, undefined, { timeout: 60_000 });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const sb = (window as any).frappe.app.sidebar;
      (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length)
        .forEach((i: any) => { try { i.close(); } catch (e) {} });
    });
  });

  test('the sidebar really does have sub-menus', async ({ page }) => {
    const kinds = await page.evaluate(() => {
      const sb = (window as any).frappe.app.sidebar;
      const secs = (sb.items || []).filter((i: any) => i?.$nested_items?.length && i.wrapper?.length);
      return { menus: secs.filter((s: any) => !s.item?.indent).length,
        subs: secs.filter((s: any) => s.item?.indent).map((s: any) => s.wrapper.attr('title')) };
    });
    console.log(`${kinds.menus} menus, ${kinds.subs.length} sub-menus:`, kinds.subs.join(', '));
    expect(kinds.subs.length, 'sub-menus exist').toBeGreaterThan(0);
  });

  test('1. opening a menu closes the other menus', async ({ page }) => {
    await click(page, 'Stock');
    await click(page, 'Delivery');
    const s = await state(page);
    console.log('menus open:', JSON.stringify(s.menus));
    expect(s.menus, 'only the one just opened').toEqual(['Delivery']);
    expect(errs).toEqual([]);
  });

  test('2. a menu\'s sub-menus open together, and close nothing', async ({ page }) => {
    await click(page, 'Delivery');
    for (const sub of ['Certification', 'Hallmarking', 'Sales']) await click(page, sub);
    const s = await state(page);
    console.log('menus:', JSON.stringify(s.menus), '| subs:', JSON.stringify(s.subs));
    expect(s.subs.sort(), 'all three sub-menus stay open')
      .toEqual(['Certification', 'Hallmarking', 'Sales']);
    expect(s.menus, 'and their parent is untouched').toEqual(['Delivery']);
    expect(errs).toEqual([]);
  });

  test('3. a sub-menu does not close another menu either', async ({ page }) => {
    await click(page, 'Stock');
    await click(page, 'Records');        // a sub-menu of Stock
    let s = await state(page);
    expect(s.menus, 'Stock is still open').toEqual(['Stock']);
    expect(s.subs, 'and so is its sub-menu').toEqual(['Records']);

    // now open a different MENU: that one closes Stock, as rule 1 says
    await click(page, 'Costing');
    s = await state(page);
    console.log('after opening Costing — menus:', JSON.stringify(s.menus), '| subs:', JSON.stringify(s.subs));
    expect(s.menus, 'Costing replaced Stock').toEqual(['Costing']);
    expect(s.subs, "Stock's sub-menu is left as you had it").toEqual(['Records']);
    expect(errs).toEqual([]);
  });
});
