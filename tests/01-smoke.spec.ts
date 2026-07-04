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
    await gotoApp(page, route);
    // the page header title must render (make_app_page ran)
    await expect(page.locator('.page-head:visible .title-text, .page-title .title-text').first()).toBeVisible({ timeout: 20_000 });
    expect(errors, `JS errors on /${route}: ${errors.join(' | ')}`).toHaveLength(0);
  });
}
