// Why a row is yellow, ON the row. The notes used to live only in the tooltip
// of whichever money cell they belonged to, so "N rows carry notes" was a
// number nobody could act on without hunting for it.
import { test, expect } from '@playwright/test';

test('a flagged row carries its notes on a line underneath', async ({ page }) => {
  // resume a saved lot, exactly as the Saved Imports page hands it over
  await page.goto('/app/saved-imports');
  await page.waitForFunction(() => document.querySelectorAll('.si-resume').length > 0, undefined, { timeout: 60_000 });
  // A lot that actually flags something. OFI-0168 flags harder (48/48) but does
  // not pass the page's own readyCheck, so it never reaches the export step —
  // OFI-0170 does, and against PCH-0038 its one piece raises three notes:
  // no diamond rows, no HALLMARKING price, IGI not priced.
  const SESSION = 'OFI-0170', CHART = 'PCH-0038';
  await page.locator(`.si-resume[data-name="${SESSION}"]`).click();
  await page.waitForFunction(() => document.querySelectorAll('.of-t tbody tr').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(900);

  // the Price bar lives on the EXPORT step, not on Prep
  await page.locator('.of-goexport').click();
  await page.waitForTimeout(900);

  // the chart picker is a Frappe Link control, so set it through the control —
  // writing .value on the wrapper div does nothing
  const chart = await page.evaluate((c) => {
    const inp = document.querySelector('.of-chart input') as HTMLInputElement;
    inp.value = c;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return c;
  }, CHART);
  await page.evaluate(() => {
    const inp = document.querySelector('.of-rate input') as HTMLInputElement;
    if (inp) { inp.value = '9000'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(600);
  await page.locator('.of-price').click();
  await page.waitForTimeout(3000);

  const r = await page.evaluate(() => {
    const flagged = document.querySelectorAll('.of-t tbody tr.of-flagged').length;
    const notes = Array.from(document.querySelectorAll('.of-t tbody tr.of-note'));
    const cols = document.querySelectorAll('.of-t thead th').length;
    // each note row must span the whole table, and sit right under its own row
    const spans = notes.map((n) => Number((n.querySelector('td') as HTMLElement).getAttribute('colspan')));
    const adjacency = notes.every((n) => (n.previousElementSibling as HTMLElement)?.classList.contains('of-flagged'));
    return { flagged, notes: notes.length, cols, spans: Array.from(new Set(spans)), adjacency,
      sample: notes.slice(0, 3).map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)) };
  });
  console.log(`chart ${chart} | flagged rows ${r.flagged} | note lines ${r.notes}`);
  console.log(`table has ${r.cols} columns, notes span ${JSON.stringify(r.spans)}`);
  r.sample.forEach((t) => console.log('   ' + t));

  expect(r.flagged, 'this lot flags something to look at').toBeGreaterThan(0);
  expect(r.notes, 'one note line per flagged row').toBe(r.flagged);
  expect(r.spans, 'the note line spans the whole table').toEqual([r.cols]);
  expect(r.adjacency, 'each note sits under the row it explains').toBe(true);

  await page.locator('.of-t tbody tr.of-flagged').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'shots/oldformat-notes.png', clip: { x: 0, y: 120, width: 1280, height: 420 } });
});
