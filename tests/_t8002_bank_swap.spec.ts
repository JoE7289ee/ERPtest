// Place Order: a line holding a variant, changed to a card that has NO variant, loses the old
// variant — the old design must not be what gets ordered under the new card.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) VARIANT=<variant> BARE=<card with no variant> npx playwright test _t8002_bank_swap --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('card with no variant clears the old variant', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const VARIANT = process.env.VARIANT || 'A13010-18P-EF';
  const BARE = process.env.BARE || 'JS-4';
  await page.goto('/desk/place-order');
  await expect(page.getByRole('button', { name: 'Place Order', exact: true })).toBeVisible({ timeout: 60_000 });
  const row0 = page.locator('.po-grid tbody tr').first();
  const bank = row0.locator('input[data-fieldname="bank"]');
  const design = () => page.evaluate(() =>
    ((document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim());
  await bank.click(); await bank.pressSequentially(VARIANT, { delay: 40 });
  await expect.poll(design, { timeout: 25_000 }).toBe(VARIANT);
  await row0.locator('input[type="number"]').first().fill('2');
  // select the text and type over it — the box is never empty
  await bank.click(); await bank.press('ControlOrMeta+a'); await bank.pressSequentially(BARE, { delay: 40 });
  const opt = page.getByRole('option').filter({ hasText: BARE }).first();
  await opt.waitFor({ state: 'visible', timeout: 20_000 });
  await opt.click();
  await expect.poll(design, { timeout: 20_000 }).toBe('');
  // and everything that came from it: no weights left, the row no longer green
  await expect.poll(async () => (await row0.innerText()).replace(/\s+/g, ' '), { timeout: 10_000 }).not.toMatch(/NOSEPIN|\d\.\d{3}/);
  await page.screenshot({ path: 'test-results/bank-swap.png' });
  expect(errors).toEqual([]);
});
