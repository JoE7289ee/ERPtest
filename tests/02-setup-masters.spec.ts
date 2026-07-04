// Setup group: Design Types (sizes + defaults + guards), Types & Salesmen, Warehouse flags.
import { expect, test } from '@playwright/test';
import { dismissModal, frappeCall, gotoApp, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });

test('Design Types: add type, add sizes, set default, guarded delete', async ({ page }) => {
  const T = `ZZT ${uid()}`;
  await gotoApp(page, 'design-types');
  // add a new type
  await page.locator('.dt-new').fill(T);
  await page.locator('.dt-add').click();
  const row = page.locator('table.dt-tbl tr', { hasText: T });
  await expect(row).toBeVisible();
  // add two sizes
  for (const s of ['S1', 'S2']) {
    await row.locator('.dt-addsize').fill(s);
    await row.locator('.dt-addsize').press('Enter');
    await expect(row.locator('.dt-chip', { hasText: s })).toBeVisible();
  }
  // click S1 -> default (green)
  await row.locator('.dt-chip .lbl', { hasText: 'S1' }).click();
  await expect(row.locator('.dt-chip.default', { hasText: 'S1' })).toBeVisible();
  // remove S2
  await row.locator('.dt-chip', { hasText: 'S2' }).locator('.x').click();
  await expect(row.locator('.dt-chip', { hasText: 'S2' })).toHaveCount(0);
  // delete the (unused) type
  await row.locator('.dt-del').click();
  await page.locator('.modal:visible .btn-primary', { hasText: /yes|confirm/i }).click();
  await expect(page.locator('table.dt-tbl tr', { hasText: T })).toHaveCount(0, { timeout: 15_000 });
});

test('Design Types: a type used by a design is locked', async ({ page }) => {
  await gotoApp(page, 'design-types');
  const rows = await frappeCall(page, 'jewelima.jewelima.api.get_design_types_with_sizes');
  const used = rows.find((r: any) => r.used_by > 0);
  test.skip(!used, 'no design-linked type on this site yet');
  const row = page.locator('table.dt-tbl tr', { hasText: used.design_type }).first();
  await expect(row.getByText('🔒 in use')).toBeVisible();
});

test('Types & Salesmen: add + retire(delete unused) both kinds', async ({ page }) => {
  const T = `ZZOT${uid()}`;
  const S = `ZZSM${uid()}`;
  await gotoApp(page, 'order-masters');
  for (const [kind, val] of [['type', T], ['salesman', S]] as const) {
    const panel = page.locator(`.om-panel[data-kind="${kind}"]`);
    await panel.locator('.om-new').fill(val);
    await panel.locator('.om-add').click();
    const row = panel.locator('tr', { hasText: val });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('unused')).toBeVisible();
    // retire an unused value -> deleted outright
    await row.locator('.om-act').click();
    await page.locator('.modal:visible .btn-primary', { hasText: /yes|confirm/i }).click();
    await expect(panel.locator('tr', { hasText: val })).toHaveCount(0, { timeout: 15_000 });
  }
});

test('Warehouse Management: toggle a flag on and off', async ({ page }) => {
  await gotoApp(page, 'warehouse-management');
  const box = page.locator('.wm-cb[data-flag="custom_is_loss"]').first();
  const before = await box.isChecked();
  await box.click();
  await page.waitForTimeout(1200);
  await gotoApp(page, 'warehouse-management'); // reload proves it persisted
  const box2 = page.locator('.wm-cb[data-flag="custom_is_loss"]').first();
  expect(await box2.isChecked()).toBe(!before);
  await box2.click(); // restore
  await page.waitForTimeout(1200);
  await dismissModal(page);
});

test('Order Settings defaults prefill Place Order', async ({ page }) => {
  // set default days via API (the settings form is a plain doctype form)
  await gotoApp(page, 'place-order');
  const prev = await frappeCall(page, 'jewelima.jewelima.api.get_order_defaults');
  await page.evaluate(async () => {
    const f = (window as any).frappe;
    await f.call({ method: 'frappe.client.set_value', args: { doctype: 'Jewelima Order Settings', name: 'Jewelima Order Settings', fieldname: 'default_days', value: 15 } });
  });
  await gotoApp(page, 'place-order');
  await expect(page.locator('input[data-fieldname="days"]')).toHaveValue('15', { timeout: 15_000 });
  await expect(page.locator('.po-due').first()).toContainText('Due');
  // restore
  await page.evaluate(async (days) => {
    const f = (window as any).frappe;
    await f.call({ method: 'frappe.client.set_value', args: { doctype: 'Jewelima Order Settings', name: 'Jewelima Order Settings', fieldname: 'default_days', value: days || 0 } });
  }, prev.days);
});
