// Design Links: pick a type and two designs, link them; the link lists below, shows in Card Editor
// on both designs, and can be removed.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_design_links --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('design links', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/design-pair');
  await expect(page.locator('.dl-type option')).toHaveCount(4, { timeout: 60_000 });
  await page.locator('.dl-type').selectOption('Pair');
  const pick = async (side: string, q: string) => {
    const s = page.locator(`.dl-side[data-s="${side}"]`);
    await s.locator('.dl-q').fill(q);
    await s.locator('.dl-hit').first().click({ timeout: 20_000 });
    await expect(s.locator('.dl-picked')).toBeVisible();
    return (await s.locator('.dl-picked .n').innerText()).trim();
  };
  const a = await pick('a', process.env.A || 'B 2436 E');
  const b = await pick('b', process.env.B || 'BA 3661');
  await page.locator('.dl-go').click();
  const row = page.locator('.dl-row', { hasText: a }).filter({ hasText: b }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator('.t')).toHaveText('Pair');
  await page.screenshot({ path: 'test-results/design-links.png' });
  // both designs show the link in Card Editor
  const ap = row.locator('.dl-card[data-st="Approved"]').first();
  const first = (await ap.locator('.n').innerText()).trim();
  const other = first === a ? b : a;
  await ap.click();
  await expect(page.locator('.cb-links .cb-lnk', { hasText: other })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cb-links .cb-lnk', { hasText: other })).toContainText('Pair');
  // remove it again
  await page.goto('/desk/design-pair');
  const row2 = page.locator('.dl-row', { hasText: a }).filter({ hasText: b }).first();
  await row2.locator('.rm').click();
  await page.locator('.modal.show .btn-primary').click();
  await expect(page.locator('.dl-row', { hasText: a }).filter({ hasText: b })).toHaveCount(0, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
