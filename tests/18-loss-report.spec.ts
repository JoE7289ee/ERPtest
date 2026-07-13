// Loss Report: -LOSS warehouses matrix with pure-gold math.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('loss report matches API; pure math checks out', async ({ page }) => {
  await gotoApp(page, 'loss-report');
  const api = await frappeCall(page, 'jewelima.jewelima.api.get_loss_report');
  expect(api.totals.materials).toBeGreaterThan(0);

  // summary cards
  const cards = page.locator('.lr-card .v');
  await expect(cards.nth(0)).toHaveText(`${api.totals.gross.toFixed(3)} g`);
  await expect(cards.nth(1)).toHaveText(`${api.totals.pure.toFixed(3)} g`);
  await expect(cards.nth(2)).toHaveText(String(api.totals.warehouses));
  await expect(cards.nth(3)).toHaveText(String(api.totals.materials));

  // headers: one column per loss warehouse + Material + Total
  await expect(page.locator('table.lr-tbl thead th')).toHaveCount(api.warehouses.length + 2);
  await expect(page.locator('table.lr-tbl tbody tr')).toHaveCount(api.items.length);

  // internal consistency: cells == warehouse gross == totals; pure = qty x purity
  let cg = 0, cp = 0;
  for (const r of api.items) {
    const rowSum = Object.values(r.cells as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
    expect(rowSum).toBeCloseTo(r.total, 2);
    expect(r.pure).toBeCloseTo(r.total * r.purity / 100, 2);
    cg += r.total; cp += r.pure;
  }
  expect(cg).toBeCloseTo(api.totals.gross, 2);
  expect(cp).toBeCloseTo(api.totals.pure, 2);
  const whg = api.warehouses.reduce((s: number, w: any) => s + w.gross, 0);
  const whp = api.warehouses.reduce((s: number, w: any) => s + w.pure, 0);
  expect(whg).toBeCloseTo(api.totals.gross, 2);
  expect(whp).toBeCloseTo(api.totals.pure, 2);

  // per-warehouse pure shows in its header
  const w0 = api.warehouses[0];
  const th = page.locator('table.lr-tbl thead th', { hasText: w0.label }).first();
  await expect(th).toContainText(`${w0.pure.toFixed(3)} g`);

  // search narrows
  await page.locator('.lr-search').fill('22KYG');
  await expect(page.locator('table.lr-tbl tbody tr')).toHaveCount(
    api.items.filter((r: any) => r.item.includes('22KYG')).length);
  await page.locator('.lr-search').fill('');
  await page.screenshot({ path: 'test-results/loss-report.png' });
});
