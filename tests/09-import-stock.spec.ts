// Import Stock (Delivery): page renders, row grid works, chips/dialogs open.
import { expect, test } from '@playwright/test';
import { gotoApp, setLink } from './helpers/jewelima';

test('import-stock page renders and a row validates green', async ({ page }) => {
  await gotoApp(page, 'import-stock');
  // header controls
  await expect(page.locator('.is-h-mode select')).toHaveValue('issue');
  await expect(page.locator('.is-h-holder input')).toHaveValue('JD Stock');
  await expect(page.locator('.is-h-supplier')).toBeHidden(); // purchase-only
  // one empty row
  await expect(page.locator('table.is-grid tbody tr')).toHaveCount(1);

  // fill the row: design + karat + gross -> GOLD AUTO-FILLS (gross − stones×0.2)
  await setLink(page, 'table.is-grid .c-design input', 'DEMO');
  await setLink(page, 'table.is-grid tr:first-child .c-karat input', '22KYG');
  await page.locator('table.is-grid tr:first-child .c-gross').fill('8.55');
  await page.locator('table.is-grid tr:first-child .c-gross').dispatchEvent('input');
  await expect(page.locator('table.is-grid tr:first-child .c-gold')).toHaveValue('8.550');
  // add stones -> gold drops by ct×0.2
  await page.locator('table.is-grid tr:first-child .c-stones').click();
  const dlg = page.locator('.modal:visible');
  await dlg.locator('.grid-add-row, .btn:has-text("Add Row")').first().click();
  await setLink(page, '.modal:visible input[data-fieldname="item"]', 'VS-FG 5-5.5');
  await dlg.locator('input[data-fieldname="pcs"]').fill('3');
  await dlg.locator('input[data-fieldname="ct"]').fill('0.45');
  await dlg.locator('input[data-fieldname="ct"]').press('Escape');
  await dlg.locator('.btn-primary', { hasText: 'Set' }).click();
  await expect(page.locator('table.is-grid tr:first-child .c-gold')).toHaveValue('8.460'); // 8.55 − 0.45×0.2
  await expect(page.locator('table.is-grid tbody tr').first()).toHaveClass(/is-ok/);
  await expect(page.locator('table.is-grid tbody tr')).toHaveCount(2); // grew
  await expect(page.locator('.is-count')).toHaveText('1');
  // size became a dropdown fed by the design's TYPE
  const sizeOpts = await page.locator('table.is-grid tr:first-child select.c-size option').count();
  expect(sizeOpts).toBeGreaterThan(1);

  // stones dialog opens; works dialog lists the seeded categories
  await page.locator('table.is-grid tr:first-child .c-stones').click();
  await expect(page.locator('.modal:visible')).toContainText('Stones');
  await page.keyboard.press('Escape');
  await page.locator('table.is-grid tr:first-child .c-works').click();
  await expect(page.locator('.modal:visible')).toContainText('Back Chain');
  await page.keyboard.press('Escape');

  // purchase mode reveals supplier
  await page.locator('.is-h-mode select').selectOption('purchase');
  await expect(page.locator('.is-h-supplier')).toBeVisible();
  await page.screenshot({ path: 'test-results/import-stock.png' });
});
