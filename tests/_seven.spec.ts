import { test } from '@playwright/test';
const say = (n: string, c: boolean, d='') => console.log((c?'  PASS  ':'  FAIL  ')+n+(d&&!c?'   -> '+d:''));
const errs: string[] = [];
function watch(p:any,t:string){ p.on('console',(m:any)=>{if(m.type()==='error'&&!/socket\.io/i.test(m.text()))errs.push(t+': '+m.text().slice(0,90));});
  p.on('response',(r:any)=>{if(r.url().includes('/api/')&&r.status()>=400)errs.push(t+': HTTP'+r.status());}); }

test('1+2 sidebar rename and intake width', async ({ page }) => {
  test.setTimeout(180_000); watch(page,'a');
  await page.goto('/app/new-repair-order'); await page.waitForTimeout(6000);
  const label = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.sidebar-item-label, .desk-sidebar-item, a, span')]
      .map(e=>e.textContent?.trim()).filter(t=>t && /^repair$/i.test(t));
    return el.slice(0,3); });
  say('sidebar section reads "Repair" not "REPAIR"',
      label.some(t=>t==='Repair') || !label.some(t=>t==='REPAIR'), JSON.stringify(label));
  const w = await page.evaluate(() => {
    const el = document.querySelector('.nr-wrap') as HTMLElement;
    const c = document.querySelector('.layout-main-section') as HTMLElement;
    return { wrap: el?.getBoundingClientRect().width, cont: c?.getBoundingClientRect().width }; });
  say('intake uses full width', !!w.wrap && !!w.cont && w.wrap >= w.cont - 40, JSON.stringify(w));

  // 4+5: karat and stones on the intake row
  say('karat select on the intake row', await page.locator('select.nr-kt').count() >= 1);
  say('stones cell on the intake row', await page.locator('td.nr-st').count() >= 1);
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('a')).join(' ; ')||'none'));
});

test('3 stones: multiple rows, Enter, typed carats win', async ({ page }) => {
  test.setTimeout(240_000); watch(page,'b');
  await page.goto('/app/repair-billing');
  await page.waitForSelector('.rb-card2', { timeout: 60_000 });
  await page.locator('.rb-card2').first().click();
  await page.waitForSelector('table.rb-t', { timeout: 30_000 });
  await page.locator('td.rb-st').first().click();
  await page.waitForSelector('.modal.show .sd-t', { timeout: 15_000 });

  // typing in the last row should open another
  await page.locator('.modal.show .sd-q').first().fill('EF');
  await page.waitForTimeout(400);
  say('typing in the last row opens the next', await page.locator('.modal.show .sd-t tbody tr').count() === 2,
      String(await page.locator('.modal.show .sd-t tbody tr').count()));

  // Enter must NOT close the dialog
  await page.locator('.modal.show .sd-q').first().press('Enter');
  await page.waitForTimeout(600);
  say('Enter keeps the dialog open', await page.locator('.modal.show .sd-t').count() === 1);

  // fill three stones, carats typed AFTER pcs must survive
  const rowset = async (i:number, q:string, s:string, p:string, c:string) => {
    await page.locator('.modal.show .sd-q').nth(i).fill(q);
    await page.locator('.modal.show .sd-s').nth(i).fill(s);
    await page.locator('.modal.show .sd-p').nth(i).fill(p);
    await page.locator('.modal.show .sd-c').nth(i).fill(c);
  };
  await rowset(0,'EF','OOO-OO','2','0.090');
  await rowset(1,'VS','OO-O','4','0.020');
  await rowset(2,'SI','O-1','6','0.030');
  const vals = await page.evaluate(() => [...document.querySelectorAll('.modal.show .sd-t tbody tr')]
    .map(tr => (tr.querySelector('.sd-c') as HTMLInputElement)?.value).filter(v=>v));
  say('typed carats are not overwritten', JSON.stringify(vals.slice(0,3)) === '["0.090","0.020","0.030"]',
      JSON.stringify(vals));
  await page.locator('.modal.show .btn-primary').click();
  await page.waitForTimeout(3000);
  const saved = await page.evaluate(async () => {
    const f:any=(window as any).frappe;
    const r = await f.call({method:'jewelima.jewelima.repair_api.list_open_repairs'});
    const b = await f.call({method:'jewelima.jewelima.repair_api.get_repair_for_billing',
      args:{repair_order:r.message[0].repair_order}});
    return (b.message.items[0].stones||[]); });
  say('all three saved with the typed carats', saved.length===3 && Math.abs(saved[0].ct-0.090)<1e-6,
      JSON.stringify(saved));
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('b')).join(' ; ')||'none'));
});

test('7 billing colour cues', async ({ page }) => {
  test.setTimeout(180_000); watch(page,'c');
  await page.goto('/app/repair-billing');
  await page.waitForSelector('.rb-card2', { timeout: 60_000 });
  await page.locator('.rb-card2').first().click();
  await page.waitForSelector('table.rb-t', { timeout: 30_000 });
  say('pieces with no weight out are flagged', await page.locator('.rb-flag2').count() > 0,
      String(await page.locator('.rb-flag2').count()));
  say('their weight box is marked', await page.locator('td.rb-miss').count() > 0);
  say('those rows are tinted', await page.locator('tr.rb-warn').count() > 0);
  // once weighed, the warning clears
  await page.locator('input.rb-out').first().fill('10.500');
  await page.locator('input.rb-out').first().dispatchEvent('change');
  await page.waitForTimeout(1200);
  const firstFlag = await page.locator('tbody tr[data-r]').first().locator('.rb-flag2').count();
  say('the flag clears once a weight is entered', firstFlag === 0, String(firstFlag));
  console.log('  errors: ' + (errs.filter(e=>e.startsWith('c')).join(' ; ')||'none'));
});
