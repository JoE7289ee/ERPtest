import { test, expect } from '@playwright/test';

// Landing on Lot Selection shows what is true NOW, not what was true the last
// time the page was open. Every navigation here is in-app (frappe.set_route) —
// a full page reload would refresh anyway and prove nothing.
test('Lot Selection refreshes when it is landed on', async ({ page }) => {
  const go = async (...route: string[]) => {
    await page.evaluate((r: string[]) => (window as any).frappe.set_route(...r), route);
    await page.waitForTimeout(2200);
  };
  const call = (method: string, args: any) => page.evaluate(async ({ method, args }) => {
    const r = await (window as any).frappe.call({ method, args });
    return r.message;
  }, { method, args });
  const lotsel = async () => page.evaluate(() => {
    const ev = ((window as any).$._data(window, 'events') || {}).beforeunload || [];
    return ev.filter((h: any) => h.namespace === 'lotsel').length;
  });

  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForTimeout(800);
  const tilesBefore = await page.locator('.ls-card').count();
  console.log('tiles at first load  :', tilesBefore);

  // ---- 1. a lot is booked in while we are on another page ----------------
  await go('stone-lots');
  const lot = await call('frappe.client.insert', { doc: {
    doctype: 'Stone Lot', supplier: 'SAMSA', quality: 'VVS-EF',
    received_on: new Date().toISOString().slice(0, 10), claimed_cts: 40,
    items: [{ sieve: 'OOOOO-OOOO', actual_cts: 12, selected_cts: 7 }] } });
  console.log('booked in while away :', lot.name);
  await go('lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 20000 });
  await page.locator('.ls-f', { hasText: 'Open' }).click();
  await page.waitForTimeout(800);
  const seen = await page.locator('.ls-card').filter({ hasText: lot.name }).count();
  console.log('new lot on the board after coming back:', seen === 1);
  expect(seen, 'the board shows the lot booked in while away').toBe(1);

  // ---- 2. a link to a lot opens THAT lot, from another page ---------------
  await go('stone-lots');
  await go('lot-selection', lot.name);
  await page.waitForSelector('.ls-bar .nm', { timeout: 20000 });
  const opened = ((await page.locator('.ls-bar .nm').textContent()) || '').trim();
  console.log('link opened          :', opened);
  expect(opened).toBe(lot.name);
  const trayBefore = await page.locator('.ls-t tbody tr').first().locator('input[data-f=actual]').inputValue();
  console.log('tray actual on screen:', trayBefore);

  // ---- 3. the tray changes while we are away ------------------------------
  await go('stone-lots');
  await call('jewelima.jewelima.api.save_stone_lot_selection', { name: lot.name, actual_cts: 0,
    rows: JSON.stringify([{ sieve: 'OOOOO-OOOO', actual: 18, selected: 9 }]) });
  await go('lot-selection', lot.name);
  await page.waitForSelector('.ls-t tbody tr input[data-f=actual]', { timeout: 20000 });
  await page.waitForTimeout(800);
  const trayAfter = await page.locator('.ls-t tbody tr').first().locator('input[data-f=actual]').inputValue();
  console.log('tray after coming back:', trayAfter, '(changed to 18 while away)');
  expect(Number(trayAfter)).toBe(18);

  // ---- 4. round trips do not stack listeners ------------------------------
  for (let i = 0; i < 3; i++) { await go('stone-lots'); await go('lot-selection'); }
  const n = await lotsel();
  console.log('beforeunload listeners after 3 more round trips:', n);
  expect(n, 'one listener, however many visits').toBe(1);

  // tidy dev
  await call('frappe.client.delete', { doctype: 'Stone Lot', name: lot.name });
  console.log('cleaned up           :', lot.name);
});
