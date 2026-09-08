// The open menu wears its own ground so you can see which menu you are inside.
import { test, expect } from '@playwright/test';
const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

function lum(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

test('the open menu wears a red pill; its pages and the green are untouched', async ({ page }) => {
  await page.goto('/desk/jewelima');
  await page.waitForFunction(READY, undefined, { timeout: 60_000 });
  await page.waitForTimeout(900);

  // open one menu through its own header, the way a person does
  await page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    const s = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === 'Stock');
    s.wrapper.find('.standard-sidebar-item').get(0)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);

  const d = await page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    const open = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === 'Stock');
    const shut = (sb.items || []).find((i: any) => i.wrapper?.attr?.('title') === 'Costing');
    const cs = (el: Element, p = 'background-color') => getComputedStyle(el).getPropertyValue(p).trim();
    const head = (s: any) => s.wrapper.find('> .standard-sidebar-item').get(0);
    const pageRow = open.$nested_items.find('.standard-sidebar-item').get(0);
    const label = open.$nested_items.find('.sidebar-item-label').get(0);
    const headLabel = open.wrapper.find('> .standard-sidebar-item .sidebar-item-label').get(0);
    const selected = document.querySelector('.body-sidebar .active-sidebar');
    return {
      openHeadBg: cs(head(open)),
      shutHeadBg: cs(head(shut)),
      openBlockBg: cs(open.wrapper.get(0)),
      pageRowBg: cs(pageRow),
      sidebarBg: cs(document.querySelector('.body-sidebar')!),
      headColor: headLabel ? getComputedStyle(headLabel).color : '',
      headText: headLabel?.textContent?.trim(),
      labelColor: label ? getComputedStyle(label).color : '',
      labelText: label?.textContent?.trim(),
      selectedBg: selected ? cs(selected) : '',
      selectedRadius: selected ? cs(selected, 'border-radius') : '',
      headRadius: cs(head(open), 'border-radius'),
      headShadow: cs(head(open), 'box-shadow'),
    };
  });
  console.log(JSON.stringify(d, null, 1));
  console.log('the menu title on its pill:', ratio(d.headColor, d.openHeadBg));
  console.log('pill vs the green        :', ratio(d.openHeadBg, d.sidebarBg));

  const [r, g, b] = d.openHeadBg.match(/\d+/g)!.slice(0, 3).map(Number);
  expect(r, 'the pill leads red').toBeGreaterThan(g);
  expect(r, 'the pill leads red').toBeGreaterThan(b);
  const bare = /rgba\(0, 0, 0, 0\)|transparent/;
  expect(d.shutHeadBg, 'a closed menu has no pill').toMatch(bare);
  expect(d.openBlockBg, 'the block behind it is NOT painted').toMatch(bare);
  expect(d.pageRowBg, 'a page inside the open menu is not painted either').toMatch(bare);
  expect(d.selectedBg, 'the page you are on is still white').toBe('rgb(255, 255, 255)');
  expect(d.headRadius, 'same pill shape as the white one').toBe(d.selectedRadius);
  expect(d.headShadow, 'and the same small shadow').not.toBe('none');
  expect(ratio(d.headColor, d.openHeadBg), 'the menu title reads on it').toBeGreaterThanOrEqual(4.5);

  await page.screenshot({ path: 'shots/sidebar-open-menu.png', clip: { x: 0, y: 0, width: 420, height: 800 } });
});
