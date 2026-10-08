// Loading screen: the name in gold on emerald, edge to edge. Place Order: no Add Row button.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_splash --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('splash and add row', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  // hold the desk's scripts back so the loading screen stays up
  await page.route(/\.bundle\.[A-Z0-9]+\.js/, (r) => r.abort());
  await page.goto('/desk', { waitUntil: 'domcontentloaded' });
  const splash = page.locator('.splash');
  await expect(splash).toBeVisible();
  await expect(splash.locator('img')).toHaveAttribute('src', /logo-horizontal-gold\.svg/);
  await page.waitForLoadState('load');
  const box = await splash.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBe(vp.width);
  expect(box!.height).toBe(vp.height);
  expect(await splash.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('rgb(13, 43, 30)');
  expect(await splash.locator('img').evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/splash.png' });
  await page.unroute(/\.bundle\.[A-Z0-9]+\.js/);
  await page.goto('/desk/place-order');
  await expect(page.locator('.page-actions .btn', { hasText: 'Remark all' }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.splash')).toHaveCount(0);
  await expect(page.locator('.page-actions .btn', { hasText: 'Add Row' })).toHaveCount(0);
});
