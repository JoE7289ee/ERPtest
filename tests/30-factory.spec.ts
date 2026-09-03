// FACTORY SEEDER — fills a dev site with a working floor, through the real desk
// pages and as the real people who do each job. No API shortcuts: every card,
// gram and stone lands the way it does on the floor, so what this leaves behind
// can be issued, transferred, made into product and printed.
//
//   BASE_URL=http://development.localhost:8000 \
//   ERP_SID=<admin> REENA_SID=.. JOJO_SID=.. SHEEJA_SID=.. BALAN_SID=.. \
//   npx playwright test 30-factory --project=chromium
//
// Legs run in order, each as its actor; `--grep "2 "` runs one. State between
// legs lives in .factory/state.json. Knobs: BAGS (1000), BATCH (50), PER_BENCH (20).
//
// One-time prerequisites (server-side, see factory_setup.py): the user
// balan@jd.in with JW Stone Admin + Jewelima Purchase, and ONE Active Design
// carrying a Design Bank — the desk resolves a typed variant code through it.
import { test as base, expect, gotoApp, pickLink, typeInto, click, frappeCall } from './helpers/tutorial';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
const BAGS = parseInt(process.env.BAGS || '1000', 10);
const BATCH = parseInt(process.env.BATCH || '50', 10);
const PER_BENCH = parseInt(process.env.PER_BENCH || '20', 10);
const DESIGN = process.env.DESIGN || 'A13010NP-18EF-Y';
const PARTY = process.env.PARTY || 'AJ-KUR-TCR-KL';
const STATE = '.factory/state.json';

const test = base;
test.describe.configure({ mode: 'serial' });

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {});
const save = (patch: any) => fs.writeFileSync(STATE, JSON.stringify({ ...load(), ...patch }, null, 1));
const FAST = !!process.env.FAST;
const wait = (p: any, ms: number) => p.waitForTimeout(FAST ? Math.min(ms, 200) : ms);

/** become one of the actors: swap the session cookie, then land on the desk */
async function become(page: any, who: 'REENA' | 'JOJO' | 'SHEEJA' | 'BALAN') {
  const sid = process.env[`${who}_SID`];
  if (!sid) throw new Error(`${who}_SID is not set`);
  await page.context().clearCookies();
  await page.context().addCookies([{ name: 'sid', value: sid, url: BASE }]);
  await page.goto('/desk/jewelima');
  await page.waitForFunction(() => (window as any).frappe?.boot, undefined, { timeout: 30_000 });
  const me = await page.evaluate(() => (window as any).frappe.session.user);
  console.log(`— now ${who} (${me})`);
  return me;
}

