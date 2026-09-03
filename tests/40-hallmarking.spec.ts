// The whole hallmarking round trip, driven as the person who does it.
//
// JISMY holds JW Delivery, which is exactly what the four hallmarking desks
// need, so this runs as her end to end: pick the pieces out of a bucket, prep
// the batch, download the sheet that travels with the packet, send it, take it
// back, and type the codes that came back stamped on the pieces.
//
//   BASE_URL=... ERP_SID=<jismy> npx playwright test 40-hallmarking --project=chromium
//
// Recorded at 1280x800 by the shared config, so it doubles as the walkthrough.
//
// AGAINST PROD IT WRITES REAL HUIDS ONTO REAL STOCK. Snapshot first and restore
// after unless the pieces are throwaway.
import { test, expect } from '@playwright/test';

const CENTRE = process.env.CENTRE || 'KERALA';
const BUCKET = process.env.BUCKET || 'FEMI';
const TAKE = parseInt(process.env.TAKE || '3', 10);
// deliberately obvious codes — a real one is issued by the centre
const CODES = ['ZZ1001', 'ZZ1002', 'ZZ1003', 'ZZ1004'];

test.describe.configure({ mode: 'serial' });
const wait = (p: any, ms: number) => p.waitForTimeout(ms);
const state: any = { batch: '', bags: [] };

async function open(page: any, route: string) {
  await page.goto('/desk/' + route);
  await page.waitForFunction(() => (window as any).frappe?.boot, undefined, { timeout: 45000 });
  await page.locator('#page-' + route).waitFor({ state: 'visible', timeout: 30000 });
  await wait(page, 1800);
}

test('1 JISMY picks the pieces and preps the batch', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/app');
  await page.waitForFunction(() => (window as any).frappe?.boot, undefined, { timeout: 45000 });
  console.log('acting as:', await page.evaluate(() => (window as any).frappe.session.user));

  await open(page, 'hallmark');
  await page.locator('.hm-center').selectOption({ label: CENTRE });
  await wait(page, 900);

  await page.locator('.hm-pick').click();
  const d = page.locator('.modal:visible').last();
  await d.waitFor({ state: 'visible', timeout: 15000 });
  await wait(page, 2500);
  console.log('picker    :', (await d.locator('.hp-count').innerText()).trim());
  await d.locator('.hp-f[data-f="bucket"]').selectOption(BUCKET);
  await wait(page, 2500);
  console.log(`in ${BUCKET}   :`, (await d.locator('.hp-count').innerText()).trim());

  const boxes = d.locator('.hp-body input:not([disabled])');
  const n = Math.min(await boxes.count(), TAKE);
  for (let i = 0; i < n; i++) { await boxes.nth(i).check(); await wait(page, 300); }
  state.bags = await d.locator('.hp-body tr').evaluateAll((rows: any[]) =>
    rows.filter((r) => (r.querySelector('input') as HTMLInputElement)?.checked)
        .map((r) => r.querySelector('td:nth-child(2)')!.textContent!.trim()));
  console.log('ticked    :', JSON.stringify(state.bags));
  await d.locator('.modal-footer .btn-primary').click();
  await wait(page, 4000);
  console.log('on batch  :', (await page.locator('.hm-tot').innerText()).replace(/\n/g, ' · '));

  const prepped = page.waitForResponse((r) => r.url().includes('hall_prep_create') && r.status() === 200, { timeout: 90_000 });
  await page.locator('.hm-go:not(.hm-gosend)').click();
  state.batch = ((await (await prepped).json())?.message || {}).name;
  console.log('PREPPED   :', state.batch);
  expect(state.batch, 'the batch must have prepped').toBeTruthy();
  await wait(page, 2500);
});

test('2 she downloads the sheet, then sends the packet', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 'send-hallmarking');
  const card = page.locator(`.sh-card[data-name="${state.batch}"]`);
  await card.waitFor({ state: 'visible', timeout: 20000 });
  console.log('prepared  :', (await card.innerText()).replace(/\n/g, ' · '));

  // the sheet that travels with the packet
  const dl = page.waitForEvent('download', { timeout: 60_000 });
  await card.locator('.sh-xls').click();
  const file = await dl;
  console.log('SHEET     :', file.suggestedFilename());
  await wait(page, 2000);

  const sent = page.waitForResponse((r) => r.url().includes('send_hall_prep') && r.status() === 200, { timeout: 90_000 });
  await card.locator('.sh-send').click();
  const dlg = page.locator('.modal:visible').last();
  await dlg.waitFor({ state: 'visible', timeout: 10000 });
  await wait(page, 1200);
  await dlg.locator('.btn-modal-primary, .btn-primary').first().click();
  console.log('SENT      :', JSON.stringify((await (await sent).json())?.message));
  await wait(page, 2500);
});

test('3 the packet comes back and she collects it', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 'hallmark-out');
  const card = page.locator(`.ho-card[data-name="${state.batch}"]`);
  await card.waitFor({ state: 'visible', timeout: 20000 });
  console.log('out board :', (await card.innerText()).replace(/\n/g, ' · '));
  const got = page.waitForResponse((r) => r.url().includes('collect_hallmarking') && r.status() === 200, { timeout: 90_000 });
  await card.locator('.ho-collect').click();
  const dlg = page.locator('.modal:visible').last();
  await dlg.waitFor({ state: 'visible', timeout: 10000 });
  await wait(page, 1200);
  await dlg.locator('.btn-modal-primary, .btn-primary').first().click();
  console.log('COLLECTED :', JSON.stringify((await (await got).json())?.message));
  await wait(page, 2500);
});

test('4 she types the codes — one box, card then code', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, 'confirm-huid');
  const $s = page.locator('.ch-card input');
  const held = async () => (await page.locator('.ch-held').innerText()).replace(/\n/g, ' ').trim();
  const say = async () => (await page.locator('.ch-msg').innerText()).trim();
  const scan = async (v: string) => { await $s.click(); await $s.fill(v); await $s.press('Enter'); await wait(page, 1600); };

  console.log('waiting   :', (await page.locator('.ch-body').innerText()).replace(/\n/g, ' · ').slice(0, 110));

  // the first piece came back stamped in TWO parts
  await scan(state.bags[0]);
  console.log(`  ${state.bags[0]}: ${await say()}`);
  await scan(CODES[0]); await scan(CODES[1]);
  console.log('  held    :', await held());

  // the next card saves the one before it
  await scan(state.bags[1]);
  console.log(`  ${state.bags[1]}: ${await say()}`);
  await scan(CODES[2]);

  // the last came back stamped but the slip has not caught up
  await scan(state.bags[2]);
  await scan('PENDING');
  console.log('  held    :', await held());
  await $s.press('Enter');            // empty Enter saves the last of the run
  await wait(page, 2500);
  console.log('after     :', await say(), '| held:', JSON.stringify(await held()));
  console.log('history   :', (await page.locator('.ch-hist').innerText()).replace(/\n/g, ' | ').slice(0, 180));
  console.log('board     :', (await page.locator('.ch-body').innerText()).replace(/\n/g, ' · ').slice(0, 100));
});
