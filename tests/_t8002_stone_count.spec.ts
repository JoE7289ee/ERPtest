// Stone count: typing a weight reads the book of that moment, and the count is sent with it.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_stone_count --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('stone count sends the book it was weighed against', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let bookCalls = 0; let sent: any = null;
  // the book has "moved" by the time the weight is typed: the page must show and send the new figure
  await page.route('**/api/method/jewelima.jewelima.api.get_stone_book', async (route) => {
    bookCalls++;
    const res = await route.fetch(); const j = await res.json();
    j.message.stock = Math.round((j.message.stock - 0.5) * 1000) / 1000;
    return route.fulfill({ response: res, json: j });
  });
  await page.route('**/api/method/jewelima.jewelima.api.create_stone_adjustment', async (route) => {
    sent = JSON.parse(new URLSearchParams(route.request().postData() || '').get('rows') || '[]');
    return route.fulfill({ json: { message: { name: 'TEST', lines: 1, short: 0.2, over: 0 } } });
  });
  await page.goto('/desk/stone-adjustment');
  const first = page.locator('.sa2-t tbody tr').first();
  await expect(first.locator('.sa2-in')).toBeVisible({ timeout: 60_000 });
  const book0 = parseFloat((await first.locator('td.sa2-bk').innerText()).replace(/,/g, ''));
  await first.locator('.sa2-in').fill(String(Math.round((book0 - 0.7) * 1000) / 1000));
  await first.locator('.sa2-in').press('Tab');
  await expect.poll(() => bookCalls).toBeGreaterThan(0);
  await expect(first.locator('td.sa2-d')).toHaveText(/-0\.200/, { timeout: 10_000 });
  await page.locator('.sa2-why input').fill('test');
  await page.locator('.sa2-go').click();
  await expect(page.locator('.modal.show')).toContainText('-0.200');
  await page.locator('.modal.show .btn-primary').click();
  await expect.poll(() => sent).not.toBeNull();
  expect(Math.abs(sent[0].book - (book0 - 0.5))).toBeLessThan(0.0006);
  expect(Math.abs(sent[0].counted - (book0 - 0.7))).toBeLessThan(0.0006);
  expect(errors).toEqual([]);
});