// ---------------------------------------------------------------------------
test('1 REENA places the orders', async ({ page }) => {
  test.setTimeout(60_000 + Math.ceil(BAGS / BATCH) * 120_000);
  await become(page, 'REENA');
  const orders: string[] = [];
  let placed = 0;
  while (placed < BAGS) {
    const n = Math.min(BATCH, BAGS - placed);
    await gotoApp(page, 'place-order');
    await wait(page, 800);
    await pickLink(page, page.locator('.po-h-customer input'), PARTY);
    await pickLink(page, page.locator('.po-h-ordertype input'), 'CUSTOMER');
    await typeInto(page, page.locator('.po-h-days input'), '15');
    const row0 = page.locator('.po-grid tbody tr').first();
    await typeInto(page, row0.locator('input[data-fieldname="bank"]'), DESIGN);
    await expect.poll(async () => await page.evaluate(() =>
      ((document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim()),
      { timeout: 25_000 }).toBe(DESIGN);
    await row0.locator('input[type="number"]').first().fill(String(n));
    await wait(page, 400);
    await click(page, row0.locator('button:has-text("Split")'));
    const sdlg = page.locator('.modal:visible').last();
    await sdlg.waitFor({ state: 'visible', timeout: 10_000 });
    await wait(page, 500);
    await page.evaluate((k) => { const d = (window as any).cur_dialog; if (d) d.set_value('bags', k); }, n);
    await wait(page, 400);
    await sdlg.locator('.btn-primary:visible').first().click();
    await expect.poll(async () => await page.evaluate(() =>
      Array.from(document.querySelectorAll('.po-grid tbody tr'))
        .filter((r) => ((r.querySelector('input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim()).length),
      { timeout: 30_000 }).toBe(n);
    await wait(page, 800);
    const created = page.waitForResponse((r) => r.url().includes('create_job_order') && r.status() === 200, { timeout: 120_000 });
    await click(page, page.getByRole('button', { name: 'Place Order', exact: true }));
    const body = await (await created).json();
    const order = (typeof body?.message === 'string' ? body.message : body?.message?.name) || '';
    expect(order, 'the order must have been placed').toBeTruthy();
    // the bags land one by one after the header — wait for all of them
    await expect.poll(async () => await frappeCall(page, 'frappe.client.get_count',
      { doctype: 'Order Bag', filters: { job_order: order } }), { timeout: 120_000 }).toBe(n);
    orders.push(order);
    placed += n;
    console.log(`  order ${order}: ${n} bags  (${placed}/${BAGS})`);
  }
  save({ orders, design: DESIGN, bags: placed });
});

// ---------------------------------------------------------------------------
test('2 JOJO buys standard gold and alloy', async ({ page }) => {
  test.setTimeout(180_000);
  await become(page, 'JOJO');
  await gotoApp(page, 'purchase-raw-material');
  await wait(page, 900);
  const row = (i: number) => page.locator('.pr-body tr').nth(i);
  const itemBox = (i: number) => row(i).locator('.frappe-control input').first();
  const numBox = (i: number, n: number) => row(i).locator('input[type="number"]').nth(n);   // purity, qty, gram, carat
  const G999 = process.env.G999 || '6000';
  const ALLOY = process.env.ALLOY || '2500';
  await pickLink(page, itemBox(0), 'Standard Gold 999');
  await wait(page, 900);
  await typeInto(page, numBox(0, 2), G999);
  await wait(page, 900);
  await pickLink(page, itemBox(1), 'Alloy');
  await wait(page, 900);
  await typeInto(page, numBox(1, 2), ALLOY);
  await wait(page, 1200);
  const posted = page.waitForResponse((r) => r.url().includes('post_raw_material_purchase') && r.status() === 200, { timeout: 60_000 });
  await click(page, page.locator('.page-actions button:has-text("Post Purchase")').first());
  const body = await (await posted).json();
  console.log('  gold purchase:', JSON.stringify(body?.message));
  expect(body?.message?.name, 'the gold purchase must have posted').toBeTruthy();
  const q999 = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Bin', filters: { item_code: 'Standard Gold 999', warehouse: 'Gold Issue - JD' }, fieldname: 'actual_qty' });
  const qAl = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Bin', filters: { item_code: 'Alloy', warehouse: 'Gold Issue - JD' }, fieldname: 'actual_qty' });
  console.log(`  Gold Issue now: 999 = ${q999?.actual_qty} g, Alloy = ${qAl?.actual_qty} g`);
  expect(Number(q999?.actual_qty)).toBeGreaterThanOrEqual(Number(G999));
  save({ purchase: body.message.name });
});

// ---------------------------------------------------------------------------
test('2b JOJO buys the stones the design needs', async ({ page }) => {
  // Balan runs the stone room but does not buy — stones come in through the
  // same purchase desk as gold, so this is Jojo's. A separate sheet, because
  // the warehouse is decided by the FIRST line and stones go to Stone Issue.
  test.setTimeout(180_000);
  await become(page, 'JOJO');
  const st = load();
  const bags = Number(st.bags || BAGS);
  const STONES: Array<[string, number, number]> = [['VVS-EF 2-2.5', 12, 0.108], ['VVS-EF 3-3.5', 6, 0.066]];
  await gotoApp(page, 'purchase-raw-material');
  await wait(page, 900);
  const row = (i: number) => page.locator('.pr-body tr').nth(i);
  const itemBox = (i: number) => row(i).locator('.frappe-control input').first();
  const numBox = (i: number, n: number) => row(i).locator('input[type="number"]').nth(n);
  for (let i = 0; i < STONES.length; i++) {
    const [item, pcs, ct] = STONES[i];
    const needPcs = Math.ceil(pcs * bags * 1.15), needCt = +(ct * bags * 1.15).toFixed(3);
    await pickLink(page, itemBox(i), item);
    await wait(page, 900);
    await typeInto(page, numBox(i, 3), String(needCt));   // carats
    await wait(page, 500);
    await typeInto(page, numBox(i, 1), String(needPcs));  // pieces
    await wait(page, 900);
    console.log(`  ${item}: ${needPcs} pcs / ${needCt} ct for ${bags} bags (+15%)`);
  }
  const posted = page.waitForResponse((r) => r.url().includes('post_raw_material_purchase') && r.status() === 200, { timeout: 60_000 });
  await click(page, page.locator('.page-actions button:has-text("Post Purchase")').first());
  const body = await (await posted).json();
  expect(body?.message?.name, 'the stone purchase must have posted').toBeTruthy();
  for (const [item] of STONES) {
    const q = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Bin', filters: { item_code: item, warehouse: 'Stone Issue - JD' }, fieldname: 'actual_qty' });
    console.log(`  Stone Issue now: ${item} = ${q?.actual_qty} ct`);
  }
  save({ stone_purchase: body.message.name, stones: STONES });
});

// ---------------------------------------------------------------------------
test('3 JOJO melts every karat and sends it to Casting', async ({ page }) => {
  test.setTimeout(300_000);
  await become(page, 'JOJO');
  const KARATS = (process.env.KARATS || '18KYG,18KWG,18KPG,22KYG').split(',');
  const GRAMS = process.env.MELT_G || '400';
  const done: string[] = [];
  for (const k of KARATS) {
    await gotoApp(page, 'melt-gold');
    await wait(page, 1500);                    // the warehouse defaults itself and the shelf loads
    await pickLink(page, page.locator('.ml-out input'), k);
    await wait(page, 600);
    await typeInto(page, page.locator('.ml-req input'), GRAMS);
    await wait(page, 600);
    // tick the two sources; the solver splits them to the target purity
    await page.locator('.ml-stock-cb[data-item="Standard Gold 999"]').check();
    await wait(page, 500);
    await page.locator('.ml-stock-cb[data-item="Alloy"]').check();
    await wait(page, 900);
    const cur = await page.locator('.ml-cur').innerText();
    const exp = await page.locator('.ml-exp').innerText();
    const warn = (await page.locator('.ml-warn').innerText()).trim();
    console.log(`  ${k}: blend ${cur} vs target ${exp}${warn ? ' | ' + warn : ''}`);
    const melted = page.waitForResponse((r) => r.url().includes('melt_gold') && r.status() === 200, { timeout: 60_000 });
    await click(page, page.locator('.page-actions button:has-text("Melt and Send to Casting")').first());
    const body = await (await melted).json();
    const m = body?.message || {};
    expect(m.name, `${k} must have melted`).toBeTruthy();
    console.log(`  ${k}: ${m.total_in} g in -> ${m.output} g out, loss ${m.loss}, casting transfer ${m.casting_transfer || '-'}`);
    done.push(k);
    // the success msgprint sits over the page — close it before the next round
    await page.locator('.modal:visible .btn-modal-close, .modal:visible button:has-text("Close")').first().click({ timeout: 5000 }).catch(() => {});
    await wait(page, 600);
  }
  save({ melted: done });
});

// ===========================================================================
// shared bits for the floor legs
// REWORK is not here on purpose: the transfer rules never offer it from ORDERING —
// a card reaches REWORK only by being sent back off a finished piece.
const BENCHES = (process.env.BENCHES || 'CAD,CAM,WAXING,WAX SETTING,TREE MAKING,CASTING,GRINDING,FILING,SETTING,PRE POLISH,FINAL POLISH,BAG EXTRACTION').split(',');
const WEIGHT_BENCHES = ['GRINDING', 'FILING', 'SETTING', 'PRE POLISH', 'FINAL POLISH'];
const LIGHT_BENCHES = ['CAD', 'WAXING', 'WAX SETTING'];
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const bagsAt = (page: any, location: string, limit: number, design?: string) => frappeCall<any[]>(page, 'frappe.client.get_list', {
  doctype: 'Order Bag', filters: { location, is_finished: 0, stock_status: 'In Production', ...(design ? { design } : {}) },
  fields: ['name'], limit_page_length: limit, order_by: 'name asc',
}).then((r) => (r || []).map((x) => x.name));

/** the first employee on a bench's roster (the pickers filter to it), else anyone active */
async function rosterName(page: any, bench: string) {
  const b = await frappeCall<any>(page, 'frappe.client.get', { doctype: 'Bench', name: bench });
  const emp = ((b && b.employees) || [])[0]?.employee;
  const nm = emp
    ? await frappeCall<any>(page, 'frappe.client.get_value', { doctype: 'Employee', filters: { name: emp }, fieldname: 'employee_name' })
    : await frappeCall<any>(page, 'frappe.client.get_value', { doctype: 'Employee', filters: { status: 'Active' }, fieldname: 'employee_name' });
  return nm?.employee_name as string;
}
const freezeGone = (page: any, ms = 90_000) => expect(page.locator('#freeze')).toBeHidden({ timeout: ms });
/** scan codes into a batch page until `want` rows are in; a refused scan (err bar) is skipped */
async function scanBatch(page: any, scanSel: string, rowSel: string, errSel: string, codes: string[], want: number) {
  const scan = page.locator(scanSel);
  const rows = page.locator(rowSel);
  const taken: string[] = [];
  for (const code of codes) {
    if (taken.length >= want) break;
    const before = await rows.count();
    await scan.click(); await scan.fill(code); await scan.press('Enter');
    const ok = await Promise.race([
      expect(rows).toHaveCount(before + 1, { timeout: 12_000 }).then(() => true).catch(() => false),
      page.locator(errSel).waitFor({ state: 'visible', timeout: 12_000 }).then(() => false).catch(() => false),
    ]);
    if (ok && (await rows.count()) === before + 1) taken.push(code);
    else console.log(`    skip ${code}: ${((await page.locator(errSel).innerText().catch(() => '')) || 'refused').trim().slice(0, 70)}`);
    await wait(page, 150);
  }
  return taken;
}
const closeModals = async (page: any) => {
  for (let i = 0; i < 3; i++) {
    const m = page.locator('.modal.show');
    if (!(await m.count())) break;
    await m.last().locator('.btn-modal-close, button:has-text("Close")').first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
    await wait(page, 400);
  }
};

// ---------------------------------------------------------------------------
test('4 SHEEJA transfers cards onto every bench', async ({ page }) => {
  test.setTimeout(120_000 + BENCHES.length * PER_BENCH * 4_000);
  await become(page, 'SHEEJA');
  const pool = await bagsAt(page, 'ORDERING', BENCHES.length * PER_BENCH + 50);
  expect(pool.length, `need ${BENCHES.length * PER_BENCH} cards in ORDERING, have ${pool.length}`).toBeGreaterThanOrEqual(BENCHES.length * PER_BENCH);
  let i = 0;
  const placed: Record<string, string[]> = {};
  for (const bench of BENCHES) {
    const mine = pool.slice(i, i + PER_BENCH); i += PER_BENCH;
    placed[bench] = mine;
    // the page's freeze overlay sticks past 30 bags, so every batch gets a fresh load
    for (const part of chunk(mine, 20)) {
      await gotoApp(page, 'transfer-order-bag');
      const scan = page.locator('#page-transfer-order-bag .tob-scan input');
      await scan.waitFor({ state: 'visible', timeout: 15_000 });
      for (let k = 0; k < part.length; k++) {
        await scan.click(); await scan.fill(part[k]); await scan.press('Enter');
        await expect(page.locator('#page-transfer-order-bag .tob-body tr')).toHaveCount(k + 1, { timeout: 15_000 });
      }
      const sel = page.locator('#page-transfer-order-bag .tob-to select');
      const opt = page.locator(`#page-transfer-order-bag .tob-to select option[value="${bench}"]`);
      const offered = await opt.waitFor({ state: 'attached', timeout: 15_000 }).then(() => true).catch(() => false);
      if (!offered) {
        console.log(`  ${bench.padEnd(14)} not offered from ORDERING by the transfer rules — skipped`);
        placed[bench] = [];
        break;
      }
      await sel.selectOption(bench);
      await page.locator('#page-transfer-order-bag .page-actions .primary-action').click();
      await freezeGone(page);
      await expect(page.locator('#alert-container .desk-alert.green .alert-message').last())
        .toContainText(/Transferred \d+ bag/, { timeout: 15_000 });
      await closeModals(page);
    }
    console.log(`  ${bench.padEnd(14)} ← ${mine.length} cards`);
  }
  save({ placed });
});

// ---------------------------------------------------------------------------
test('5 SHEEJA issues work at the benches', async ({ page }) => {
  const N = parseInt(process.env.ISSUE_N || '10', 10);
  test.setTimeout(120_000 + (WEIGHT_BENCHES.length + LIGHT_BENCHES.length) * N * 3_000);
  await become(page, 'SHEEJA');
  const issued: Record<string, number> = {};

  // weight benches book gold: Job Work, to a rostered employee
  for (const bench of WEIGHT_BENCHES) {
    const cands = await bagsAt(page, bench, N + 8);
    if (!cands.length) { console.log(`  ${bench}: nothing there`); continue; }
    const who = await rosterName(page, bench);
    await gotoApp(page, 'job-work');
    const cards = await scanBatch(page, '#page-job-work .jw-scan input', '#page-job-work .jw-body tr', '#page-job-work .jw-msg.err', cands, N);
    if (!cards.length) { console.log(`  ${bench}: every card refused`); continue; }
    await pickLink(page, page.locator('#page-job-work .jw-emp input'), who);
    await page.locator('#page-job-work .jw-actions button:has-text("Issue")').click();
    await freezeGone(page);
    await expect(page.locator('#alert-container .desk-alert.green .alert-message').last()).toContainText(/Issued \d+ card/, { timeout: 15_000 });
    await closeModals(page);
    issued[bench] = cards.length;
    console.log(`  ${bench.padEnd(14)} issued ${cards.length} → ${who}`);
  }

  // light benches assign: Assign / Collect
  for (const bench of LIGHT_BENCHES) {
    const cands = await bagsAt(page, bench, N + 8);
    if (!cands.length) { console.log(`  ${bench}: nothing there`); continue; }
    const who = await rosterName(page, bench);
    await gotoApp(page, 'assign-collect');
    const cards = await scanBatch(page, '.ac-scan input', '.ac-body tr', '.ac-msg.err', cands, N);
    if (!cards.length) { console.log(`  ${bench}: every card refused`); continue; }
    await pickLink(page, page.locator('.ac-emp input'), who);
    await page.locator('.ac-actions button:has-text("Assign")').click();
    await freezeGone(page);
    await expect(page.locator('#alert-container .desk-alert.green .alert-message').last()).toContainText(/Assigned \d+ card/, { timeout: 15_000 });
    await closeModals(page);
    issued[bench] = cards.length;
    console.log(`  ${bench.padEnd(14)} assigned ${cards.length} → ${who}`);
  }
  save({ issued });
});

// ---------------------------------------------------------------------------
test('6 BALAN marks cards for stone issue', async ({ page }) => {
  const N = parseInt(process.env.STONE_N || '30', 10);
  test.setTimeout(120_000 + N * 2_000);
  await become(page, 'BALAN');
  // stones go on at the setting benches; take un-issued cards so nothing is locked
  const st = load();
  const design = st.design || DESIGN;
  const cards = [...await bagsAt(page, 'SETTING', N, design), ...await bagsAt(page, 'WAX SETTING', N, design)].slice(0, N);
  expect(cards.length, 'need cards at SETTING / WAX SETTING').toBeGreaterThan(0);
  await gotoApp(page, 'stone-request');
  const scan = page.locator('#page-stone-request input[data-fieldname="scan"]');
  await scan.waitFor({ state: 'visible', timeout: 15_000 });
  let added = 0;
  for (const c of cards) {
    await scan.click(); await scan.fill(c); await scan.press('Enter');
    await wait(page, 700);
    added = await page.locator('#page-stone-request .sq-t tbody tr').count();
  }
  console.log(`  ${added} of ${cards.length} on the list`);
  await page.locator('#page-stone-request .sq-go').click();
  await expect(page.locator('#alert-container .desk-alert.green .alert-message').last()).toContainText(/marked/, { timeout: 20_000 });
  await closeModals(page);
  save({ stone_cards: cards });
});

// ---------------------------------------------------------------------------
test('7 BALAN issues the stones', async ({ page }) => {
  const st = load();
  const cards: string[] = st.stone_cards || [];
  test.setTimeout(120_000 + cards.length * 25_000);
  await become(page, 'BALAN');
  await gotoApp(page, 'stone-issue');
  await wait(page, 1500);                      // the station sets Balan as the issuer on load
  let done = 0;
  for (const c of cards) {
    const scan = page.locator('#page-stone-issue .si-scan-box input[data-fieldname="scan"]');
    await scan.click(); await scan.fill(c); await scan.press('Enter');
    const head = page.locator('#page-stone-issue .si-head');
    const callout = page.locator('#page-stone-issue .si-callout:visible');
    await Promise.race([head.waitFor({ state: 'visible', timeout: 15_000 }), callout.waitFor({ state: 'visible', timeout: 15_000 })]);
    if (await callout.count()) { console.log(`  ${c}: ${(await callout.innerText()).trim().slice(0, 80)}`); continue; }
    // each line: plan 'pcs / ct' in the 2nd cell, issued so far in the 3rd — fill the remainder
    const rows = page.locator('#page-stone-issue table.si-grid tbody tr[data-i]');
    const nrows = await rows.count();
    for (let r = 0; r < nrows; r++) {
      const row = rows.nth(r);
      if ((await row.getAttribute('class') || '').includes('si-locked')) continue;
      const num = async (i: number) => ((await row.locator(`td:nth-child(${i})`).innerText()).split('/').map((x) => parseFloat(x) || 0));
      const [ppcs, pct] = await num(2);
      const [ipcs, ict] = await num(3);
      const pcs = Math.max(ppcs - ipcs, 0), ct = Math.max(pct - ict, 0);
      if (pcs <= 0 || ct <= 0) continue;
      await row.locator('input.si-pcs').fill(String(pcs));
      await row.locator('input.si-ct').fill(ct.toFixed(3));
    }
    const go = page.locator('#page-stone-issue .si-strip button.si-go');
    await go.waitFor({ state: 'visible', timeout: 10_000 });
    await go.click();
    await freezeGone(page, 45_000);
    if (await page.locator('.modal.show').count()) {
      console.log(`  ${c}: ${(await page.locator('.modal.show .modal-body').innerText()).trim().slice(0, 100)}`);
      await closeModals(page);
      await page.locator('#page-stone-issue button.si-clear').click().catch(() => {});
      continue;
    }
    done++;
  }
  console.log(`  stones issued onto ${done} of ${cards.length} cards`);
  expect(done).toBeGreaterThan(0);
  save({ stones_issued: done });
});

// ---------------------------------------------------------------------------
test('8 SHEEJA makes a tree and books the cast weights', async ({ page }) => {
  const TREE_N = parseInt(process.env.TREE_N || '20', 10);
  const GROSS = process.env.GROSS || '2.550';
  test.setTimeout(240_000 + TREE_N * 6_000);
  await become(page, 'SHEEJA');

  // ---- the tree
  await gotoApp(page, 'make-tree');
  const col = page.locator('#page-make-tree .tm-col').filter({ has: page.locator('.tm-title', { hasText: '18KYG' }) }).first();
  await col.waitFor({ state: 'visible', timeout: 20_000 });
  const design = load().design || DESIGN;
  const mine = col.locator('.tm-chip', { hasText: design });
  const chips = (await mine.count()) ? mine : col.locator('.tm-chip');
  const n = Math.min(await chips.count(), TREE_N);
  expect(n, 'need 18KYG cards at TREE MAKING').toBeGreaterThan(0);
  const bags: string[] = [];
  for (let k = 0; k < n; k++) {
    const chip = chips.nth(k);
    bags.push((await chip.getAttribute('data-name')) || '');
    await chip.click();
  }
  await page.locator('#page-make-tree button.tm-make').click();
  const dlg = page.locator('.modal.show').last();
  await dlg.waitFor({ state: 'visible', timeout: 10_000 });
  await pickLink(page, dlg.locator('[data-fieldname="employee"] input'), await rosterName(page, 'TREE MAKING'));
  await dlg.locator('[data-fieldname="wax_weight"] input').fill(String(3 + n * 0.35));
  await page.keyboard.press('Tab');
  await dlg.locator('.modal-footer .btn-primary').first().click();
  await freezeGone(page);
  const toast = page.locator('#alert-container .desk-alert.green .alert-message').last();
  await expect(toast).toContainText(/made — \d+ card/, { timeout: 20_000 });
  const tree = ((await toast.innerText()).match(/T-[A-Z0-9]+-\d+/) || [''])[0];
  console.log(`  tree ${tree}: ${n} cards → CASTING`);
  await closeModals(page);

  // ---- the weights: casting-weigh writes gold onto each card
  await gotoApp(page, 'casting-weigh');
  const cw = page.locator('#page-casting-weigh input.cw-scan');
  await cw.waitFor({ state: 'visible', timeout: 15_000 });
  await cw.fill(bags[0]); await cw.press('Enter');
  await page.locator(`#page-casting-weigh .cw-sel input.cw-gross[data-bag="${bags[0]}"]`).waitFor({ state: 'visible', timeout: 20_000 });
  let booked = 0;
  for (const part of chunk(bags, 20)) {
    let inBatch = 0;
    for (const b of part) {
      const add = page.locator(`#page-casting-weigh .cw-pool button.cw-add[data-bag="${b}"]`);
      if (await add.count()) { await add.click(); await wait(page, 150); }
      const gross = page.locator(`#page-casting-weigh .cw-sel input.cw-gross[data-bag="${b}"]`);
      if (!(await gross.count())) { console.log(`    ${b}: nothing to weigh (already cast)`); continue; }
      await gross.fill(GROSS);
      inBatch++;
    }
    if (!inBatch) continue;
    await page.locator('#page-casting-weigh .page-actions button.primary-action:has-text("Book Weights")').click();
    await freezeGone(page);
    await expect(page.locator('#alert-container .desk-alert.green .alert-message').last()).toContainText(/Booked/, { timeout: 20_000 });
    await closeModals(page);            // 'Tree cast' when the last card is weighed
    booked += inBatch;
  }
  console.log(`  booked ${GROSS} g on ${booked} cards of ${tree}`);
  save({ tree, weighed: booked });
});
