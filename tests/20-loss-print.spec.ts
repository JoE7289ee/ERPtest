// Loss Report print: branded B&W window with export date + totals.
import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/jewelima';

test('print window carries letterhead, export date and pure totals', async ({ page, context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await gotoApp(page, 'loss-report');
  await expect(page.locator('.lr-card .v').first()).not.toHaveText('0.000 g');
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  const w = await popup;
  await w.waitForLoadState('domcontentloaded');
  const body = await w.locator('body').innerText();
  expect(body).toMatch(/loss report/i);
  expect(body).toContain('Exported:');
  expect(body).toContain('Pure gold in loss');
  expect(body).toMatch(/Jewelima|JEWELIMA/i);
  expect(body).toContain('Printed');
  await w.screenshot({ path: 'test-results/loss-print.png', fullPage: true });
});
