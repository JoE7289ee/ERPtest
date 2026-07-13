// Sidebar survives a full hide/show cycle (Bootstrap tooltips steal title attrs
// in icon-rail mode — a CSS rule keyed on [title=""] used to hide every item).
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('sections still show their items after hiding/unhiding the sidebar', async ({ page }) => {
  await gotoApp(page, 'item-stock');
  await page.waitForTimeout(1200);
  // full sidebar cycle: hide via the arrow button, show via frappe's Ctrl+/
  await page.locator('button.collapse-sidebar-link').click({ force: true });
  await page.waitForTimeout(800);
  await page.keyboard.press('Control+/');
  await page.waitForTimeout(1500);
  // expand Manufacturing — all six items must actually be visible
  const mfg = page.locator('.sidebar-item-container.section-item', { hasText: 'Manufacturing' }).first();
  await mfg.locator('.drop-icon').first().click();
  await expect(page.locator('.sidebar-item-container', { hasText: 'Assign / Collect' }).first()).toBeVisible();
  await expect(page.locator('.sidebar-item-container', { hasText: 'Tree Making' }).first()).toBeVisible();
  const visKids = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.sidebar-item-container.section-item')].find((e) => e.textContent!.includes('Manufacturing'));
    return [...el!.querySelector(':scope > .nested-container')!.children].filter((k: any) => k.offsetParent).length;
  });
  expect(visKids).toBe(6);
  // and the saved state still keys by real section titles (our full-map save
  // runs 80ms after the click, overwriting core's clobbered write)
  await page.waitForTimeout(400);
  const st = JSON.parse(await page.evaluate(() => localStorage.getItem('section-breaks-state') || '{}'));
  expect(Object.keys(st.jewelima || {})).toContain('Manufacturing');
});
