// A sub-menu and a page render as the same kind of row in Frappe's sidebar —
// same anchor, same icon slot — so the only thing telling them apart was the
// chevron. Every sub-menu now wears ONE icon, so they read as a set.
import { test, expect } from '@playwright/test';
const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

test('every sub-menu wears the same icon, and no page borrows it', async ({ page }) => {
  await page.goto('/desk/jewelima');
  await page.waitForFunction(READY, undefined, { timeout: 60_000 });
  await page.waitForTimeout(1000);

  const d = await page.evaluate(() => {
    const sb = (window as any).frappe.app.sidebar;
    const all = (sb.items || []).filter((i: any) => i.wrapper?.length);
    const submenus = all.filter((i: any) => i.item?.type === 'Section Break' && i.item?.indent);
    const pages = all.filter((i: any) => i.item?.type === 'Link');
    const iconOf = (s: any) => s.wrapper.find('.sidebar-item-icon').attr('item-icon') || '';
    return {
      submenus: submenus.map((s: any) => ({ label: s.item.label, icon: iconOf(s) })),
      pageIcons: Array.from(new Set(pages.map(iconOf))).filter(Boolean),
    };
  });

  const icons = Array.from(new Set(d.submenus.map((s: any) => s.icon)));
  console.log(`${d.submenus.length} sub-menus, icon(s) used: ${JSON.stringify(icons)}`);
  expect(d.submenus.length, 'there are sub-menus to check').toBeGreaterThan(20);
  expect(icons, 'all of them share exactly one icon').toEqual(['folder']);
  expect(d.pageIcons, 'and no page wears it, or the signal is worthless').not.toContain('folder');
  console.log(`${d.pageIcons.length} distinct page icons, none of them folder`);
});
