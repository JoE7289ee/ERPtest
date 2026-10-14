// Direct print: choosing the printer in the page's own dialog carries on to the print (it used to
// cancel silently), and each step shows on the message line. QZ Tray is faked in the page.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_direct_print_pick --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('choosing the printer goes on to print', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/multi-barcode');
  await expect(page.locator('.page-actions button:visible', { hasText: 'Print direct' }).first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    const w: any = window;
    localStorage.removeItem('jw_dpl_settings');
    w.__sent = [];
    w.qz = {
      security: { setCertificatePromise() {}, setSignaturePromise() {} },
      websocket: { isActive: () => true, connect: () => Promise.resolve() },
      printers: { find: () => Promise.resolve(['Microsoft Print to PDF', 'Label Printer', 'Fax']) },
      configs: { create: (p: string) => ({ printer: p }) },
      print: (cfg: any, data: any) => { w.__sent.push([cfg.printer, data[0].data]); return Promise.resolve(); },
    };
  });
  await page.locator('.page-actions button:visible', { hasText: 'Direct print' }).first().click();
  await page.locator('.dropdown-menu:visible a, .dropdown-menu:visible button', { hasText: 'Test tag' }).first().click();
  const dlg = page.locator('.modal.show', { hasText: 'Tag printer on this PC' });
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await dlg.locator('select').selectOption('Label Printer');
  await dlg.locator('.btn-primary').click();
  await expect(page.locator('.mb-msg')).toContainText('Sent 1 label(s) to Label Printer', { timeout: 20_000 });
  const sent = await page.evaluate(() => (window as any).__sent);
  expect(sent.length).toBe(1);
  expect(sent[0][0]).toBe('Label Printer');
  expect(sent[0][1]).toContain('\x02L');
  // the next print goes straight to the saved printer, no dialog
  await page.locator('.page-actions button:visible', { hasText: 'Direct print' }).first().click();
  await page.locator('.dropdown-menu:visible a, .dropdown-menu:visible button', { hasText: 'Test tag' }).first().click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__sent)).length).toBe(2);
  await expect(page.locator('.modal.show', { hasText: 'Tag printer on this PC' })).toHaveCount(0);
  // an error from QZ Tray, even a bare string, shows on the line
  await page.evaluate(() => { (window as any).qz.print = () => Promise.reject('Printer not found'); });
  await page.locator('.page-actions button:visible', { hasText: 'Direct print' }).first().click();
  await page.locator('.dropdown-menu:visible a, .dropdown-menu:visible button', { hasText: 'Test tag' }).first().click();
  await expect(page.locator('.mb-msg')).toContainText('Direct print stopped: Printer not found', { timeout: 20_000 });
  expect(errors).toEqual([]);
});
