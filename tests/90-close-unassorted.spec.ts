import { test, expect } from '@playwright/test';

// A parcel only half of which was ever sieved. CLOSE LOT must say, in the
// dialog, that the never-assorted weight goes back as rejection — and the closed
// lot must show it. Screenshots of both dialogs and the closed view are saved.
const SHOTS = '/tmp/claude-501/-Users-josephdaison-learn-aumms-aumms/438b9975-b5fa-4c0d-a85c-09ecac4ded83/scratchpad';

test('closing a lot with carats never assorted says so, with the weight', async ({ page }) => {
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });

  // 100 ct in: 50 through two sieves (20 kept, 30 rejected), 50 never touched
  const lot = await page.evaluate(async () => {
    const csrf = (window as any).frappe.csrf_token;
    const r = await fetch('/api/method/frappe.client.insert', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': csrf },
      body: JSON.stringify({ doc: { doctype: 'Stone Lot', supplier: 'SAMSA', quality: 'VVS-EF',
        received_on: new Date().toISOString().slice(0, 10), claimed_cts: 100,
        items: [{ sieve: 'OOOOO-OOOO', actual_cts: 30, selected_cts: 20 },
                { sieve: 'OOOO-OOO', actual_cts: 20, selected_cts: 0 }] } }) });
    return (await r.json()).message.name;
  });
  console.log('lot        :', lot);

  await page.goto('/app/lot-selection/' + lot);
  await page.waitForSelector('.ls-close', { timeout: 30000 });
  await page.waitForTimeout(1500);

  const kpis = async () => {
    const o: Record<string, string> = {};
    for (const k of await page.locator('.ls-top .ls-kpi').all())
      o[((await k.locator('.k').textContent()) || '').trim()] = ((await k.locator('.v').textContent()) || '').replace(/\s+/g, '');
    return o;
  };
  const before = await kpis();
  console.log('KPIs open  :', JSON.stringify(before));
  expect(before['Left to assort']).toBe('50.000ct');

  // ---- CLOSE LOT: the dialog must name the never-assorted weight -----------
  await page.locator('.ls-close').click();
  const dlg = page.locator('.modal.show').last();
  await dlg.waitFor({ timeout: 10000 });
  const ask = ((await dlg.locator('.modal-body').textContent()) || '').replace(/\s+/g, ' ').trim();
  console.log('close asks :', ask);
  await dlg.locator('.modal-dialog').screenshot({ path: SHOTS + '/close-dialog.png' });
  expect(ask).toContain('50.000 ct was never assorted');
  expect(ask.toLowerCase()).toContain('rejection');
  expect(ask).toContain('Returned in all: 80.000 ct of the 100.000 ct booked in');
  await dlg.locator('.btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4500);

  const trail = await page.locator('.ls-rq').evaluateAll((rs) => rs.map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()));
  console.log('requests   :'); trail.forEach((t) => console.log('   ', t.slice(0, 110)));
  expect(trail.join(' | ')).toContain('never assorted 50.000');

  // settle the purchase off-screen (post=0: no stock moves on dev)
  await page.evaluate(async (n: string) => {
    const csrf = (window as any).frappe.csrf_token;
    const rq = (await (await fetch('/api/method/jewelima.jewelima.api.get_stone_purchase_requests?lot=' + encodeURIComponent(n))).json()).message.rows;
    const buy = rq.find((q: any) => q.request_type === 'Purchase' && q.status === 'Pending');
    await fetch('/api/method/jewelima.jewelima.api.decide_stone_purchase_request', {
      method: 'POST', headers: { 'X-Frappe-CSRF-Token': csrf, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: buy.name, decision: 'Approved', post: '0' }) });
  }, lot);
  await page.reload();
  await page.waitForSelector('.ls-rq', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // ---- approving the close shows the same weight ---------------------------
  await page.locator('.ls-rq').filter({ hasText: 'close' }).first().locator('.ls-yes').click();
  const dlg2 = page.locator('.modal.show').last();
  await dlg2.waitFor({ timeout: 10000 });
  const ask2 = ((await dlg2.locator('.modal-body').textContent()) || '').replace(/\s+/g, ' ').trim();
  console.log('approve asks:', ask2);
  await dlg2.locator('.modal-dialog').screenshot({ path: SHOTS + '/approve-close-dialog.png' });
  expect(ask2).toContain('80.000 ct goes back to the provider');
  expect(ask2).toContain('50.000 ct never assorted');
  await dlg2.locator('.btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(5000);

  // ---- the closed lot shows it --------------------------------------------
  await page.reload();
  await page.waitForSelector('.ls-shut', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const after = await kpis();
  console.log('KPIs closed:', JSON.stringify(after));
  const retSub = ((await page.locator('.ls-kpi.rej .sub').textContent()) || '').replace(/\s+/g, ' ').trim();
  console.log('returned   :', retSub);
  const unRow = ((await page.locator('tr.ls-un').textContent()) || '').replace(/\s+/g, ' ').trim();
  const totRow = ((await page.locator('tr.ls-tot').textContent()) || '').replace(/\s+/g, ' ').trim();
  console.log('never row  :', unRow);
  console.log('total row  :', totRow);
  await page.locator('.ls-one').screenshot({ path: SHOTS + '/closed-lot.png' });
  expect(after['Returned']).toBe('80.000ct');
  expect(retSub).toContain('30.000 off the tray · 50.000 never assorted');
  expect(unRow).toContain('50.000');
  expect(totRow).toContain('80.000');

  // tidy dev
  await page.evaluate(async (n: string) => {
    const csrf = (window as any).frappe.csrf_token;
    const h = { 'X-Frappe-CSRF-Token': csrf, 'Content-Type': 'application/json' };
    const rq = (await (await fetch('/api/method/jewelima.jewelima.api.get_stone_purchase_requests?lot=' + encodeURIComponent(n))).json()).message.rows;
    for (const q of rq) await fetch('/api/method/frappe.client.delete', { method: 'POST', headers: h, body: JSON.stringify({ doctype: 'Stone Purchase Request', name: q.name }) });
    await fetch('/api/method/frappe.client.delete', { method: 'POST', headers: h, body: JSON.stringify({ doctype: 'Stone Lot', name: n }) });
  }, lot);
});
