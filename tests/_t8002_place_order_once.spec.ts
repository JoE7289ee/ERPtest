// Place Order saves the order and its cards in one go under a one-time number: when the reply
// is lost and the button is pressed again, the SAME order comes back, not a second one.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) VARIANT=<a variant> npx playwright test _t8002_place_order_once --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('place order once', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const VARIANT = process.env.VARIANT || 'A13010NP-18Y-EF';
  await page.goto('/desk/place-order');
  const place = page.getByRole('button', { name: 'Place Order', exact: true });
  await expect(place).toBeVisible({ timeout: 60_000 });
  const link = async (sel: string, value: string) => {
    const inp = page.locator(sel);
    await inp.click(); await inp.fill(''); await inp.pressSequentially(value, { delay: 40 });
    const opt = page.getByRole('option').filter({ hasText: value }).first();
    await opt.waitFor({ state: 'visible', timeout: 20_000 });
    await opt.click();
  };
  await link('.po-h-customer input', process.env.PARTY || 'JD Stock');
  await link('.po-h-ordertype input', process.env.OTYPE || 'CUSTOMER');
  const days = page.locator('.po-h-days input'); await days.click(); await days.fill('15'); await days.press('Tab');
  const row0 = page.locator('.po-grid tbody tr').first();
  const bank = row0.locator('input[data-fieldname="bank"]');
  await bank.click(); await bank.pressSequentially(VARIANT, { delay: 40 });
  await expect.poll(async () => await page.evaluate(() =>
    ((document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim()),
    { timeout: 25_000 }).toBe(VARIANT);
  await row0.locator('input[type="number"]').first().fill('2');
  // first press: the server does the work, the reply never reaches the page
  const seen: any[] = [];
  let drop = true;
  await page.route('**/api/method/jewelima.jewelima.api.place_order', async (route) => {
    const res = await route.fetch();
    seen.push(await res.json());
    if (drop) { drop = false; return route.abort('connectionreset'); }
    return route.fulfill({ response: res });
  });
  let oldCalls = 0;
  page.on('request', (r) => { if (/create_job_order|create_order_bag/.test(r.url())) oldCalls++; });
  await place.click();
  await expect.poll(() => seen.length, { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(1500);
  await page.locator('.modal.show .btn-modal-close, .modal.show .close').first().click({ timeout: 3000 }).catch(() => {});
  await expect(page.locator('.po-grid tbody tr input[data-fieldname="design"]').first()).toHaveValue(VARIANT);
  // second press: same page, same number
  await place.click();
  await expect(page.locator('.modal.show .modal-title', { hasText: 'Order placed' })).toBeVisible({ timeout: 30_000 });
  expect(seen.length).toBe(2);
  const [a, b] = seen.map((s) => s.message);
  expect(a.repeat).toBe(0);
  expect(b.repeat).toBe(1);
  expect(b.name).toBe(a.name);
  expect(b.bags).toEqual(a.bags);
  expect(a.bags.length).toBe(1);
  expect(oldCalls).toBe(0);
  await expect(page.locator('.modal.show .modal-body')).toContainText(a.name);
});
