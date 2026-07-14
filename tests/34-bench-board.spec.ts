// Bench boards: per-bench info page — KPIs, stock, generic filter bar + sort.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('bench-casting board: KPIs, stock, filter, sort', async ({ page }) => {
  await gotoApp(page, 'bench-casting');
  await expect(page.locator('.bb-kpi')).toContainText('Cards', { timeout: 15_000 });
  await expect(page.locator('.bb-kpi')).toContainText('Pieces');
  await expect(page.locator('.bb-stock')).toContainText('Pure Gold');
  // the generic filter bar exists with all fields
  await expect(page.locator('.fb-field option')).toContainText(['Party', 'Salesman', 'Design Type', 'Order Type', 'Due Date']);

  const before = await frappeCall(page, 'jewelima.jewelima.api.get_bench_board', { bench: 'CASTING' });
  const total = before.rows.length;
  if (total) {
    // add a Party filter for the first card's party -> table narrows, chip shows
    const party = before.rows.find((r: any) => r.party)?.party;
    if (party) {
      await page.locator('.fb-field').selectOption('party');
      await page.locator('.fb-val select').selectOption(party);
      await page.locator('.fb-add').click();
      await expect(page.locator('.fb-chip')).toContainText(party);
      const shown = await page.locator('table.bb-t tbody tr').count();
      const expected = before.rows.filter((r: any) => r.party === party).length;
      expect(shown).toBe(expected);
      // remove the chip -> back to all
      await page.locator('.fb-chip .x').first().click();
      await expect(page.locator('table.bb-t tbody tr')).toHaveCount(total);
    }
  }
  // sort by Qty then flip
  await page.locator('th[data-sort="qty"]').click();
  await expect(page.locator('th[data-sort="qty"] .arr')).toHaveText('▲');
  await page.locator('th[data-sort="qty"]').click();
  await expect(page.locator('th[data-sort="qty"] .arr')).toHaveText('▼');
  await page.screenshot({ path: 'test-results/bench-board.png' });
});

test('date filter narrows by due date', async ({ page }) => {
  await gotoApp(page, 'bench-casting');
  await expect(page.locator('.bb-kpi')).toContainText('Cards', { timeout: 15_000 });
  await page.locator('.fb-field').selectOption('due');
  await page.locator('.fb-op').selectOption('before');
  await page.locator('.fb-val input[type="date"]').fill('2020-01-01'); // nothing before this
  await page.locator('.fb-add').click();
  await expect(page.locator('.bb-none, table.bb-t tbody tr')).toBeVisible();
  const rows = await page.locator('table.bb-t tbody tr').count();
  expect(rows).toBe(0);
});

test('Columns button hides/shows table columns (per-user)', async ({ page }) => {
  await gotoApp(page, 'bench-casting');
  await page.evaluate(() => localStorage.removeItem('jw-bench-cols'));
  await page.reload();
  await expect(page.locator('table.bb-t thead th', { hasText: 'Salesman' })).toBeVisible({ timeout: 15_000 });
  await page.locator('.page-actions button', { hasText: 'Columns' }).click();
  // untick Salesman -> column disappears; choice persists to localStorage
  await page.locator('.modal:visible input.bb-colcb[value="salesman"]').uncheck();
  await expect(page.locator('table.bb-t thead th', { hasText: 'Salesman' })).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('jw-bench-cols'));
  expect(saved).not.toContain('salesman');
  await page.keyboard.press('Escape');
  // switch benches -> the hidden column stays hidden
  await gotoApp(page, 'bench-grinding');
  await expect(page.locator('table.bb-t thead th, .bb-none').first()).toBeVisible({ timeout: 15_000 });
  const heads = await page.locator('table.bb-t thead th').allInnerTexts();
  expect(heads.join(' ').toUpperCase()).toContain('CARD'); // table rendered
  expect(heads.join(' ').toUpperCase()).not.toContain('SALESMAN');
});

test('stone bucket columns can be turned on + filtered by ct', async ({ page }) => {
  await gotoApp(page, 'bench-casting');
  await page.evaluate(() => localStorage.removeItem('jw-bench-cols'));
  await page.reload();
  await expect(page.locator('table.bb-t thead th').first()).toBeVisible({ timeout: 15_000 });
  // buckets are OFF by default
  let heads = (await page.locator('table.bb-t thead th').allInnerTexts()).join(' ');
  expect(heads).not.toContain('DMD');
  // turn DMD on via Columns
  await page.locator('.page-actions button', { hasText: 'Columns' }).click();
  await page.locator('.modal:visible input.bb-colcb[value="dmd"]').check();
  await page.keyboard.press('Escape');
  heads = (await page.locator('table.bb-t thead th').allInnerTexts()).join(' ');
  expect(heads).toContain('DMD');
  // DMD is also a numeric filter field now
  await expect(page.locator('.fb-field option')).toContainText(['DMD (ct)']);
});
