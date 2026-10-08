// One device: the phone and tablet doors ask too, and Cancel leaves the working device alone.
//   . ./t8002-env.sh && SID_A=$(SID anakha@jd.in) SID_B=$(SID anakha@jd.in) npx playwright test _t8002_one_device_cancel --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('cancel keeps the first device', async ({ browser }) => {
  test.setTimeout(120_000);
  const base = process.env.BASE_URL!;
  const A = await browser.newContext(); const B = await browser.newContext();
  await A.addCookies([{ name: 'sid', value: process.env.SID_A!, url: base }]);
  await B.addCookies([{ name: 'sid', value: process.env.SID_B!, url: base }]);
  const b = await B.newPage();
  for (const door of ['/jw', '/jt']) {
    await b.goto(base + door);
    expect(b.url()).toContain('/takeover?next=' + door);
  }
  await b.locator('#no').click();
  await b.waitForURL(/\/login/, { timeout: 30_000 });
  await expect(b.locator('.jw-signed-out')).toHaveCount(0);
  expect((await A.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming')).status()).toBe(200);
  expect([401, 403]).toContain((await B.request.get(base + '/api/method/jewelima.jewelima.api.get_variant_naming')).status());
  await A.close(); await B.close();
});
