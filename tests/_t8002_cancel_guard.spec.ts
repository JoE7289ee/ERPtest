// Cancellation: a card out with a worker, or holding materials, shows why and has no cancel button.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) CARDS=E7588.1.1,E7627.1.1,E7626.1.1 npx playwright test _t8002_cancel_guard --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('cancel guard', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const [issued, loaded, empty] = (process.env.CARDS || 'E7588.1.1,E7627.1.1,E7626.1.1').split(',');
  await page.goto('/desk/cancellation');
  const scan = page.locator('.cx-scan').first();
  await expect(scan).toBeVisible({ timeout: 60_000 });
  for (const [card, words] of [[issued, 'receipt'], [loaded, 'take all materials out first']] as const) {
    await scan.fill(card); await scan.press('Enter');
    await expect(page.locator('.cx-block')).toContainText(words, { timeout: 20_000 });
    await expect(page.locator('.cx-cancelbag')).toHaveCount(0);
    await expect(page.locator('.cx-wh')).toHaveCount(0);
  }
  await scan.fill(empty); await scan.press('Enter');
  await expect(page.locator('.cx-cancelbag')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
