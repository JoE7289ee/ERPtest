// The books' parties and the floor's parties stay apart (8 Oct 2026): a customer or supplier marked
// `ja_accounts_only` shows in the J - Accounts pickers and nowhere on the floor, and the other way round.
// Runs on the Mac dev bench or any site (BASE_URL + SMOKE_SID). Makes customer "ZZT BOOKS HEAD" and deletes it.
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
const BASE = process.env.BASE_URL || 'http://development.localhost:8000';

test('each side sees its own parties', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: BASE }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/desk/ja-sales-invoice');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const call = (method: string, args: any = {}) => page.evaluate(([m, a]) => new Promise((res, rej) => {
    (window as any).frappe.call({ method: m, args: a, freeze: false, error: () => rej(new Error(m)) }).then((r: any) => res(r.message), () => rej(new Error(m)));
  }), [method, args] as any) as Promise<any>;
  const N = 'ZZT BOOKS HEAD';
  const gone = async () => { for (const r of await call('frappe.client.get_list', { doctype: 'Customer', filters: { name: N, ja_accounts_only: 1 }, fields: ['name'] })) await call('frappe.client.delete', { doctype: 'Customer', name: r.name }); };
  await gone();
  const like = await call('frappe.client.get_list', { doctype: 'Customer', fields: ['name', 'customer_group', 'territory'], limit_page_length: 1 });
  await call('frappe.client.insert', { doc: { doctype: 'Customer', customer_name: N, ja_accounts_only: 1, customer_group: like[0].customer_group, territory: like[0].territory } });
  const floorParty: string = like[0].name;

  // the accounts picker: type in the real party box and read what its own search brings back
  // (the dropdown is drawn outside the box, so the answer is read off the request, not the page)
  const typed = async (txt: string) => {
    const box = page.locator('.h-party input').first();
    await box.click();
    await box.fill('');
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('search_link') && (r.request().postData() || '').includes(encodeURIComponent(txt).replace(/%20/g, '+')), { timeout: 20_000 }),
      page.keyboard.type(txt, { delay: 40 }),
    ]);
    expect(resp.request().postData() || '').toContain('ja_accounts_only');
    return ((await resp.json()).message || []).map((r: any) => r.value);
  };
  expect(await typed('ZZT BOOKS')).toContain(N);
  expect(await typed(floorParty.slice(0, 6))).not.toContain(floorParty);

  // a floor picker (the search every Link control makes): the floor party, never the books' head
  const names = async (txt: string) => ((await call('frappe.desk.search.search_link', { doctype: 'Customer', txt })) || []).map((r: any) => r.value);
  expect(await names('ZZT BOOKS')).not.toContain(N);
  expect(await names(floorParty)).toContain(floorParty);

  await gone();
  expect(errors).toEqual([]);
});
