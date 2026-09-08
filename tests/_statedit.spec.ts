import { test } from '@playwright/test';
const say = (n: string, c: boolean, d='') => console.log((c?'  PASS  ':'  FAIL  ')+n+(d&&!c?'   -> '+d:''));
test('6 edit weight out, karat and stones from Status', async ({ page }) => {
  test.setTimeout(240_000);
  const errs: string[] = [];
  page.on('console', m => { if (m.type()==='error' && !/socket\.io/i.test(m.text())) errs.push(m.text().slice(0,110)); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status()>=400) errs.push('HTTP'+r.status()); });

  await page.goto('/app/repair-status');
  await page.waitForSelector('.rs-edit', { timeout: 60_000 });
  await page.locator('.rs-edit').first().click();
  await page.waitForSelector('.modal.show .re-row', { timeout: 20_000 });
  say('edit dialog opens', await page.locator('.modal.show .re-row').count() > 0);
  say('weight out field present', await page.locator('.modal.show .re-wo').count() > 0);
  say('karat select present', await page.locator('.modal.show select.re-kt').count() > 0);
  say('stones cell present', await page.locator('.modal.show .re-st').count() > 0);

  await page.locator('.modal.show .re-wo').first().fill('11.250');
  await page.locator('.modal.show select.re-kt').first().selectOption('22');
  await page.locator('.modal.show .re-wt').first().fill('10.750');

  // stones from here too
  await page.locator('.modal.show .re-st').first().click();
  await page.waitForSelector('.modal.show .sd-t', { timeout: 15_000 });
  await page.locator('.modal.show .sd-q').first().fill('EF');
  await page.locator('.modal.show .sd-s').first().fill('OOO-OO');
  await page.locator('.modal.show .sd-p').first().fill('3');
  await page.locator('.modal.show .sd-c').first().fill('0.075');
  // two dialogs are open (edit + stones) — target the stone one by its table
  const stoneModal = page.locator('.modal.show').filter({ has: page.locator('.sd-t') });
  await stoneModal.locator('.btn-primary').click();
  await page.waitForTimeout(1500);
  say('stones shown on the edit row', /EF/.test(await page.locator('.modal.show .re-st').first().innerText()),
      await page.locator('.modal.show .re-st').first().innerText());

  // save the whole edit
  const editModal = page.locator('.modal.show').filter({ has: page.locator('.re-row') });
  await editModal.locator('.btn-primary').first().click();
  await page.waitForTimeout(4000);

  const saved = await page.evaluate(async () => {
    const f:any=(window as any).frappe;
    const r = await f.call({method:'jewelima.jewelima.repair_api.get_repair_status', args:{state:'all'}});
    const o = (r.message.rows||[])[0];
    const i = o.items[0];
    return { wo: i.weight_out, k: i.karat, wt: i.weight, st: (i.stones||[]).length,
             ct: (i.stones||[])[0]?.ct }; });
  say('weight out saved', Math.abs(saved.wo - 11.250) < 1e-6, JSON.stringify(saved));
  say('karat saved', saved.k === '22', JSON.stringify(saved));
  say('weight in saved', Math.abs(saved.wt - 10.750) < 1e-6, JSON.stringify(saved));
  say('stone saved from Status', saved.st >= 1 && Math.abs(saved.ct - 0.075) < 1e-6, JSON.stringify(saved));
  console.log('  errors: ' + ([...new Set(errs)].join(' ; ') || 'none'));
});
