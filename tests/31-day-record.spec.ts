// Day Record: nightly day sheet — rebuild API, doc fields, 4-page print format.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

const DATE = '2026-07-13';

test('rebuild + open a Day Record; Day Sheet print renders 4 pages', async ({ page }) => {
  await gotoApp(page, 'usage'); // any desk page for the session
  const name = await frappeCall(page, 'jewelima.jewelima.doctype.day_record.day_record.rebuild_day_record', { date: DATE });
  expect(name).toBe(DATE);
  const doc = await frappeCall(page, 'frappe.client.get', { doctype: 'Day Record', name: DATE });
  expect(doc.date).toBe(DATE);
  expect(typeof doc.closing_pure_gold_g).toBe('number');
  expect(doc.lines.length).toBeGreaterThan(0);

  // the print view carries all four page markers
  await page.goto(`/printview?doctype=Day%20Record&name=${DATE}&format=Day%20Sheet&no_letterhead=1`);
  const body = await page.locator('body').innerText();
  expect(body).toContain('Day Sheet');
  expect(body).toContain('page 1 of 4');
  expect(body).toContain('page 4 of 4');
  expect(body.toUpperCase()).toContain('CLOSING POSITIONS');
  await page.screenshot({ path: 'test-results/day-sheet.png', fullPage: true });
});
