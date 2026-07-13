// IGI export: select pieces on the desk -> Export IGI -> xlsx downloads.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('desk selection exports the IGI workbook', async ({ page }) => {
  await gotoApp(page, 'certify');
  const pieces = await frappeCall(page, 'jewelima.jewelima.api.get_certifiable_pieces');
  await page.locator(`.ct-pieces tr[data-bag="${pieces[0].order_bag}"]`).click();
  await page.locator('button', { hasText: 'Export IGI' }).click();
  const dl = page.waitForEvent('download');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Download' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^IGI-\d{4}-\d{2}-\d{2}-1pc\.xlsx$/);
});
