// Scratch: open every Jewelima desk page on the :8002 test copy and record what breaks.
import { test } from '@playwright/test';
import fs from 'fs';

const WHO = process.env.SMOKE_WHO || 'Administrator';
const OUT = process.env.SMOKE_OUT || 'smoke-admin.json';
test.use({ video: 'off' });

test(`smoke every page as ${WHO}`, async ({ page, context }) => {
  test.setTimeout(3 * 3600_000);
  if (process.env.SMOKE_SID) await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID, url: process.env.BASE_URL! }]);
  await page.goto('/desk?desk=1');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const info = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const pages = await f.xcall('frappe.client.get_list', { doctype: 'Page', filters: { module: 'Jewelima' }, fields: ['name'], limit_page_length: 0 }).catch(() => null);
    const side: string[] = [];
    try { for (const it of (f.boot.workspace_sidebar_item?.jewelima?.items || [])) if (it.link_type === 'Page' && it.link_to) side.push(it.link_to); } catch (e) {}
    return { user: f.session.user, pages: pages ? pages.map((p: any) => p.name) : null, allowed: Object.keys(f.boot.page_info || {}), side };
  });
  let list: string[] = (process.env.SMOKE_PAGES ? process.env.SMOKE_PAGES.split(',') : (info.pages || info.side));
  if (WHO !== 'Administrator' && !process.env.SMOKE_PAGES) list = JSON.parse(fs.readFileSync('smoke-pages-' + WHO + '.json', 'utf8'));
  const results: any[] = [];
  let cur: any = null;
  page.on('console', (m) => { if (cur && m.type() === 'error') cur.console.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => { if (cur) cur.pageerror.push(String(e.message || e).slice(0, 300)); });
  page.on('response', async (r) => {
    if (!cur) return;
    const u = r.url();
    if (r.status() >= 400 && !/\.(png|jpg|jpeg|svg|woff2?|ico|map)(\?|$)/.test(u)) {
      let body = '';
      try { body = (await r.text()).slice(0, 400); } catch (e) {}
      cur.http.push({ s: r.status(), u: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 160), b: body });
    }
  });
  for (const name of list) {
    cur = { page: name, console: [], pageerror: [], http: [], msg: [], links: [] };
    const t0 = Date.now();
    try {
      await page.goto('/desk/' + name, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => { cur.slow = true; });
      await page.waitForTimeout(700);
      const snap = await page.evaluate(() => {
        const vis = (e: Element) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed';
        const msgs = [...document.querySelectorAll('.modal.show .msgprint, .modal.show .modal-body')].filter(vis).map((e) => (e.textContent || '').trim().slice(0, 260));
        const title = [...document.querySelectorAll('.modal.show .modal-title')].map((e) => (e.textContent || '').trim());
        const body = (document.querySelector('.page-container:not([style*="display: none"]) .layout-main-section, .page-container:not([style*="display: none"])') as HTMLElement);
        const text = (body?.innerText || '').trim();
        const links = [...document.querySelectorAll('.page-container:not([style*="display: none"]) a[href]')].map((a) => a.getAttribute('href') || '').filter((h) => /^\/(app|desk)\//.test(h));
        const np = !!document.querySelector('.page-container:not([style*="display: none"]) .not-permitted, .page-not-found');
        return { msgs, title, len: text.length, head: text.slice(0, 120).replace(/\s+/g, ' '), links: [...new Set(links)], route: (window as any).frappe.get_route_str(), np };
      });
      Object.assign(cur, { msg: snap.msgs, mtitle: snap.title, len: snap.len, head: snap.head, links: snap.links, route: snap.route, np: snap.np });
      // close whatever dialog opened
      await page.evaluate(() => { try { (window as any).cur_dialog && (window as any).cur_dialog.hide(); document.querySelectorAll('.modal.show .btn-modal-close').forEach((b: any) => b.click()); } catch (e) {} });
    } catch (e: any) { cur.fail = String(e.message || e).slice(0, 200); }
    cur.ms = Date.now() - t0;
    results.push(cur);
    fs.writeFileSync(OUT, JSON.stringify({ who: info.user, results }, null, 1));
  }
  cur = null;
});
