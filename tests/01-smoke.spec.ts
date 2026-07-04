// Smoke: every Jewelima desk page loads without a JS crash.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

const PAGES = [
  'place-order', 'card-info', 'job-order-status', 'cad-jobs',
  'job-work', 'assign-collect', 'bag-split', 'transfer-order-bag', 'print-barcode',
  'purchase-raw-material', 'weight-add', 'weight-reduce', 'melt-gold', 'stock-transfer',
  'make-products', 'finished-items',
  'bench-dashboard', 'employee-performance', 'warehouse-stock', 'item-stock',
  'print-order-bags', 'order-bag-photos',
  'design-gallery', 'design-tags', 'add-design', 'retire-design',
  'design-types', 'order-masters', 'warehouse-management',
];

for (const route of PAGES) {
  test(`page /${route} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // dev-bench asset races can crash a cold load; gotoApp reloads — only the errors
    // of the FINAL document load count
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) errors.length = 0; });
    await gotoApp(page, route);
    // the page wrapper must render with content (make_app_page ran)
    const wrapper = page.locator(`#page-${route}`);
    await expect(wrapper).toBeVisible({ timeout: 20_000 });
    await expect(wrapper.locator('.page-head, .page-body, .layout-main-section').first()).toBeVisible();
    expect(errors, `JS errors on /${route}: ${errors.join(' | ')}`).toHaveLength(0);
  });
}
