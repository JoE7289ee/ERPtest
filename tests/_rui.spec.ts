import { test, expect } from '@playwright/test';

const errs: string[] = [];
function watch(page: any, tag: string) {
  page.on('console', (m: any) => { if (m.type()==='error' && !/socket\.io/i.test(m.text())) errs.push(`${tag}: ${m.text().slice(0,90)}`); });
  page.on('response', (r: any) => { if (r.url().includes('/api/') && r.status()>=400) errs.push(`${tag}: HTTP${r.status()} ${r.url().split('.').pop()?.slice(0,35)}`); });
}
const say = (n: string, c: boolean, d = '') => console.log((c?'  PASS  ':'  FAIL  ') + n + (d && !c ? '   -> '+d : ''));

test('A. masters page', async ({ page }) => {
  test.setTimeout(180_000); watch(page, 'masters');
  await page.goto('/app/repair-masters');
  await page.waitForTimeout(6000);
  const txt = (await page.locator('.layout-main-section').innerText()).replace(/\s+/g,' ');
  say('three panels present', /PARTIES/i.test(txt) && /TYPES OF WORK/i.test(txt) && /TYPE/i.test(txt), txt.slice(0,90));
  const counts = await page.locator('.layout-main-section').innerText();
  say('parties listed', /LULU|MALABAR|JOYALUKKAS/.test(counts));
  say('work types listed', /SOLDERING/.test(counts));
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('masters')).join(' ; ') || 'none'));
});

test('B. new repair order', async ({ page }) => {
  test.setTimeout(180_000); watch(page, 'intake');
  await page.goto('/app/new-repair-order');
  await page.waitForTimeout(6000);
  const t = (await page.locator('.layout-main-section').innerText()).replace(/\s+/g,' ');
  say('intake page renders', /PARTY/i.test(t), t.slice(0,80));
  // the counter itself is checked in _rui2, against .nr-tot
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('intake')).join(' ; ') || 'none'));
});

test('C. status page', async ({ page }) => {
  test.setTimeout(180_000); watch(page, 'status');
  await page.goto('/app/repair-status');
  await page.waitForTimeout(7000);
  const t = (await page.locator('.layout-main-section').innerText()).replace(/\s+/g,' ');
  say('batches shown', /LULU|MALABAR|JOYALUKKAS/.test(t), t.slice(0,90));
  say('KPIs present', /BATCHES/i.test(t) && /PIECES/i.test(t), t.slice(0,90));
  // the state pills are checked in _rui2, against .rs-pill
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('status')).join(' ; ') || 'none'));
});

test('D. billing full flow', async ({ page }) => {
  test.setTimeout(300_000); watch(page, 'billing');
  await page.goto('/app/repair-billing');
  await page.waitForSelector('.rb-card2', { timeout: 60_000 });
  const n = await page.locator('.rb-card2').count();
  say('floor lists open batches', n === 3, String(n));

  const tiles = page.locator('.rb-card2');
  let i = 0; for (let k=0;k<n;k++) if ((await tiles.nth(k).innerText()).includes('LULU')) { i=k; break; }
  await tiles.nth(i).click();
  await page.waitForSelector('table.rb-t', { timeout: 30_000 });
  say('batch opens with its pieces', await page.locator('tbody tr[data-r]').count() === 4);

  // weigh all four + karat
  const outs = page.locator('input.rb-out');
  for (const [k,v] of [[0,'10.500'],[1,'20.400'],[2,'30.250'],[3,'40.100']] as any)
    await outs.nth(k).fill(v);
  await page.locator('select.rb-kt').nth(0).selectOption('22');
  await page.locator('.rb-savew').click(); await page.waitForTimeout(2500);
  const wo = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({ method:'jewelima.jewelima.repair_api.list_open_repairs' });
    return ((r.message||[]).find((x:any)=>x.party==='LULU JEWELS')||{}).weighed_out; });
  say('all four weights persisted', wo === 4, String(wo));

  // board rate + stone
  await page.locator('input.rb-gold').fill('10000');
  await page.locator('input.rb-gold').dispatchEvent('change'); await page.waitForTimeout(800);
  await page.locator('td.rb-st').first().click();
  await page.waitForSelector('.modal.show .sd-t', { timeout: 15_000 });
  await page.locator('.modal.show .sd-q').first().fill('EF');
  await page.locator('.modal.show .sd-s').first().fill('OOO-OO');
  await page.locator('.modal.show .sd-p').first().fill('2');
  await page.locator('.modal.show .sd-p').first().dispatchEvent('change'); await page.waitForTimeout(600);
  const auto = await page.locator('.modal.show .sd-c').first().inputValue();
  say('carats auto-fill from the sieve chart', parseFloat(auto) > 0, auto);
  await page.locator('.modal.show .sd-c').first().fill('0.090');
  await page.locator('.modal.show .btn-primary').click(); await page.waitForTimeout(3000);
  say('stone saved on the piece', /EF/.test(await page.locator('td.rb-st').first().innerText()));

  // add work from billing
  const noWork = page.locator('.rb-work.none');
  const hadNone = await noWork.count();
  say('a piece with no work is marked', hadNone >= 1, String(hadNone));

  // rates
  const wr = page.locator('input.rb-rate').first();
  await wr.fill('150'); await wr.dispatchEvent('change'); await page.waitForTimeout(900);
  const sr = page.locator('input.rb-srate').first();
  await sr.fill('20000'); await sr.dispatchEvent('change'); await page.waitForTimeout(900);

  // the row breakup must equal work+metal+stone
  const row = await page.evaluate(() => {
    const tr = document.querySelector('tbody tr[data-r]')!;
    const cur = (s: string) => parseFloat((s||'').replace(/[^0-9.-]/g,'')) || 0;
    return { w: cur(tr.querySelector('.rb-m-work')!.textContent!),
             m: cur(tr.querySelector('.rb-m-metal')!.textContent!),
             s: cur(tr.querySelector('.rb-m-stone')!.textContent!),
             t: cur(tr.querySelector('.rb-m-tot')!.textContent!) };
  });
  say('row breakup adds up', Math.abs(row.w+row.m+row.s-row.t) < 0.02, JSON.stringify(row));
  say('metal priced at 22k', Math.abs(row.m - 0.5*10000*22/24) < 1, String(row.m));
  say('stone priced per carat', Math.abs(row.s - 1800) < 1, String(row.s));

  // bill 2 of 4
  await page.locator('input.rb-pick2').nth(2).uncheck();
  await page.locator('input.rb-pick2').nth(3).uncheck();
  await page.waitForTimeout(800);
  say('button counts the picked', /Bill 2 piece/.test(await page.locator('.rb-bill').innerText()));
  await page.locator('.rb-bill').click(); await page.waitForTimeout(1500);
  const c = page.locator('.modal.show .btn-primary'); if (await c.count()) await c.click();
  await page.waitForTimeout(3500);
  say('two pieces now billed', await page.locator('tr.rb-done').count() === 2);
  say('two still open', await page.locator('input.rb-pick2').count() === 2);

  // back to the floor, batch should read part-billed
  await page.locator('button:has-text("All repairs")').first().click();
  await page.waitForSelector('.rb-card2', { timeout: 20_000 });
  const lulu = await page.locator('.rb-card2', { hasText: 'LULU' }).innerText();
  say('floor shows it part billed', /part billed/i.test(lulu), lulu.replace(/\s+/g,' '));
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('billing')).join(' ; ') || 'none'));
});
