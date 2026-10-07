// Repair shop screens and the stone-lot tray (fixes of 7 Oct 2026, second round).
// Run on the :8002 copy:
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_repair_lots --project=chromium --no-deps
// Everything it makes is named ZZT…. A billed repair cannot be deleted from the desk, so
// run api8002/repair_lots_2026_10_07.py afterwards — it starts by clearing everything ZZT.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });

const R = 'jewelima.jewelima.repair_api.';
const A = 'jewelima.jewelima.api.';

test('repair screens and the lot tray', async ({ page, context }) => {
  test.setTimeout(420_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/repair-status');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const call = (method: string, args: any = {}) => page.evaluate(([m, a]) => new Promise((res, rej) => {
    (window as any).frappe.call({ method: m, args: a, freeze: false }).then((r: any) => res(r.message), (e: any) => rej(new Error(m)));
  }), [method, args] as any) as Promise<any>;
  const route = async (r: string) => { await page.evaluate((x) => (window as any).frappe.set_route(x), r); await page.waitForTimeout(2500); };
  const tag = Math.random().toString(36).slice(2, 7).toUpperCase();

  const tidy = () => page.evaluate(async () => {
   try {
    const f = (window as any).frappe;
    const del = (doctype: string, name: string) => new Promise((res) => f.call({ method: 'frappe.client.delete', args: { doctype, name }, freeze: false, error: () => {} }).then(() => res(1), () => res(0)));
    const list = (doctype: string, filters: any) => new Promise<any[]>((res) => f.call({ method: 'frappe.client.get_list', args: { doctype, filters, fields: ['name'], limit_page_length: 50 }, freeze: false }).then((r: any) => res(r.message || []), () => res([])));
    for (const o of await list('Repair Order', { party: ['like', 'ZZT PARTY %'] })) {
      for (const b of await list('Repair Bill', { repair_order: o.name })) await del('Repair Bill', b.name);
      await del('Repair Order', o.name);
    }
    for (const l of await list('Stone Lot', { remarks: 'ZZT' })) {
      for (const r of await list('Stone Purchase Request', { stone_lot: l.name })) await del('Stone Purchase Request', r.name);
      await del('Stone Lot', l.name);
    }
    for (const w of await list('Repair Work Type', { name: ['like', 'ZZT %'] })) await del('Repair Work Type', w.name);
    for (const p of await list('Repair Party', { name: ['like', 'ZZT PARTY %'] })) await del('Repair Party', p.name);
    return 'ok';
   } catch (e: any) { return 'tidy failed: ' + (e && (e.message || JSON.stringify(e).slice(0, 300))); }
  }).then((r) => { if (r !== 'ok') console.log(r); });
  await tidy();        // whatever a run that stopped half way left behind

  // ---- what the screens will work on
  const dt = (await call('frappe.client.get_list', { doctype: 'Design Type', fields: ['name'], limit_page_length: 1 }))[0].name;
  const partyA = `ZZT PARTY A ${tag}`, partyB = `ZZT PARTY B ${tag}`, work = `ZZT WORK ${tag}`;
  const o = await call(R + 'create_repair_order', { payload: { party: partyA, items: [
    { design_type: dt, qty: 1, weight: 10, karat: '18', work_types: [work] },
    { design_type: dt, qty: 1, weight: 5, karat: '18', work_types: [work] },
    { design_type: dt, qty: 1, weight: 4, karat: '18', work_types: [] }] } });
  const ids: string[] = o.items.map((i: any) => i.repair);
  await call(R + 'add_repair_party', { party_name: partyB });
  const bill = await call(R + 'save_repair_bill', { payload: JSON.stringify({ repair_order: o.name, gold_rate: 10300, gst_percent: 3,
    items: [{ repair: ids[2], weight_out: 4, karat: '18' }], charges: [] }) });

  // ---- Repair Status: a part-billed batch is still with us, and can be edited
  await route('repair-status'); await page.reload(); await page.waitForTimeout(3500);
  const card = page.locator('#page-repair-status .rs-card', { hasText: o.name });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).not.toHaveClass(/billed/);
  await expect(card.locator('.tag')).toContainText('1 of 3 billed');
  await expect(card.locator('.rs-edit')).toBeVisible();
  // a piece added from the edit box is added once, however often Save is pressed
  await card.locator('.rs-edit').click();
  const dlg = page.locator('.modal.show');
  await dlg.locator('.re-add').click();
  await dlg.locator('.rf-dt').fill(dt);
  await dlg.locator('.rf-wt').fill('3.2');
  const save = dlg.locator('.modal-footer .btn-primary, .btn-modal-primary').first();
  await save.dblclick();
  await page.waitForTimeout(6000);
  const after = await call(R + 'get_repair_order', { name: o.name });
  expect(after.items.length).toBe(4);

  // ---- Repair Billing: typed manual amounts survive Update; the bill carries the purity shown
  await route('repair-billing'); await page.waitForTimeout(1500);
  await page.locator(`#page-repair-billing .rb-card2[data-o="${o.name}"]`).click();
  const row = page.locator(`#page-repair-billing tr[data-r="${ids[0]}"]`);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.locator('.rb-man').fill('-200');
  await row.locator('.rb-out').fill('10.5');
  await page.locator('#page-repair-billing .rb-savew').first().click();
  await page.waitForTimeout(3000);
  await expect(page.locator(`#page-repair-billing tr[data-r="${ids[0]}"] .rb-man`)).toHaveValue('-200');
  await page.locator(`#page-repair-billing tr[data-r="${ids[0]}"] .rb-kt`).selectOption('22');
  await page.waitForTimeout(600);
  await page.evaluate(() => { (window as any).jewelima.printRepairBill = () => {}; });
  const [req] = await Promise.all([
    page.waitForRequest((q) => q.url().includes('preview_repair_bill'), { timeout: 15_000 }),
    page.locator('#page-repair-billing .rb-preview').first().click(),
  ]);
  const sent = JSON.parse(new URLSearchParams(req.postData() || '').get('payload') || '{}');
  expect(sent.items.find((i: any) => i.repair === ids[0])).toEqual({ repair: ids[0], weight_out: 10.5, karat: '22', manual_amount: -200 });

  // ---- the stone box: a row with a sieve and a count but no bucket is not thrown away
  await page.locator(`#page-repair-billing tr[data-r="${ids[0]}"] td.rb-st`).click();
  const sd = page.locator('.modal.show', { hasText: 'Stones' });
  await expect(sd).toBeVisible();
  await sd.locator('.sd-s').first().selectOption({ index: 1 });
  await sd.locator('.sd-p').first().fill('12');
  await sd.locator('.modal-footer .btn-primary, .btn-modal-primary').first().click();
  await expect(page.locator('.modal.show', { hasText: 'have no bucket' })).toBeVisible({ timeout: 8000 });
  await expect(sd).toBeVisible();
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  expect((await call(R + 'get_repair_order', { name: o.name })).items.find((i: any) => i.repair === ids[0]).stones || []).toEqual([]);

  // ---- New Repair Order: the received-at box follows the clock until it is set by hand
  await route('new-repair-order'); await page.waitForTimeout(1500);
  const when = page.locator('#page-new-repair-order .nr-when');
  await page.evaluate(() => { (window as any).$('#page-new-repair-order .nr-when').val('2020-01-01T09:05'); });
  await page.evaluate(() => (window as any).frappe.pages['new-repair-order'].on_page_show());
  await page.waitForTimeout(2500);
  expect((await when.inputValue()).slice(0, 4)).toBe(String(new Date().getFullYear()));
  await when.fill('2026-10-01T10:00');
  await page.evaluate(() => (window as any).frappe.pages['new-repair-order'].on_page_show());
  await page.waitForTimeout(2500);
  expect(await when.inputValue()).toBe('2026-10-01T10:00');

  // ---- Quick Check: rates belong to the party picked
  await route('repair-quick-check'); await page.reload(); await page.waitForTimeout(3500);
  const qc = page.locator('#page-repair-quick-check');
  const pick = async (p: string) => {
    const inp = qc.locator('.qc-h-party input').first();
    await inp.fill(p); await page.waitForTimeout(1200); await inp.press('Tab'); await page.waitForTimeout(3000);
  };
  await expect(qc.locator('.qc-from')).toHaveCount(0);
  await pick(partyA);
  await expect(qc.locator('.qc-from')).toContainText(bill.name);
  expect(await qc.locator('.qc-h-gold input').first().inputValue()).toContain('10,300');
  await pick(partyB);
  await expect(qc.locator('.qc-from')).toHaveCount(0);
  expect((await qc.locator('.qc-h-gold input').first().inputValue()).replace(/[^0-9.]/g, '').replace(/^0+\.?0*$/, '')).toBe('');

  // ---- Lot Selection: a tray changed elsewhere is not overwritten by this screen
  const sup = (await call('frappe.client.get_list', { doctype: 'Supplier', fields: ['name'], limit_page_length: 1 }))[0].name;
  const sv = (await call('frappe.client.get_list', { doctype: 'Diamond Sieve', fields: ['sieve_size'], limit_page_length: 2 })).map((x: any) => x.sieve_size);
  const ctx = await call(A + 'get_stone_lot_context');
  const ql = (ctx.qualities || [])[0];
  const lot = (await call(A + 'create_stone_lot', { supplier: sup, quality: ql, claimed_cts: 80, remarks: 'ZZT' })).name;
  await call(A + 'save_stone_lot_selection', { name: lot, rows: JSON.stringify([{ sieve: sv[0], actual: 60, selected: 40 }]) });
  await route('lot-selection/' + lot); await page.reload(); await page.waitForTimeout(4000);
  const ls = page.locator('#page-lot-selection');
  await expect(ls.locator('input.ls-in[data-f="actual"]').first()).toHaveValue('60');
  // another screen asks for 20 ct and a manager rejects it — the lot moved twice
  const pr = await call(A + 'create_stone_purchase_request', { lot, rows: JSON.stringify([{ sieve: sv[0], cts: 20 }]) });
  await call(A + 'save_stone_lot_selection', { name: lot, rows: JSON.stringify([{ sieve: sv[0], actual: 40, selected: 20 }]), modified: 'x' });
  // this screen, still showing the old tray, types a figure
  await ls.locator('input.ls-in[data-f="selected"]').first().fill('35');
  await expect(page.locator('.alert, .desk-alert', { hasText: 'changed on another screen' })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  let now = await call(A + 'get_stone_lot', { name: lot });
  expect([now.items[0].actual, now.items[0].selected]).toEqual([40, 20]);      // not overwritten
  await expect(ls.locator('input.ls-in[data-f="actual"]').first()).toHaveValue('40');
  // and from the fresh tray it saves as before
  await ls.locator('input.ls-in[data-f="selected"]').first().fill('15');
  await expect(ls.locator('.ls-state')).toHaveClass(/saved/, { timeout: 10_000 });
  now = await call(A + 'get_stone_lot', { name: lot });
  expect(now.items[0].selected).toBe(15);

  // ---- closing after a rejected purchase: the manager signs the whole tray
  await call(A + 'decide_stone_purchase_request', { name: pr.name, decision: 'Rejected' });
  await route('lot-selection'); await route('lot-selection/' + lot); await page.reload(); await page.waitForTimeout(4000);
  const made = await call(A + 'close_stone_lot_request', { lot });
  await call(A + 'decide_stone_purchase_request', { name: made.purchase, decision: 'Rejected' });
  await page.reload(); await page.waitForTimeout(4000);
  await ls.locator(`.ls-yes[data-name="${made.close}"]`).click();
  const cf = page.locator('.modal.show');
  await expect(cf).toContainText('60.000');
  await expect(cf).toContainText('still marked as kept');
  await cf.locator('.btn-primary').first().click();
  await page.waitForTimeout(4000);
  now = await call(A + 'get_stone_lot', { name: lot });
  expect(now.status).toBe('Closed');
  expect([now.items[0].actual, now.items[0].selected, now.items[0].returned]).toEqual([0, 0, 60]);

  await tidy();
  expect(errors).toEqual([]);
});
