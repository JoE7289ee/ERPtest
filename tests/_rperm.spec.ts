import { test } from '@playwright/test';
const say = (n: string, c: boolean, d = '') => console.log((c?'  PASS  ':'  FAIL  ') + n + (d && !c ? '   -> '+d : ''));

const ALLOWED = ['new-repair-order','repair-status','repair-billing','repair-masters'];
const DENIED  = ['stock-transfer','melt-gold','workstations','total-gold','place-order'];

test('repair-only login sees repair and nothing else', async ({ page }) => {
  test.setTimeout(300_000);
  const errs: string[] = [];
  page.on('console', m => { if (m.type()==='error' && !/socket\.io/i.test(m.text())) errs.push(m.text().slice(0,80)); });

  const who = await page.goto('/app/repair-status').then(async () => {
    await page.waitForTimeout(5000);
    return page.evaluate(() => ({ u: (window as any).frappe.session.user,
      roles: (window as any).frappe.user_roles })); });
  console.log('  logged in as: ' + who.u + ' roles=' + JSON.stringify(who.roles));

  for (const p of ALLOWED) {
    await page.goto('/app/' + p); await page.waitForTimeout(4000);
    const route = await page.evaluate(() => (window as any).frappe.get_route_str());
    say(`can open ${p}`, route === p, 'landed on ' + route);
  }
  for (const p of DENIED) {
    await page.goto('/app/' + p); await page.waitForTimeout(4000);
    const route = await page.evaluate(() => (window as any).frappe.get_route_str());
    say(`blocked from ${p}`, route !== p, 'reached ' + route);
  }
  console.log('  errors: ' + (errs.join(' ; ') || 'none'));
});

test('status page print', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/app/repair-status');
  await page.waitForSelector('.rs-pill', { timeout: 30_000 });
  const btn = page.locator('button, .btn, a').filter({ hasText: /Print/i });
  say('a print action exists', await btn.count() >= 1, String(await btn.count()));
  if (await btn.count()) {
    let opened = false;
    page.on('popup', () => { opened = true; });
    await page.evaluate(() => { (window as any).print = () => { (window as any).__printed = true; }; });
    await btn.first().click();
    await page.waitForTimeout(3000);
    const printed = await page.evaluate(() => !!(window as any).__printed);
    say('print fires without error', printed || opened, `printed=${printed} popup=${opened}`);
  }
});
