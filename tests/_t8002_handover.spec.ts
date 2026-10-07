// A card handed from one page to another is the card that opens — the first time
// and every time after (fixes of 7 Oct 2026). Run on the :8002 copy:
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) HO_CARD=E… HO_A=<Design Bank id> HO_B=<id> HO_A_NO=… HO_B_NO=… npx playwright test _t8002_handover --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('hand-overs open the right card, again and again', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  await page.goto('/desk/job-order-status');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const go = async (opts: any, route: string) => {
    await page.evaluate(([o, r]) => { const f = (window as any).frappe; f.route_options = o; f.set_route(r); }, [opts, route] as any);
    await page.waitForTimeout(2500);
  };
  // 1. a card-number link opens Card Info WITH the card
  await go({ card: process.env.HO_CARD }, 'card-info');
  await expect(page.locator('#page-card-info')).toContainText(process.env.HO_CARD!, { timeout: 15_000 });
  expect(await page.evaluate(() => (window as any).frappe.route_options)).toBeFalsy();
  // 2. the Card Editor shows the card it is given — the second time too
  await go({ card: process.env.HO_A }, 'card-builder');
  const no = page.locator('#page-card-builder input[data-fieldname="design_no"], #page-card-builder .cb-no input').first();
  await expect.poll(async () => (await page.locator('#page-card-builder input').evaluateAll((els: any[]) => els.map((e) => e.value).join('|')))).toContain(process.env.HO_A_NO!);
  await page.evaluate(() => (window as any).frappe.set_route('design-gallery'));
  await page.waitForTimeout(1500);
  await go({ card: process.env.HO_B }, 'card-builder');
  await expect.poll(async () => (await page.locator('#page-card-builder input').evaluateAll((els: any[]) => els.map((e) => e.value).join('|'))), { timeout: 15_000 }).toContain(process.env.HO_B_NO!);
});
