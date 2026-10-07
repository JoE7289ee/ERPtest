// Outside Orders: ticks with a select-all, the foot of the table follows the ticks, and the Pending PDF.
// Run api8002/oo_pending_2026_10_07.py first — it makes the four ZZT orders (48 lines) this spec reads.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_oo_pending --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('outside orders: ticks, selected totals, pending pdf', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // the PDF call is answered here: what was posted, and what came back
  const posted: Record<string, string>[] = [];
  const pdfs: { type: string; head: string; size: number }[] = [];
  await context.route('**/api/method/jewelima.jewelima.outside_orders.pending_pdf', async (route) => {
    posted.push(Object.fromEntries(new URLSearchParams(route.request().postData() || '')));
    const resp = await route.fetch();
    const body = await resp.body();
    pdfs.push({ type: resp.headers()['content-type'] || '', head: body.subarray(0, 5).toString(), size: body.length });
    await route.fulfill({ response: resp, body });
  });
  await page.goto('/desk/outside-orders');
  const p = page.locator('#page-outside-orders');
  const rows = p.locator('.oo-t tbody tr[data-n]');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(48);
  const foot = p.locator('.oo-t tbody tr.tot');
  const all = p.locator('.oo-all');
  await expect(foot).toContainText(`Total — ${n} order(s)`);
  const whole = (await foot.locator('td.n').first().innerText()).split('\n')[0].trim();

  // two ticks: the foot is theirs, and a tick does not open the line
  const gross = async (i: number) => parseFloat((await rows.nth(i).locator('td.n').nth(1).innerText()).split('\n')[0]) || 0;
  const want = (await gross(0)) + (await gross(1));
  await rows.nth(0).locator('td.ck').click({ position: { x: 3, y: 3 } });      // the cell, not the box itself
  await rows.nth(1).locator('.oo-ck').click();
  await expect(page.locator('.modal.show')).toHaveCount(0);
  await expect(foot).toContainText(`Selected — 2 of ${n}`);
  expect(parseFloat((await foot.locator('td.n').first().innerText()).split('\n')[0])).toBeCloseTo(want, 3);
  await expect(rows.nth(0)).toHaveClass(/sel/);
  // the tiles on top say the same
  const tile = (k: string) => p.locator('.oo-tile', { has: page.locator('.k', { hasText: k }) });
  await expect(tile('Selected').locator('.v')).toHaveText('2');
  expect(parseFloat(await tile('Gross ordered').locator('.v').innerText())).toBeCloseTo(want, 3);
  expect(await all.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(true);
  // the same tick again takes it off
  await rows.nth(1).locator('.oo-ck').click();
  await expect(foot).toContainText(`Selected — 1 of ${n}`);

  // the box in the heading: everything, then nothing
  await all.click();
  await expect(foot).toContainText(`Selected — ${n} of ${n}`);
  expect(await rows.locator('.oo-ck:checked').count()).toBe(n);
  expect((await foot.locator('td.n').first().innerText()).split('\n')[0].trim()).toBe(whole);
  await all.click();
  await expect(foot).toContainText(`Total — ${n} order(s)`);
  expect(await rows.locator('.oo-ck:checked').count()).toBe(0);
  await expect(tile('Orders').locator('.v')).toHaveText(String(n));
  await expect(tile('Selected')).toHaveCount(0);

  // ticks that the filter hides are dropped
  await all.click();
  await p.locator('.oo-chip', { hasText: 'Received' }).click();
  await expect(foot).toContainText('Selected — 1 of 1', { timeout: 15_000 });      // the one received line of the ZZT orders
  await expect(rows).toHaveCount(1);

  // only a received line ticked: nothing to list, and nothing is asked of the server
  const btn = page.locator('.page-actions button, .page-actions .btn', { hasText: 'Pending PDF' }).first();
  await btn.click();
  await expect(page.locator('.modal.show')).toContainText('Nothing is pending in the selected lines');
  expect(posted.length).toBe(0);
  await page.locator('.modal.show .btn-modal-close').first().click();
  await expect(page.locator('.modal.show')).toHaveCount(0);
  await p.locator('.oo-chip', { hasText: 'Received' }).click();
  await expect(foot).toContainText(`Selected — 1 of ${n}`, { timeout: 15_000 });
  await all.click();           // one ticked of many: the box takes them all
  await all.click();           // and lets them all go
  await expect(foot).toContainText(`Total — ${n} order(s)`);

  // three ticked: the PDF is of those three, posted as a form into a new tab
  const names: string[] = [];
  for (const i of [2, 5, 9]) { await rows.nth(i).locator('.oo-ck').click(); names.push((await rows.nth(i).getAttribute('data-n'))!); }
  // (a browser shows the PDF in the new tab; the test's headless one saves it instead — either way it is a new tab)
  const extra = async () => { for (const pg of context.pages()) if (pg !== page) await pg.close().catch(() => {}); };
  await btn.click();
  await expect.poll(() => pdfs.length, { timeout: 60_000 }).toBe(1);
  expect(page.url()).toContain('/desk/outside-orders');
  expect(JSON.parse(posted[0].names).sort()).toEqual(names.sort());
  expect(posted[0].csrf_token).toBeTruthy();
  expect(pdfs[0].type).toContain('application/pdf');
  expect(pdfs[0].head).toBe('%PDF-');
  await extra();

  // nothing ticked: the table's filters go instead
  await all.click(); await all.click();
  await p.locator('.oo-ord', { hasText: 'ZZT No date' }).locator('.t').click();      // the order's own card
  await expect(foot).toContainText('Total — 12 order(s)', { timeout: 15_000 });
  await btn.click();
  await expect.poll(() => pdfs.length, { timeout: 60_000 }).toBe(2);
  expect(posted[1].names).toBeUndefined();
  expect(posted[1].batch).toMatch(/^OO-/);
  expect(pdfs[1].head).toBe('%PDF-');
  await extra();
  // the table still answers after a PDF: the order let go, a design searched for
  await p.locator('.oo-ord', { hasText: 'ZZT No date' }).locator('.t').click();
  await expect(foot).toContainText(`Total — ${n} order(s)`, { timeout: 15_000 });
  await p.locator('.oo-bar .q').fill(names[0]);
  await expect(foot).toContainText('Total — 1 order(s)', { timeout: 15_000 });
  expect(errors).toEqual([]);
});
