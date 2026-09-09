// Stone Lots (Stones > Stone Lots) — booking a provider's parcel in, then
// sieving it. The rejection is never typed: it is the actual weight less what
// was kept, and it has to hold whatever is entered.
import { test, expect, Page } from '@playwright/test';
const READY = () => (window as any).frappe?.app;

async function errsOn(page: Page, bag: string[]) {
  page.on('pageerror', (e) => bag.push('PAGEERROR ' + String(e).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') bag.push('CONSOLE ' + m.text().slice(0, 200)); });
}

test('the two lot pages work end to end', async ({ page }) => {
  const errs: string[] = [];
  await errsOn(page, errs);

  await page.goto('/app/stone-lots');
  await page.waitForFunction(() => document.querySelectorAll('.sl-kpi').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(600);

  const kpis = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.sl-kpi')).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()));
  console.log('KPIs:', JSON.stringify(kpis));
  expect(kpis.length, 'four KPIs').toBe(4);

  // the form: provider is the only thing the CREATE button waits for
  const disabledBefore = await page.locator('.sl-book').isDisabled();
  console.log('create disabled with no provider:', disabledBefore);
  expect(disabledBefore, 'no provider, no lot').toBe(true);

  const supplier = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({
      method: 'jewelima.jewelima.api.get_stone_lot_context' });
    return r.message.suppliers[0].name;
  });
  console.log('provider used:', supplier);

  // book a lot through the page's own call path
  const lot = await page.evaluate(async (sup) => {
    const r = await (window as any).frappe.call({
      method: 'jewelima.jewelima.api.create_stone_lot',
      args: { supplier: sup, received_on: '2026-09-09', quality: 'VVS-EF', claimed_cts: 250 } });
    return r.message;
  }, supplier);
  console.log('booked:', lot.name, '| claimed', lot.claimed, '| status', lot.status);
  expect(lot.name, 'named LOT-<provider>-<n>').toMatch(/^LOT-[A-Z0-9]+-\d{5}$/);

  // the selection desk, opened straight onto that lot
  await page.goto('/app/lot-selection/' + lot.name);
  await page.waitForFunction(() => document.querySelectorAll('.ls-in').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(500);
  const sieveRows = await page.locator('.ls-in').count();
  console.log('sieve rows on the table:', sieveRows);
  expect(sieveRows, 'the whole chart is offered').toBeGreaterThan(40);

  // actual weight, then the SALONI NO:14 selection
  await page.evaluate(() => {
    const f = (window as any).cur_page?.page || null; void f;
  });
  await page.locator('.ls-actual input').fill('249.20');
  await page.locator('.ls-actual input').dispatchEvent('change');
  const pairs: [string, string][] = [['OOOO-OOO', '17.09'], ['OOO-OO', '43.02'], ['OO-O', '34.17'],
    ['O-1', '57.77'], ['1-1.5', '21.59'], ['1.5-2', '28.50']];
  for (const [sv, v] of pairs) {
    await page.locator(`.ls-in[data-sv="${sv}"]`).fill(v);
    await page.locator(`.ls-in[data-sv="${sv}"]`).dispatchEvent('input');
  }
  await page.waitForTimeout(300);

  const live = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ls-kpi')).map((e) => ({
      k: (e.querySelector('.k')?.textContent || '').trim(),
      v: (e.querySelector('.v')?.textContent || '').trim() })));
  console.log('live totals:', JSON.stringify(live));
  const rej = live.find((x) => /Rejection/i.test(x.k));
  expect(rej?.v, 'rejection is worked out as you type').toBe('47.060');

  await page.locator('.ls-save').click();
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(async (n) => {
    const r = await (window as any).frappe.call({
      method: 'jewelima.jewelima.api.get_stone_lot', args: { name: n } });
    return r.message;
  }, lot.name);
  console.log('saved:', saved.status, '| actual', saved.actual, '| selected', saved.selected,
    '| rejected', saved.rejected, '| lines', saved.items.length);
  expect(saved.selected).toBeCloseTo(202.14, 2);
  expect(saved.rejected).toBeCloseTo(47.06, 2);
  expect(saved.status).toBe('Selected');
  expect(saved.items.length).toBe(6);

  expect(errs, 'no errors on either page').toEqual([]);
});
