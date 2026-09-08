import { test } from '@playwright/test';
const say = (n: string, c: boolean, d='') => console.log((c?'  PASS  ':'  FAIL  ')+n+(d&&!c?'   -> '+d:''));
test('JW CAM in the browser', async ({ page }) => {
  test.setTimeout(300_000);
  const errs: string[] = [];
  page.on('console', m => { if (m.type()==='error' && !/socket\.io|403|FORBIDDEN/i.test(m.text())) errs.push(m.text().slice(0,90)); });

  await page.goto('/app/ws-cam'); await page.waitForTimeout(6000);
  let r = await page.evaluate(() => ({ route:(window as any).frappe.get_route_str(),
    user:(window as any).frappe.session.user, roles:(window as any).frappe.user_roles }));
  console.log('  user: ' + r.user + ' roles=' + JSON.stringify(r.roles));
  say('CAM workstation opens', r.route === 'ws-cam', r.route);

  await page.goto('/app/transfer-order-bag'); await page.waitForTimeout(6000);
  r = await page.evaluate(() => ({ route:(window as any).frappe.get_route_str() }));
  say('transfer page opens', r.route === 'transfer-order-bag', r.route);

  // the issue-right-after strip must not be usable
  const tp = await page.evaluate(() => {
    const el = document.querySelector('.tp-on') as HTMLElement;
    if (!el) return 'absent';
    const box = el.closest('label,div') as HTMLElement;
    const cs = box ? getComputedStyle(box) : null;
    return (cs && (cs.display==='none'||cs.visibility==='hidden')) ? 'hidden' : 'VISIBLE';
  });
  say('"Issue right after transfer" is not offered', tp !== 'VISIBLE', tp);

  // the destination dropdown must offer only WAXING and CAD
  const dests = await page.evaluate(async () => {
    const f:any=(window as any).frappe;
    const r = await f.call({ method:'jewelima.jewelima.api.allowed_to_locations',
      args:{ from_location:'CAM' }});
    return r.message; });
  say('destinations are WAXING and CAD only', JSON.stringify([...dests].sort())==='["CAD","WAXING"]',
      JSON.stringify(dests));

  // blocked pages
  for (const p of ['ws-waxing','ws-filing','stock-transfer','workstations','place-order']) {
    await page.goto('/app/'+p); await page.waitForTimeout(3500);
    const route = await page.evaluate(() => (window as any).frappe.get_route_str());
    say(`blocked from ${p}`, route !== p, 'reached '+route);
  }
  console.log('  errors: ' + ([...new Set(errs)].join(' ; ') || 'none'));
});
