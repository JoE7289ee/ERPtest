import { test, expect } from '@playwright/test';
const READY = () => (window as any).frappe?.app?.sidebar?.items?.length > 0;

test('dark mode is left as Frappe has it', async ({ page }) => {
  await page.goto('/desk/jewelima');
  await page.waitForFunction(READY, undefined, { timeout: 60_000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(500);
  const d = await page.evaluate(() => {
    const sb = document.querySelector('.body-sidebar')!;
    const cs = (p: string) => getComputedStyle(sb).getPropertyValue(p).trim();
    const head = document.querySelector('.body-sidebar .section-break .sidebar-item-label');
    return { bg: getComputedStyle(sb).backgroundColor, hover: cs('--sidebar-hover-color'),
      border: cs('--sidebar-border-color'),
      headColor: head ? getComputedStyle(head).color : '' };
  });
  console.log('DARK', JSON.stringify(d));
  expect(d.bg, 'dark sidebar keeps Frappe\'s near-black').toBe('rgb(15, 15, 15)');
  await page.screenshot({ path: 'shots/sidebar-dark.png', clip: { x: 0, y: 0, width: 420, height: 800 } });
});
