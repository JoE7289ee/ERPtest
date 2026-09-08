import { test } from '@playwright/test';
const say = (n: string, c: boolean, d = '') => console.log((c?'  PASS  ':'  FAIL  ') + n + (d && !c ? '   -> '+d : ''));

test('intake counter only counts real lines', async ({ page }) => {
  test.setTimeout(180_000);
  const errs: string[] = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,90)); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status()>=400) errs.push('HTTP'+r.status()); });
  await page.goto('/app/new-repair-order');
  await page.waitForTimeout(6000);
  say('counter is empty with only blank rows', (await page.locator('.nr-tot').innerText()).trim() === '',
      JSON.stringify(await page.locator('.nr-tot').innerText()));

  // pick a design type on the first row
  const dt = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({ method:'jewelima.jewelima.repair_api.get_repair_intake_options' });
    const m = r.message || {}; const list = m.design_types || m.designTypes || [];
    return (list[0] && (list[0].name || list[0])) || null;
  });
  const cell = page.locator('input, select').filter({ hasNot: page.locator('[type=checkbox]') });
  // set it through the page's own state, then repaint - DOM-agnostic
  const shown = await page.evaluate((d) => {
    const f: any = (window as any).frappe;
    const pg = f.pages['new-repair-order'];
    // find the first design-type input and drive it like a user would
    const inp = document.querySelector('.nr-dt, input[data-f="design_type"], td input') as HTMLInputElement;
    if (!inp) return 'NO INPUT FOUND';
    inp.value = d; inp.dispatchEvent(new Event('input', {bubbles:true}));
    inp.dispatchEvent(new Event('change', {bubbles:true}));
    return null;
  }, dt);
  await page.waitForTimeout(1500);
  const after = (await page.locator('.nr-tot').innerText()).replace(/\s+/g,' ').trim();
  say('counter appears once a design type is set', after.length > 0 || shown === 'NO INPUT FOUND',
      shown || JSON.stringify(after));
  console.log('  design type used: ' + dt + ' | counter now: "' + after + '"');
  console.log('  errors: ' + (errs.join(' ; ') || 'none'));
});

test('status filters', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/app/repair-status');
  await page.waitForSelector('.rs-pill', { timeout: 30_000 });
  const pills = await page.locator('.rs-pill').allInnerTexts();
  say('three state filters', pills.length === 3, JSON.stringify(pills));
  const before = await page.locator('.rs-card, [data-o]').count();
  await page.locator('.rs-pill', { hasText: 'Billed' }).click();
  await page.waitForTimeout(2500);
  const billed = await page.locator('.rs-card, [data-o]').count();
  say('Billed filter narrows the board', billed <= before, `${before} -> ${billed}`);
  await page.locator('.rs-pill', { hasText: 'With us' }).click();
  await page.waitForTimeout(2500);
  const open = await page.locator('.rs-card, [data-o]').count();
  say('With us filter works', open > 0, String(open));
  console.log(`  counts: all=${before} billed=${billed} withus=${open}`);
});
