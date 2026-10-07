// Due Soon and Selection read a page at a time and say so (fixes of 7 Oct 2026, batch 5).
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_batch5 --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('Due Soon and Selection page through everything', async ({ page, context }) => {
  test.setTimeout(240_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/due-soon');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 60_000 });
  const call = (method: string, args: any = {}) => page.evaluate(([m, a]) => new Promise((res) => {
    (window as any).frappe.call({ method: m, args: a, freeze: false }).then((r: any) => res(r.message), () => res(null));
  }), [method, args] as any) as Promise<any>;
  // ---- Due Soon: every bench says its true count
  const ds = page.locator('#page-due-soon');
  await ds.locator('.dr-days-in').fill('400'); await ds.locator('.dr-days-in').dispatchEvent('change');
  await page.waitForTimeout(5000);
  const truth = await call('jewelima.jewelima.api.get_due_soon', { days: 400, limit: 500, offset: 0 });
  const heads = await ds.locator('.dr-bench .h').evaluateAll((els: any[]) => els.map((e) => [e.querySelector('b').textContent, parseInt(e.querySelector('.n').textContent, 10)]));
  for (const b of truth.benches) expect(heads.find((h: any) => h[0] === b.bench)?.[1]).toBe(b.total);
  await expect(ds.locator('.dr-total')).toContainText(String(truth.total));
  if (truth.has_more) {
    await expect(ds.locator('.dr-more')).toContainText(`500 of ${truth.total}`);
    await ds.locator('.dr-more').click(); await page.waitForTimeout(5000);
    expect(await ds.locator('.dr-t tbody tr').count()).toBe(Math.min(1000, truth.total));
  } else {
    await expect(ds.locator('.dr-more')).toHaveCount(0);
    expect(await ds.locator('.dr-t tbody tr').count()).toBe(truth.total);
  }
  // ---- Selection: the counter is the catalogue, and the rest can be loaded
  await page.goto('/desk/select-photos'); await page.waitForTimeout(6000);
  const sp = page.locator('#page-select-photos');
  const all = await call('jewelima.jewelima.api.get_selection_photos', {});
  await expect(sp.locator('.sl2-of')).toHaveText(String(all.total));
  if (all.has_more) {
    await expect(sp.locator('.sl2-next')).toContainText(`500 of ${all.total}`);
    await sp.locator('.sl2-next').click(); await page.waitForTimeout(5000);
    expect(await sp.locator('.sl2-card:not(.sl2-next)').count()).toBe(Math.min(1000, all.total));
  }
  expect(errors).toEqual([]);
});
