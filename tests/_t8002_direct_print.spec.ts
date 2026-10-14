// Multi Print > Print direct: builds the Datamax (DPL) tag from the page's own layout and, with no
// QZ Tray on this machine, says so plainly instead of failing silently.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_direct_print --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('direct print builds DPL and reports a missing QZ Tray', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/multi-barcode');
  const scan = page.locator('#page-multi-barcode input').first();
  await expect(scan).toBeVisible({ timeout: 60_000 });
  const card = process.env.CARD || '';
  const dpl = await page.evaluate(() => {
    const w: any = window;
    const c = { name: 'E7617.7.5', gw: 3.5, dmd_no: 60, dmd_wt: 0.21, stone_family: 'EF', party: 'JD STOCK', gold_code: '18P', design_no: 'A 13470 NP' };
    return w.jewelima.dpl.run([c], w.jewelima.barcodeOpts({ showColor: true, showFamily: true }));
  });
  expect(dpl.startsWith('\x02n\r\x02L\rD11\r')).toBeTruthy();
  expect(dpl).toContain('1W1d22000');
  expect(dpl).toContain('E7617.7.5\r\r');
  expect(dpl.trim().endsWith('E')).toBeTruthy();
  console.log(dpl.replace(/\x02/g, '<STX>').split('\r').join(' | '));
  await expect(page.locator('.page-actions button:visible, .page-actions .btn:visible', { hasText: 'Print direct' }).first()).toBeVisible();
  // no cards scanned: it says so
  await page.locator('.page-actions button:visible', { hasText: 'Print direct' }).first().click();
  await expect(page.locator('.mb-msg')).toContainText('Scan the cards first');
  // the test tag: QZ Tray is not on this machine, so the page must say that
  await page.locator('.page-actions button:visible', { hasText: 'Direct print' }).first().click();
  await page.locator('.dropdown-menu:visible a, .dropdown-menu:visible button', { hasText: 'Test tag' }).first().click();
  await expect(page.locator('.mb-msg')).toContainText(/QZ Tray/, { timeout: 30_000 });
  console.log('MSG', await page.locator('.mb-msg').innerText());
  expect(errors).toEqual([]);
});
