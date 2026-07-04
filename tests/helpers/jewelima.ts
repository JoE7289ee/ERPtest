// Shared helpers for the Jewelima desk pages.
import { expect, Page } from '@playwright/test';

/** Open a desk route and wait for Frappe to be ready. */
export async function gotoApp(page: Page, route: string) {
  // this Frappe build serves the desk at /desk (and redirects /app there)
  await page.goto(`/desk/${route}`);
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
  // wait for the page wrapper; a stuck splash gets one reload
  const wrapper = page.locator(`#page-${route}`);
  try {
    await wrapper.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    await page.reload();
    await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
    await wrapper.waitFor({ state: 'visible', timeout: 20_000 });
  }
  await page.waitForTimeout(400); // page JS finishes building after route
}

/** Call a whitelisted server method through the app's own session. */
export async function frappeCall<T = any>(page: Page, method: string, args: Record<string, any> = {}): Promise<T> {
  return await page.evaluate(
    async ({ method, args }) => {
      const r = await (window as any).frappe.call({ method, args });
      return r.message;
    },
    { method, args }
  );
}

/** Set a Frappe Link control (awesomplete): type, wait for the dropdown, pick the match. */
export async function setLink(page: Page, inputSelector: string, value: string) {
  const input = page.locator(inputSelector).first();
  await input.click();
  await input.fill(value);
  // frappe's link dropdown exposes ARIA options; click the exact match
  const option = page.getByRole('option', { name: new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first();
  try {
    await option.waitFor({ state: 'visible', timeout: 8_000 });
    await option.click();
  } catch {
    await input.press('Enter'); // first option is pre-selected
  }
  await expect(input).toHaveValue(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 8_000 });
}

/** Wait for a green frappe toast containing the text. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.alert.desk-alert, .show-alert').filter({ hasText: text }).first())
    .toBeVisible({ timeout: 20_000 });
}

/** Close any open msgprint modal. */
export async function dismissModal(page: Page) {
  const btn = page.locator('.modal:visible button.btn-modal-close, .modal:visible .modal-header .close').first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  await page.keyboard.press('Escape').catch(() => {});
}

/** Unique suffix so runs never collide. */
export const uid = () => `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`;

// ---- API-level data factories (each spec seeds & cleans its own world) ----

export async function apiCreateDesign(page: Page, name: string, opts: { type?: string; gold?: string; goldWt?: number; stoneRows?: any[] } = {}) {
  const materials = [
    { item: opts.gold || '22KYG', qty: 0, weight: opts.goldWt ?? 5.0 },
    ...(opts.stoneRows || []),
  ];
  return frappeCall(page, 'jewelima.jewelima.api.create_design', {
    design_name: name,
    design_type: opts.type || 'RING',
    materials: JSON.stringify(materials),
  });
}

export async function apiDeleteDesign(page: Page, name: string) {
  await page.evaluate(async (nm) => {
    const f = (window as any).frappe;
    const bags = await f.call({ method: 'frappe.client.get_list', args: { doctype: 'Order Bag', filters: { design: nm }, fields: ['name'], limit_page_length: 0 } });
    for (const b of bags.message || []) {
      await f.call({ method: 'frappe.client.delete', args: { doctype: 'Order Bag', name: b.name } }).catch(() => {});
    }
    const d = await f.call({ method: 'frappe.client.get', args: { doctype: 'Design', name: nm } }).catch(() => null);
    if (!d) return;
    const doc = d.message;
    if (doc.bom) {
      await f.call({ method: 'frappe.client.cancel', args: { doctype: 'BOM', name: doc.bom } }).catch(() => {});
      await f.call({ method: 'frappe.client.delete', args: { doctype: 'BOM', name: doc.bom } }).catch(() => {});
    }
    await f.call({ method: 'frappe.client.delete', args: { doctype: 'Design', name: nm } }).catch(() => {});
    await f.call({ method: 'frappe.client.delete', args: { doctype: 'Item', name: nm } }).catch(() => {});
  }, name);
}

/** Buy raw material into a warehouse so melting/issuing has stock. */
export async function apiPurchase(page: Page, warehouse: string, items: { item: string; weight: number; count?: number }[]) {
  return frappeCall(page, 'jewelima.jewelima.api.post_raw_material_purchase', {
    supplier: 'JD Stock',
    warehouse,
    items: JSON.stringify(items.map((i) => ({ ...i, count: i.count || 0, isStone: !!i.count }))),
  });
}

export async function apiWarehouseByName(page: Page, warehouseName: string): Promise<string> {
  const r = await page.evaluate(async (wn) => {
    const f = (window as any).frappe;
    const res = await f.call({ method: 'frappe.client.get_list', args: { doctype: 'Warehouse', filters: { warehouse_name: wn }, fields: ['name'], limit_page_length: 1 } });
    return res.message;
  }, warehouseName);
  return r?.[0]?.name;
}
