// Card Info: a cast card's Issue details say where its gold came from.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) CARD=E7613.16.1 npx playwright test _t8002_card_info_cast --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('card info shows the casting', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const card = process.env.CARD || 'E7613.16.1';
  let pass: any = null;
  page.on('response', async (r) => { if (r.url().includes('get_card_passport')) pass = (await r.json()).message; });
  await page.goto('/desk/card-lookup');
  const box = page.locator('#page-card-lookup input[type="text"], #page-card-lookup input:not([type])').first();
  await expect(box).toBeVisible({ timeout: 60_000 });
  await box.fill(card); await box.press('Enter');
  const sec = page.locator('.ci-sec', { has: page.locator('h4', { hasText: 'Issue details' }) });
  await expect(sec).toBeVisible({ timeout: 60_000 });
  await expect(sec.locator('tbody tr', { hasText: 'Cast' }).first()).toBeVisible();
  expect(pass.issues.some((r: any) => r.entry_type === 'Casting' && r.direction === 'In' && r.who)).toBeTruthy();
  expect(pass.issues.some((r: any) => r.entry_type === 'Convert')).toBeFalsy();
  console.log('ROWS', JSON.stringify(pass.issues.map((r: any) => [r.entry_type, r.direction, r.item, r.qty, r.who])));
  await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/card-info-cast.png' });
  expect(errors).toEqual([]);
});
