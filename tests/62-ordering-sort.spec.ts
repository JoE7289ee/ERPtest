// Sorting the ORDERING desk must ask the SERVER, over the whole backlog.
// Sorting the loaded window answers "the oldest of the 300 down the wire",
// which reads exactly like an answer about ORDERING and is not one.
import { test, expect } from '@playwright/test';

test('clicking a column sorts the whole backlog, not the loaded page', async ({ page }) => {
  // Frappe posts FORM-ENCODED, not JSON — parsing it as JSON silently yields {}
  // and every assertion about what was sent then passes or fails for the wrong
  // reason.
  const calls: Record<string, string>[] = [];
  page.on('request', (r) => {
    if (!r.url().includes('get_ordering_workstation')) return;
    const body = r.postData() || '';
    const o: Record<string, string> = {};
    new URLSearchParams(body).forEach((v, k) => { o[k] = v; });
    calls.push(o);
  });

  await page.goto('/app/ws-ordering');
  await page.waitForFunction(() => document.querySelectorAll('.od-t tbody tr').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(700);

  const before = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.od-t tbody tr td:nth-child(2)')).slice(0, 3).map((t) => (t.textContent || '').trim()));
  const callsBefore = calls.length;

  // click the Card header twice: first ascending, then descending
  await page.locator('.od-t th[data-k="name"]').click();
  await page.waitForTimeout(900);
  await page.locator('.od-t th[data-k="name"]').click();
  await page.waitForTimeout(900);

  const after = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.od-t tbody tr td:nth-child(2)')).slice(0, 3).map((t) => (t.textContent || '').trim()));
  const sortCalls = calls.slice(callsBefore);
  console.log('first cards before:', JSON.stringify(before));
  console.log('first cards after :', JSON.stringify(after));
  console.log('server calls made by the two clicks:', sortCalls.length,
    JSON.stringify(sortCalls.map((c) => ({ k: c.sort_key, d: c.sort_dir, off: c.offset }))));

  // a header click must go to the server — that is the whole fix
  expect(sortCalls.length, 'each click reloads from the server').toBe(2);
  expect(sortCalls[0].sort_key, 'it sends the column').toBe('name');
  expect(sortCalls[0].sort_dir).toBe('asc');
  expect(sortCalls[1].sort_dir, 'the second click flips it').toBe('desc');
  // and always from the top: paging on from a window sorted the old way would
  // interleave two orderings
  sortCalls.forEach((c, i) => expect(Number(c.offset) || 0, `call ${i + 1} starts at the top`).toBe(0));
  expect(after, 'the table actually reordered').not.toEqual(before);
});
