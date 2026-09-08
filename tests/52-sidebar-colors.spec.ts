// The sidebar's ground is darker than the page. Check the colours that have to
// move with it, and take a look.
import { test, expect } from '@playwright/test';
const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

// WCAG relative luminance + contrast, so "readable" is measured, not eyeballed
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

test('sidebar ground is a green that everything on it still reads against', async ({ page }) => {
  await page.goto('/desk/jewelima');
  await page.waitForFunction(READY, undefined, { timeout: 60_000 });
  await page.waitForTimeout(900);

  const d = await page.evaluate(() => {
    const cs = (el: Element | null, p: string) => el ? getComputedStyle(el).getPropertyValue(p).trim() : '';
    const sb = document.querySelector('.body-sidebar');
    const root = document.documentElement;
    const labels = Array.from(document.querySelectorAll('.body-sidebar .standard-sidebar-item .sidebar-item-label'));
    const head = document.querySelector('.body-sidebar .section-break .sidebar-item-label');
    const link = labels.find((l) => !l.closest('.section-break'));
    return {
      sidebarBg: cs(sb, 'background-color'),
      // .main-section paints nothing — walk up until something actually does,
      // or "the page" measures as transparent black and every ratio is a lie
      pageBg: (() => {
        let el: Element | null = document.querySelector('.main-section') || document.body;
        while (el) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
          el = el.parentElement;
        }
        return 'rgb(255, 255, 255)';
      })(),
      navBg: cs(document.querySelector('.navbar, .page-head') || document.body, 'background-color'),
      // the override is scoped to the sidebar's own container, so these must be
      // read THERE — :root still carries Frappe's values, which is the point
      hover: cs(sb, '--sidebar-hover-color'),
      border: cs(sb, '--sidebar-border-color'),
      rootHover: cs(root, '--sidebar-hover-color'),
      linkColor: cs(link || null, 'color'), linkText: link?.textContent?.trim(),
      headColor: cs(head, 'color'), headText: head?.textContent?.trim(),
    };
  });
  const hex = (v: string) => v.startsWith('#') ? v : v;
  const toRgb = (v: string) => v.startsWith('#')
    ? `rgb(${[1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).join(',')})` : v;

  console.log(JSON.stringify(d, null, 1));
  console.log('link  on ground:', ratio(d.linkColor, d.sidebarBg));
  console.log('head  on ground:', ratio(d.headColor, d.sidebarBg));
  console.log('ground vs page :', ratio(d.sidebarBg, d.pageBg));
  console.log('hover  vs ground:', ratio(toRgb(hex(d.hover)), d.sidebarBg));

  expect(d.sidebarBg, 'sidebar is not the page colour').not.toBe(d.pageBg);
  expect(lum(d.sidebarBg), 'sidebar is darker than the page').toBeLessThan(lum(d.pageBg));
  expect(ratio(d.linkColor, d.sidebarBg), 'menu links read').toBeGreaterThanOrEqual(4.5);
  expect(ratio(d.headColor, d.sidebarBg), 'headings read').toBeGreaterThanOrEqual(4.5);
  expect(lum(d.headColor), 'a heading is still lighter than a link').toBeGreaterThan(lum(d.linkColor));
  expect(lum(toRgb(hex(d.hover))), 'hover is darker than the ground').toBeLessThan(lum(d.sidebarBg));
  expect(d.rootHover, 'the override did not leak out of the sidebar').not.toBe(d.hover);

  // it should read as green, not as a grey that happens to have a green name
  const [r, g, b2] = d.sidebarBg.match(/\d+/g)!.slice(0, 3).map(Number);
  console.log('rgb:', r, g, b2, '| green lead:', g - Math.max(r, b2));
  expect(g, 'green leads red').toBeGreaterThan(r);
  expect(g, 'green leads blue').toBeGreaterThan(b2);

  await page.screenshot({ path: 'shots/sidebar-green.png', clip: { x: 0, y: 0, width: 420, height: 800 } });
});
