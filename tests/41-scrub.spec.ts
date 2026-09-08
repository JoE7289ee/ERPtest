// 41 — SCRUB: collecting metal at receipt instead of writing it off.
//
// Scrub is the third outcome of a bench receipt. The piece comes back
// (weight in), some metal is HANDED BACK as filings (scrub), and only what is
// left is loss:
//
//     weight out = weight in + scrub + loss
//
// Loss is written off to a '<bench> -LOSS' warehouse. Scrub goes to the Scrub
// warehouse and is still ours, waiting to be refined. So the thing worth
// proving is not that a number appears — it is that the gold ENDS UP in the
// right two places and the identity above holds.
//
// This drives the real desk. It issues a card, receipts it with scrub, and then
// reads the warehouses back. Nothing is mocked.
//
//   BASE_URL=http://development.localhost:8000 ERP_SID=$(sid <user>) \
//     npx playwright test 41-scrub --project=chromium --reporter=list

import { expect } from '@playwright/test';
import { test, gotoApp, frappeCall, click, typeInto, pickLink, say } from './helpers/tutorial';

const JW = '#page-job-work';
const BENCHES = ['SETTING', 'FILING', 'GRINDING', 'PRE POLISH', 'FINAL POLISH'];

// What the collection warehouses hold, read through the app's OWN endpoints.
// A raw Stock Ledger Entry listing is the obvious way and the wrong one — it is
// paged and permission-filtered, so two snapshots came back identically
// truncated and every delta measured zero. These two calls are what the desk
// itself reads, which is also the thing worth testing.
async function held(page: any) {
  const board = await frappeCall<any>(page, 'jewelima.jewelima.api.get_scrub_board', {});
  const ctx = await frappeCall<any>(page, 'jewelima.jewelima.api.get_weight_transfer_context', {});
  const loss: Record<string, number> = {};
  for (const src of ctx.sources || []) loss[src.warehouse] = Number(src.total || 0);
  return { scrub: Number(board.total_held || 0), collected: Number(board.collected || 0), loss };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// A card already OUT with someone at a Job Work bench. This is the normal state
// of a working floor — over a hundred of them here — and receipting is what the
// spec is about, so it beats insisting on issuing a fresh one.
async function issuedCard(page: any) {
  const open = await frappeCall<any>(page, 'frappe.client.get_list', {
    doctype: 'Bench Issue',
    filters: JSON.stringify([
      ['status', '=', 'Issued'],
      ['bench', 'in', BENCHES],
      ['weight_out', '>=', 2],          // room for 1 g of scrub + loss
      ['employee', 'is', 'set'],        // a receipt goes back under the issuing name
    ]),
    fields: JSON.stringify(['name', 'order_bag', 'bench', 'weight_out', 'employee']),
    order_by: 'weight_out desc',
    limit_page_length: 5,
  });
  return (open || [])[0] || null;
}

// a card standing at a Job Work bench with no open issue, plus its gold item
async function freeCard(page: any) {
  for (const bench of BENCHES) {
    const rows = await frappeCall<any>(page, 'frappe.client.get_list', {
      doctype: 'Order Bag',
      filters: JSON.stringify([
        ['stock_status', '=', 'In Production'],
        ['location', '=', bench],
        ['act_gross_weight', '>', 2],
      ]),
      fields: JSON.stringify(['name', 'location', 'act_gross_weight']),
      limit_page_length: 40,
    });
    for (const r of rows || []) {
      const open = await frappeCall<any>(page, 'frappe.client.get_list', {
        doctype: 'Bench Issue',
        filters: JSON.stringify([['order_bag', '=', r.name], ['status', '=', 'Issued']]),
        fields: JSON.stringify(['name']),
        limit_page_length: 1,
      });
      if (!(open || []).length) return r;
    }
  }
  return null;
}

async function rosterFor(page: any, bench: string) {
  const b = await frappeCall<any>(page, 'frappe.client.get', { doctype: 'Bench', name: bench });
  const emp = (b?.employees || [])[0];
  if (!emp) return null;
  const e = await frappeCall<any>(page, 'frappe.client.get', { doctype: 'Employee', name: emp.employee });
  return { id: emp.employee, name: e?.employee_name || emp.employee };
}

test.describe.configure({ mode: 'serial' });

// carried between the tests in this file
const S: any = { card: null, bench: '', emp: null, item: '', wout: 0, win: 0, scrub: 0.6 };

test('1 the Scrub button belongs to Receipt only', async ({ page }) => {
  await gotoApp(page, 'job-work');
  await say(page, 'Scrub is something a bench <b>hands back</b> — so it only exists on the way IN.');

  await click(page, page.locator(`${JW} .jw-tab[data-mode="issue"]`), 'Issue: nothing to hand back yet');
  await expect(page.locator(`${JW} .jw-scrubbtn`)).toBeHidden();

  await click(page, page.locator(`${JW} .jw-tab[data-mode="receipt"]`), 'Receipt: now it appears');
  await expect(page.locator(`${JW} .jw-scrubbtn`)).toBeVisible();
  await expect(page.locator(`${JW} .jw-scrubbtn`)).toHaveText(/Scrub/);
});

test('2 issue a card, receipt it with scrub, and follow the metal', async ({ page }) => {
  test.setTimeout(180_000);
  await gotoApp(page, 'job-work');            // frappeCall runs IN the page

  const already = await issuedCard(page);
  const card = already ? null : await freeCard(page);
  test.skip(!already && !card, 'no card at a Job Work bench to work with');

  if (already) {
    S.card = already.order_bag;
    S.bench = already.bench;
    S.wout = Number(already.weight_out);
    const e = await frappeCall<any>(page, 'frappe.client.get',
      { doctype: 'Employee', name: already.employee });
    S.emp = { id: already.employee, name: e?.employee_name || already.employee };
    console.log(`  using the open issue on ${S.card} at ${S.bench} (out ${S.wout} g)`);
  } else {
    S.card = card.name;
    S.bench = card.location;
    S.emp = await rosterFor(page, card.location);
    test.skip(!S.emp, `nobody rostered at ${card.location}`);
  }

  // ---- issue it, only when we had to ----
  if (!already) {
  await click(page, page.locator(`${JW} .jw-tab[data-mode="issue"]`));
  await typeInto(page, page.locator(`${JW} .jw-scan input`), S.card, `issue ${S.card}`);
  await page.locator(`${JW} .jw-scan input`).press('Enter');
  await expect(page.locator(`${JW} .jw-body tr`)).toHaveCount(1, { timeout: 15_000 });
  // the suite's own Link picker — it waits for the awesomplete list properly
  await pickLink(page, page.locator(`${JW} .jw-emp input`), S.emp.name, `to ${S.emp.name}`);
  await click(page, page.locator(`${JW} .jw-actions button:has-text("Issue")`), 'Issue');
  await expect(page.locator('#alert-container .desk-alert.green .alert-message').last())
    .toContainText(/Issued \d+ card/, { timeout: 20_000 });

    const iss = await frappeCall<any>(page, 'frappe.client.get_list', {
      doctype: 'Bench Issue',
      filters: JSON.stringify([['order_bag', '=', S.card], ['status', '=', 'Issued']]),
      fields: JSON.stringify(['name', 'weight_out']),
      limit_page_length: 1,
    });
    S.wout = Number(iss[0].weight_out);
  }
  S.win = round3(S.wout - 1.0);          // 1 g unaccounted: 0.6 scrub + 0.4 loss
  const conv = await frappeCall<any>(page, 'jewelima.jewelima.api.get_bag_contents', { order_bag: S.card });
  S.item = (conv.items || []).find((i: any) => /K(YG|WG|PG)$/.test(i.item))?.item || '';
  expect(S.item, 'the card must resolve a gold item').not.toBe('');
  console.log(`  ${S.card} at ${S.bench}: out ${S.wout} g, gold ${S.item}, to ${S.emp.name}`);

  // ---- receipt it: the live maths ----
  await gotoApp(page, 'job-work');
  await click(page, page.locator(`${JW} .jw-tab[data-mode="receipt"]`));
  await expect(page.locator(`${JW} .jw-scrubbtn`)).toBeVisible();
  await typeInto(page, page.locator(`${JW} .jw-scan input`), S.card, `receipt ${S.card}`);
  await page.locator(`${JW} .jw-scan input`).press('Enter');
  await expect(page.locator(`${JW} .jw-body tr`)).toHaveCount(1, { timeout: 15_000 });

  await page.locator(`${JW} .jw-win`).fill(String(S.win));
  await page.locator(`${JW} .jw-win`).dispatchEvent('input');
  await expect(page.locator(`${JW} .jw-losscell`)).toHaveText(/1\.000/);
  await say(page, 'Without scrub the whole <b>1.000 g</b> is written off.');

  await click(page, page.locator(`${JW} .jw-scrubbtn`), 'turn the Scrub column on');
  await expect(page.locator(`${JW} .jw-scrub`)).toBeVisible();
  await page.locator(`${JW} .jw-scrub`).fill(String(S.scrub));
  await page.locator(`${JW} .jw-scrub`).dispatchEvent('input');
  await expect(page.locator(`${JW} .jw-losscell`)).toHaveText(/0\.400/);
  await expect(page.locator(`${JW} .jw-total`)).toContainText('0.600');
  await say(page, 'Scrub <b>0.600</b> — loss falls to <b>0.400</b>. Nothing saved yet.');

  // ---- turning it off must clear the figures with it ----
  await click(page, page.locator(`${JW} .jw-scrubbtn`), 'off again');
  await expect(page.locator(`${JW} .jw-scrub`)).toHaveCount(0);
  await expect(page.locator(`${JW} .jw-losscell`)).toHaveText(/1\.000/);
  await expect(page.locator(`${JW} .jw-total`)).not.toContainText(/scrub/i);
  await click(page, page.locator(`${JW} .jw-scrubbtn`), 'and back on — it must be EMPTY');
  await expect(page.locator(`${JW} .jw-scrub`)).toHaveValue('');
  await expect(page.locator(`${JW} .jw-losscell`)).toHaveText(/1\.000/);
  await page.locator(`${JW} .jw-scrub`).fill(String(S.scrub));
  await page.locator(`${JW} .jw-scrub`).dispatchEvent('input');
  await expect(page.locator(`${JW} .jw-losscell`)).toHaveText(/0\.400/);

  // ---- save, and follow the gold ----
  const before = await held(page);
  const lossWh = Object.keys(before.loss).find((w) =>
    / -LOSS - /i.test(w) && w.toUpperCase().startsWith(S.bench.split(' ')[0].toUpperCase()));

  await click(page, page.locator(`${JW} .jw-actions button:has-text("Receipt")`), 'Receipt');
  const dlg = page.locator('.modal.show');
  if (await dlg.count()) {
    await expect(dlg).toContainText(/scrub|loss/i);
    await dlg.locator('.btn-primary:visible').first().click();
  }
  await expect(page.locator('#alert-container .desk-alert.green .alert-message').last())
    .toContainText(/Received \d+ card/, { timeout: 30_000 });
  await expect(page.locator('#alert-container .desk-alert.green .alert-message').last(),
    'the success alert names the scrub, not only the loss').toContainText(/scrub 0\.600/);

  const after = await held(page);
  const dScrub = round3(after.scrub - before.scrub);
  const dLoss = lossWh ? round3((after.loss[lossWh] || 0) - (before.loss[lossWh] || 0)) : 0;
  console.log(`  Scrub +${dScrub} g · ${lossWh} +${dLoss} g`);
  expect(dScrub, 'scrub reached the Scrub warehouse').toBeCloseTo(S.scrub, 3);
  if (lossWh) expect(dLoss, 'only the remainder was written off').toBeCloseTo(0.4, 3);

  const bi = await frappeCall<any>(page, 'frappe.client.get_list', {
    doctype: 'Bench Issue',
    filters: JSON.stringify([['order_bag', '=', S.card], ['status', '=', 'Receipted']]),
    fields: JSON.stringify(['weight_out', 'weight_in', 'scrub', 'loss']),
    order_by: 'modified desc', limit_page_length: 1,
  });
  const r = bi[0];
  expect(round3(Number(r.weight_in) + Number(r.scrub) + Number(r.loss)),
    'weight out = weight in + scrub + loss').toBeCloseTo(round3(Number(r.weight_out)), 3);
});

test('3 the Scrub desk attributes it to the bench and the person', async ({ page }) => {
  test.skip(!S.card, 'no card issued');
  await gotoApp(page, 'scrub');
  await expect(page.locator('#page-scrub .sc-kpi').first()).toBeVisible();

  const d = await frappeCall<any>(page, 'jewelima.jewelima.api.get_scrub_board', {});
  const bench = (d.by_bench || []).find((b: any) => b.key === S.bench);
  const who = (d.by_employee || []).find((e: any) => e.key === S.emp.id);
  expect(bench, `${S.bench} shows on the board`).toBeTruthy();
  expect(who, `${S.emp.name} shows on the board`).toBeTruthy();

  // the page must say the same thing the API does
  await expect(page.locator('#page-scrub')).toContainText(S.bench);
  await expect(page.locator('#page-scrub')).toContainText(S.emp.name);
  await expect(page.locator('#page-scrub')).toContainText(S.card);

  // the two breakdowns are the same metal counted two ways
  const byBench = (d.by_bench || []).reduce((n: number, r: any) => n + Number(r.qty), 0);
  const byEmp = (d.by_employee || []).reduce((n: number, r: any) => n + Number(r.qty), 0);
  expect(round3(byBench)).toBeCloseTo(round3(byEmp), 3);
  expect(round3(byBench)).toBeCloseTo(round3(Number(d.collected)), 3);
  console.log(`  collected ${d.collected} g · held ${d.total_held} g · ${S.bench} / ${S.emp.name}`);
});

test('4 Transfer Weight moves it out, and refuses what it should', async ({ page }) => {
  await gotoApp(page, 'transfer-weight');
  const ctx = await frappeCall<any>(page, 'jewelima.jewelima.api.get_weight_transfer_context', {});
  const src = (ctx.sources || []).find((s: any) => /^Scrub/.test(s.label) && s.total > 0.05);
  test.skip(!src, 'nothing in the Scrub warehouse to move');
  const item = src.items[0].item;
  const target = (ctx.targets || []).find((t: any) => /Gold Issue/.test(t.label));
  const move = 0.25;

  await click(page, page.locator(`#page-transfer-weight .tw-card:has-text("Scrub")`).first(), 'take it from Scrub');
  await page.locator('#page-transfer-weight .tw-qty').fill(String(move));
  await page.locator('#page-transfer-weight .tw-qty').dispatchEvent('input');
  await page.locator('#page-transfer-weight .tw-target').selectOption(target.warehouse);
  await click(page, page.locator('#page-transfer-weight .tw-go'), `move ${move} g`);
  const dlg = page.locator('.modal.show');
  await dlg.locator('.btn-primary:visible').first().click();
  await expect(page.locator('#alert-container .desk-alert.green .alert-message').last())
    .toContainText(/moved/i, { timeout: 30_000 });

  const after = await frappeCall<any>(page, 'jewelima.jewelima.api.get_weight_transfer_context', {});
  const src2 = (after.sources || []).find((s: any) => s.warehouse === src.warehouse);
  expect(round3(src.total - src2.total), 'the source dropped by exactly what moved')
    .toBeCloseTo(move, 3);

  // the guards live on the SERVER — the page is a convenience, not the rule
  const refuse = async (args: any, why: string) => {
    const err = await page.evaluate(async (a) => {
      try {
        await (window as any).frappe.call({ method: 'jewelima.jewelima.api.transfer_weight', args: a });
        return null;
      } catch (e: any) { return String(e?.message || e || 'threw'); }
    }, args);
    console.log(`  ${why.padEnd(34)} ${err ? 'refused' : 'ACCEPTED (wrong)'}`);
    expect(err, why).toBeTruthy();
  };
  const fg = 'Finished Goods - ' + src.warehouse.split(' - ').pop();
  await refuse({ source: fg, target: target.warehouse, item, qty: 0.1 }, 'source that does not collect');
  await refuse({ source: src.warehouse, target: fg, item, qty: 0.1 }, 'target not allowed to receive');
  await refuse({ source: src.warehouse, target: target.warehouse, item, qty: 9999 }, 'more than it holds');
  await refuse({ source: src.warehouse, target: target.warehouse, item, qty: 0 }, 'zero weight');
});
