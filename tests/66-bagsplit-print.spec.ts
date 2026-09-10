// Typing a card without the E, and PRINT taking you straight to Multi Print
// with the freshly cut pieces already loaded.
import { test, expect } from '@playwright/test';

test('scan without the E, then PRINT lands on Multi Print with the pieces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/bag-split');
  await page.waitForFunction(() => document.querySelector('.bs-scan input'), undefined, { timeout: 60_000 });
  await page.waitForTimeout(500);

  const bag = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({ method: 'frappe.client.get_list',
      args: { doctype: 'Order Bag', filters: { location: 'BAG EXTRACTION', qty: 10 },
              limit_page_length: 1, fields: ['name'] } });
    return r.message[0]?.name;
  });
  test.skip(!bag, 'no qty-10 card at BAG EXTRACTION');
  const noE = bag.replace(/^E/, '');
  console.log(`card ${bag} — typing it as "${noE}"`);

  await page.locator('.bs-scan input').fill(noE);
  await page.locator('.bs-scan input').press('Enter');
  // A card already started (a previous run, or a closed browser) RESUMES straight
  // to the pieces with no EXTRACT button, so wait for either and adapt.
  await page.waitForFunction(() => document.querySelectorAll('.bs-card .btn-primary').length > 0
    || document.querySelectorAll('.bs-piece').length > 0, undefined, { timeout: 30_000 });
  const loaded = await page.evaluate(() =>
    (document.querySelector('.bs-card .bs-grid .v')?.textContent || '').trim());
  console.log('loaded card:', loaded);
  expect(loaded, 'the E-less code found the card').toBe(bag);

  if (await page.locator('.bs-card .btn-primary').count()) {
    const label = (await page.locator('.bs-card .btn-primary').textContent() || '').trim();
    console.log('start button reads:', label);
    expect(label, 'the start button says EXTRACT').toBe('EXTRACT');
    await page.locator('.bs-card .btn-primary').click();
  } else {
    console.log('card was already in progress — resumed straight to the pieces');
  }
  await page.waitForFunction(() => document.querySelectorAll('.bs-piece').length > 0, undefined, { timeout: 30_000 });
  await page.waitForTimeout(700);

  // fill each piece's gross so the PRINT button arms
  const n = await page.locator('.bs-piece').count();
  const per = await page.evaluate(() => {
    const el = document.querySelector('.bs-rem') as HTMLElement;
    const m = (el.textContent || '').match(/Product gross:\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  });
  const each = (per / n).toFixed(3);
  console.log(`filling ${n} pieces at ${each} g each (product gross ${per})`);
  for (let i = 0; i < n; i++) {
    const inp = page.locator('.bs-piece .ph input').nth(i);
    await inp.fill(each);
    await inp.dispatchEvent('change');
  }
  await page.waitForTimeout(500);

  const label = (await page.locator('.bs-splitbtn').textContent() || '').trim();
  console.log('button reads:', label);
  expect(label, 'the button says PRINT').toBe('PRINT');

  // An even fill in whole milligrams leaves a sliver of gold over (2.834/10 is
  // 0.2834), which is exactly what "Split remaining" exists for.
  if (!(await page.locator('.bs-splitbtn').isEnabled())) {
    const rem = page.locator('.bs-splitrem');
    if (await rem.isVisible()) {
      console.log('sprinkling the leftover gold');
      await rem.click();
      await page.waitForTimeout(500);
    }
  }
  const armed = await page.locator('.bs-splitbtn').isEnabled();
  console.log('armed:', armed, '|', (await page.locator('.bs-rem').textContent() || '').replace(/\s+/g, ' ').trim());
  expect(armed, 'PRINT arms once the gold balances').toBe(true);

  await page.locator('.bs-splitbtn').click();
  await page.waitForFunction(() => (frappe as any).get_route_str?.() === 'multi-barcode'
    || location.pathname.includes('multi-barcode'), undefined, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => ({
    route: location.pathname,
    rows: document.querySelectorAll('.mb-t tbody tr, .mb-card').length,
    msg: (document.querySelector('.mb-msg')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }));
  console.log('landed on:', r.route, '| message:', r.msg);
  expect(r.route, 'it went to Multi Print by itself').toContain('multi-barcode');
  expect(r.msg, 'carrying the pieces it just cut').toMatch(/piece\(s\) from the split/i);
});
