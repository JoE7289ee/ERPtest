// Card Editor as an Ordering login: a design picked from the list loads, and nothing is refused.
//   . ./t8002-env.sh && SMOKE_SID=$(SID <an Ordering user>) npx playwright test _t8002_cardeditor_ordering --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('card editor for ordering', async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const refused: string[] = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) refused.push(r.status() + ' ' + r.url().split('/api/')[1].slice(0, 80)); });
  await page.goto('/desk/card-builder');
  const inp = page.locator('#page-card-builder .cb-pick input').first();
  await expect(inp).toBeVisible({ timeout: 60_000 });
  await inp.click(); await inp.pressSequentially('A 1301', { delay: 80 });
  await page.getByText('A 13011', { exact: true }).first().click({ timeout: 10_000 });
  await expect(page.locator('#page-card-builder .cb-no input')).toHaveValue('A 13011', { timeout: 15_000 });
  await expect(page.locator('#page-card-builder .cb-hist')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.modal.show')).toHaveCount(0);
  expect(refused).toEqual([]);
});
