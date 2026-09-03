// The whole hallmarking round trip, driven as the person who does it.
//
// JISMY holds JW Delivery, which is exactly what the four desks need, so this
// runs as her from end to end: pick the pieces by filter, send them out, take
// the packet back, and type the codes that come back stamped on them.
//
//   BASE_URL=... ERP_SID=<jismy> npx playwright test 40-hallmarking --project=chromium
//
// Every step is recorded (playwright.config.ts records at 1280x800).
import { test, expect } from '@playwright/test';

const CENTRE = process.env.CENTRE || 'KERALA';
const TAKE = parseInt(process.env.TAKE || '3', 10);
// deliberately obvious codes — a real one is issued by the centre
const CODES = ['ZZ1001', 'ZZ1002', 'ZZ1003', 'ZZ1004', 'ZZ1005', 'ZZ1006'];

test.describe.configure({ mode: 'serial' });
const wait = (p: any, ms: number) => p.waitForTimeout(ms);

async function open(page: any, route: string) {
  await page.goto('/desk/' + route);
  await page.waitForFunction(() => (window as any).frappe?.boot, undefined, { timeout: 45000 });
  await page.locator('#page-' + route).waitFor({ state: 'visible', timeout: 30000 });
  await wait(page, 1800);
}
const state: any = { batch: '', bags: [] };

test('1 JISMY picks the pieces and sends them out', async ({ page }) => {
  test.setTimeout(240_000);
  const who = await page.goto('/app').then(() => page.waitForFunction(() => (window as any).frappe?.boot))
    .then(() => page.evaluate(() => (window as any).frappe.session.user));
  console.log('acting as:', who);

  await open(page, 'hallmark');
  await page.locator('.hm-center').selectOption({ label: CENTRE });
  await wait(page, 900);

  // the picker — filter to a bucket, tick, add
  await page.locator('.hm-pick').click();
  const d = page.locator('.modal:visible').last();
  await d.waitFor({ state: 'visible', timeout: 15000 });
  await wait(page, 2500);
  console.log('picker  :', (await d.locator('.hp-count').innerText()).trim());
  await d.locator('.hp-f[data-f="bucket"]').selectOption('FEMI');
  await wait(page, 2500);
  console.log('in FEMI :', (await d.locator('.hp-count').innerText()).trim());
  const boxes = d.locator('.hp-body input:not([disabled])');
  const n = Math.min(await boxes.count(), TAKE);
  for (let i = 0; i < n; i++) { await boxes.nth(i).check(); await wait(page, 250); }
  state.bags = await d.locator('.hp-body tr').evaluateAll((rows: any[]) =>
    rows.filter((r) => (r.querySelector('input') as HTMLInputElement)?.checked)
        .map((r) => r.querySelector('td:nth-child(2)')!.textContent!.trim()));
  console.log('ticked  :', JSON.stringify(state.bags));
  await d.locator('.modal-footer .btn-primary').click();
  await wait(page, 4000);
  console.log('batch   :', (await page.locator('.hm-tot').innerText()).replace(/\n/g, ' · '));

  // PREP & SEND, one action
  const sent = page.waitForResponse((r) => r.url().includes('send_hall_prep') && r.status() === 200, { timeout: 90_000 });
  await page.locator('.hm-gosend').click();
  const body = await (await sent).json();
  state.batch = (body?.message || {}).name;
  console.log('SENT    :', JSON.stringify(body?.message));
  expect(state.batch, 'the batch must have gone out').toBeTruthy();
  await wait(page, 2500);
});

test('2 the packet is out, then JISMY collects it', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 'hallmark-out');
  const card = page.locator(`.ho-card[data-name="${state.batch}"]`);
  await card.waitFor({ state: 'visible', timeout: 20000 });
  console.log('out board:', (await card.innerText()).replace(/\n/g, ' · '));
  const got = page.waitForResponse((r) => r.url().includes('collect_hallmarking') && r.status() === 200, { timeout: 90_000 });
  await card.locator('.ho-collect').click();
  const dlg = page.locator('.modal:visible').last();
  await dlg.waitFor({ state: 'visible', timeout: 10000 });
  await wait(page, 1200);
  await dlg.locator('.btn-modal-primary, .btn-primary').first().click();
  console.log('COLLECTED:', JSON.stringify((await (await got).json())?.message));
  await wait(page, 2500);
});

test('3 JISMY types the codes that came back', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, 'confirm-huid');
  console.log('waiting  :', (await page.locator('.ch-body').innerText()).replace(/\n/g, ' · ').slice(0, 110));
  const $card = page.locator('.ch-card input');
  const $h1 = page.locator('.ch-h1');
  const $h2 = page.locator('.ch-h2');

  for (let i = 0; i < state.bags.length; i++) {
    const bag = state.bags[i];
    await $card.click(); await $card.fill(bag);
    if (i === 0) {
      // the first piece came back stamped TWICE — two parts, two codes
      await $h1.fill(CODES[0]); await $h2.fill(CODES[1]);
    } else if (i === state.bags.length - 1) {
      // and the last one is stamped but the slip has not caught up
      await $h1.fill('PENDING');
    } else {
      await $h1.fill(CODES[i + 1]);
    }
    await wait(page, 700);
    await $h2.press('Enter');
    await wait(page, 2200);
    console.log(`  ${bag}: ${(await page.locator('.ch-msg').innerText()).trim().slice(0, 90)}`);
  }
  await wait(page, 1500);
  console.log('history  :', (await page.locator('.ch-hist').innerText()).replace(/\n/g, ' | ').slice(0, 160));
  console.log('board    :', (await page.locator('.ch-body').innerText()).replace(/\n/g, ' · ').slice(0, 110));
});
