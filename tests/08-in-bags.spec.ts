// In Bags (Reports > Stock Reports): material x bench matrix of the In Bags pool.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('in-bags matrix matches the API and filters work', async ({ page }) => {
  await gotoApp(page, 'in-bags');
  const api = await frappeCall(page, 'jewelima.jewelima.api.get_in_bags_matrix');
  expect(api.totals.materials).toBeGreaterThan(0);

  // summary cards carry the API totals
  const cards = page.locator('.ib-card .v');
  await expect(cards.nth(0)).toHaveText(`${api.totals.gold.toFixed(3)} g`);
  await expect(cards.nth(1)).toHaveText(`${api.totals.stones.toFixed(3)} ct`);
  await expect(cards.nth(2)).toHaveText(String(api.totals.benches));
  await expect(cards.nth(3)).toHaveText(String(api.totals.materials));

  // header: one column per bench + Material + Total
  await expect(page.locator('table.ib-tbl thead th')).toHaveCount(api.locations.length + 2);
  // every row present, first row's total matches
  await expect(page.locator('table.ib-tbl tbody tr')).toHaveCount(api.items.length);
  const first = api.items[0];
  const row0 = page.locator('table.ib-tbl tbody tr').first();
  await expect(row0).toContainText(first.item);
  await expect(row0.locator('td.tot')).toContainText(first.total.toFixed(3));

  // status chips: sum of chip card-counts per bench == cards the API reports
  for (const loc of api.locations) {
    const chips = Object.values(loc.statuses as Record<string, any>).reduce((s: number, v: any) => s + v.cards, 0);
    const th = page.locator('table.ib-tbl thead th', { hasText: loc.label }).first();
    const shown = await th.locator('.ib-st').allInnerTexts();
    const shownSum = shown.reduce((s, t) => s + (parseInt(t.replace(/\D/g, ''), 10) || 0), 0);
    expect(shownSum).toBe(chips);
  }
  // every status the API reports renders as its own chip class
  const CLS: Record<string, string> = { 'In Queue': 'q', 'On Hold': 'h', Issued: 'i', Ongoing: 'o', Receipted: 'r', Completed: 'c' };
  const seen = new Set<string>(api.locations.flatMap((l: any) => Object.keys(l.statuses)));
  for (const st of seen) {
    await expect(page.locator(`.ib-st.${CLS[st] || 'q'}`).first()).toBeVisible();
  }

  // Stones pill filters to stone rows only + bucket sub-pills appear
  await page.locator('.ib-pill', { hasText: 'Stones' }).click();
  const stones = api.items.filter((r: any) => r.is_stone);
  await expect(page.locator('table.ib-tbl tbody tr')).toHaveCount(stones.length);
  const buckets = [...new Set(stones.map((r: any) => r.bucket))];
  await expect(page.locator('.ib-subrow .ib-sub')).toHaveCount(buckets.length + 1); // + All
  // drill into the first bucket present
  const bucket = String(buckets[0]);
  await page.locator(`.ib-sub[title="${bucket}"]`).click();
  await expect(page.locator('table.ib-tbl tbody tr'))
    .toHaveCount(stones.filter((r: any) => r.bucket === bucket).length);

  // Gold pill: sub-pills are the gold items themselves; picking one leaves one row
  await page.locator('.ib-pill', { hasText: 'Gold' }).click();
  const golds = api.items.filter((r: any) => !r.is_stone);
  await expect(page.locator('table.ib-tbl tbody tr')).toHaveCount(golds.length);
  await expect(page.locator('.ib-subrow .ib-sub')).toHaveCount(golds.length + 1);
  const goldItem = golds[0].item;
  await page.locator(`.ib-sub[title="${goldItem}"]`).click();
  await expect(page.locator('table.ib-tbl tbody tr')).toHaveCount(1);
  await expect(page.locator('table.ib-tbl tbody tr').first()).toContainText(goldItem);

  // search still stacks on top of the filters
  await page.locator('.ib-search').fill('zzz-no-such-material');
  await expect(page.locator('table.ib-tbl tbody tr td.ib-empty')).toBeVisible();
  await page.locator('.ib-search').fill('');

  await page.locator('.ib-pill', { hasText: 'All' }).click();
  await expect(page.locator('.ib-subrow')).toBeHidden();
  await expect(page.locator('table.ib-tbl tbody tr')).toHaveCount(api.items.length);
  // screenshot with the Stones drill-down open
  await page.locator('.ib-pill', { hasText: 'Stones' }).click();
  await page.screenshot({ path: 'test-results/in-bags.png', fullPage: false });
});

test('sidebar: Reports > Stock Reports holds Item Stock + In Bags', async ({ page }) => {
  await gotoApp(page, 'in-bags');
  const links = await page.evaluate(async () => {
    const f = (window as any).frappe;
    const r = await f.call({ method: 'frappe.client.get', args: { doctype: 'Workspace Sidebar', name: 'jewelima' } });
    return r.message.items.map((i: any) => `${i.type}:${i.label}:${i.link_to || ''}`);
  });
  const i = links.indexOf('Section Break:Stock Reports:');
  expect(i).toBeGreaterThan(-1);
  expect(links[i + 1]).toBe('Link:Item Stock:item-stock');
  expect(links[i + 2]).toBe('Link:In Bags:in-bags');
  // old direct Reports link is gone (item-stock appears exactly once)
  expect(links.filter((l: string) => l.endsWith(':item-stock')).length).toBe(1);
});
