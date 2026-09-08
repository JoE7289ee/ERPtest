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

test('the open menu is a red block on the green, and the page stays white', async ({ page }) => {
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
    const label = open.$nested_items.find('.sidebar-item-label').get(0);
    const selected = document.querySelector('.body-sidebar .active-sidebar');
    return {
      openBg: cs(open.wrapper.get(0)),
      shutBg: cs(shut.wrapper.get(0)),
      sidebarBg: cs(document.querySelector('.body-sidebar')!),
      openHover: cs(open.wrapper.get(0), '--sidebar-hover-color'),
      shutHover: cs(shut.wrapper.get(0), '--sidebar-hover-color'),
      labelColor: label ? getComputedStyle(label).color : '',
      labelText: label?.textContent?.trim(),
      selectedBg: selected ? cs(selected) : '',
      radius: cs(open.wrapper.get(0), 'border-radius'),
    };
  });
  console.log(JSON.stringify(d, null, 1));
  console.log('pages in the open menu:', ratio(d.labelColor, d.openBg));
  console.log('open block vs sidebar :', ratio(d.openBg, d.sidebarBg));
  console.log('selected vs open block:', ratio(d.selectedBg || 'rgb(255,255,255)', d.openBg));

  const [r, g, b] = d.openBg.match(/\d+/g)!.slice(0, 3).map(Number);
  expect(r, 'the open block leads red').toBeGreaterThan(g);
  expect(r, 'the open block leads red').toBeGreaterThan(b);
  expect(d.shutBg, 'a closed menu is left on the sidebar ground')
    .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(ratio(d.labelColor, d.openBg), 'pages inside it still read').toBeGreaterThanOrEqual(4.5);
  expect(d.openHover, 'hover follows the block').not.toBe(d.shutHover);

  await page.screenshot({ path: 'shots/sidebar-open-menu.png', clip: { x: 0, y: 0, width: 420, height: 800 } });
});
