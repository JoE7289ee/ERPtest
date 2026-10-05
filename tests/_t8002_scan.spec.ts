// Scratch: on every page that has a scan box, scan a floor card, a finished piece, a sold piece
// and nonsense, and record script errors and server crashes (a polite refusal is fine).
import { test } from '@playwright/test';
import fs from 'fs';
test.use({ video: 'off' });
const CODES = (process.env.SCAN_CODES || 'E7617.3.1,E7576.10.1,E7617.19.1,ZZZ-NOPE').split(',');
test('scan poke', async ({ page, context }) => {
  test.setTimeout(3 * 3600_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  await page.goto('/desk?desk=1');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const pages: string[] = await page.evaluate(async () => (await (window as any).frappe.xcall('frappe.client.get_list', { doctype: 'Page', filters: { module: 'Jewelima' }, fields: ['name'], limit_page_length: 0 })).map((p: any) => p.name));
  const out: any[] = []; let cur: any = null;
  page.on('pageerror', (e) => { if (cur) cur.js.push(String(e.message || e).slice(0, 260)); });
  page.on('response', async (r) => { if (cur && r.status() >= 500) { let b = ''; try { b = (await r.text()).slice(0, 500); } catch (e) {} cur.http.push({ s: r.status(), u: r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0].slice(0, 120), b }); } });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  for (const name of pages) {
    await page.goto('/desk/' + name, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const sel = await page.evaluate(() => {
      const root = document.querySelector('.page-container:not([style*="display: none"])') || document;
      const ins = [...root.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')] as HTMLInputElement[];
      const vis = ins.filter((i) => i.offsetParent !== null && !i.disabled && !i.readOnly);
      const hit = vis.find((i) => /scan|card|barcode|bag|piece/i.test((i.placeholder || '') + ' ' + (i.getAttribute('data-fieldname') || '') + ' ' + (i.className || '') + ' ' + (i.closest('.frappe-control')?.textContent || '').slice(0, 60)));
      if (!hit) return null;
      hit.setAttribute('data-t8002', '1'); return '[data-t8002="1"]';
    });
    if (!sel) continue;
    for (const code of CODES) {
      cur = { page: name, code, js: [], http: [], msg: '' };
      try {
        const box = page.locator(sel).first();
        await box.click({ timeout: 4000 }); await box.fill(code, { timeout: 4000 }); await box.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(500);
        cur.msg = await page.evaluate(() => [...document.querySelectorAll('.modal.show .modal-title, .modal.show .msgprint')].map((e) => (e.textContent || '').trim().slice(0, 140)).join(' | '));
        await page.evaluate(() => { document.querySelectorAll('.modal.show .btn-modal-close').forEach((b: any) => b.click()); try { (window as any).cur_dialog && (window as any).cur_dialog.hide(); } catch (e) {} });
        await page.waitForTimeout(250);
      } catch (e: any) { cur.fail = String(e.message || e).split('\n')[0].slice(0, 160); }
      out.push(cur);
      fs.writeFileSync('scan-poke.json', JSON.stringify(out, null, 1));
      if (cur.fail) break;
    }
  }
  cur = null;
});
