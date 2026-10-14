// Place Order: a "Linked (n)" button counts designs linked to those on the order; its dialog adds one as
// a new line, and the count drops.
//   needs a Pair link A 13010 <-> A 13013 on the test copy
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_place_order_linked --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('linked designs on place order', async ({ page, context }) => {
  test.setTimeout(150_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/place-order');
  const linked = page.locator('.page-actions button:visible', { hasText: 'Linked' }).first();
  await expect(linked).toBeVisible({ timeout: 60_000 });
  await expect(linked).toHaveText('Linked');
  const bank = page.locator('.po-grid tbody tr').first().locator('input[data-fieldname="bank"]');
  await bank.click(); await bank.pressSequentially('A13010-18P-EF', { delay: 40 });
  await expect(linked).toHaveText(/Linked \(1\)/, { timeout: 30_000 });
  await linked.click();
  const dlg = page.locator('.modal.show');
  await expect(dlg.locator('.lk-c', { hasText: 'A 13013' })).toBeVisible({ timeout: 20_000 });
  await expect(dlg.locator('.lk-t').first()).toHaveText('Pair');
  await page.screenshot({ path: 'test-results/place-order-linked.png' });
  await dlg.locator('.lk-add').first().click();
  await expect(dlg.locator('.lk-none')).toBeVisible({ timeout: 20_000 });
  await dlg.locator('.btn-primary', { hasText: 'Done' }).click();
  await expect(linked).toHaveText('Linked', { timeout: 20_000 });
  const banks = await page.evaluate(() => Array.from(document.querySelectorAll('.po-grid tbody tr input[data-fieldname="bank"]')).map((i: any) => i.value));
  console.log('BANKS', JSON.stringify(banks));
  expect(banks.some((v: string) => v.includes('A 13013'))).toBeTruthy();
  expect(errors).toEqual([]);
});
