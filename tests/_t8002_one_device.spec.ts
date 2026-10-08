// One device to an account: the second sign-in is asked first, "Sign in here" signs the first
// device out, and the first device is told why.
//   . ./t8002-env.sh && SID_A=$(SID anoop@jd.in) SID_B=$(SID anoop@jd.in) npx playwright test _t8002_one_device --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('one device to an account', async ({ browser }) => {
  test.setTimeout(180_000);
  const base = process.env.BASE_URL!;
  const A = await browser.newContext(); const B = await browser.newContext();
  await A.addCookies([{ name: 'sid', value: process.env.SID_A!, url: base }]);
  await B.addCookies([{ name: 'sid', value: process.env.SID_B!, url: base }]);
  const a = await A.newPage(); const b = await B.newPage();
  // the first device is at work
  await a.goto(base + '/desk');
  await expect(a.locator('body[data-route], .desktop-container, #body').first()).toBeVisible({ timeout: 60_000 });
  expect(a.url()).not.toContain('/takeover');
  // the second device is asked before it gets the desk
  await b.goto(base + '/desk');
  await b.waitForURL(/\/takeover/, { timeout: 60_000 });
  await expect(b.locator('h1')).toContainText('signed in on another device');
  // and can do nothing until it answers
  const refused = await b.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming');
  expect(refused.status()).toBe(403);
  // the first device still works meanwhile
  expect((await a.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming')).status()).toBe(200);
  await b.locator('#go').click();
  await b.waitForURL(/\/(desk|app)/, { timeout: 60_000 });
  expect((await b.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming')).status()).toBe(200);
  // the first device is out, and told why
  const dead = await a.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming');
  expect([401, 403]).toContain(dead.status());
  await a.goto(base + '/desk');
  await a.waitForURL(/\/login/, { timeout: 60_000 });
  await expect(a.locator('.jw-signed-out')).toContainText('signed in on another device', { timeout: 20_000 });
  await a.screenshot({ path: 'test-results/one-device-signed-out.png' });
  // Cancel on a later sign-in leaves the working device alone
  await A.close(); await B.close();
});
