import { test, expect } from '@playwright/test';

// The approvals folded back into Repack Stock, and the record moved to
// Stock > Records > Stone Repack History.
test('Repack Stock carries the requests table, and the history page reads them back', async ({ page }) => {
  await page.goto('/app/repack-stock');
  await page.waitForSelector('.rp2-panel', { timeout: 30000 });
  await page.waitForTimeout(1500);

  console.log('panel head :', (await page.locator('.rp2-panel .hd').textContent())!.replace(/\s+/g, ' ').trim());
  const tabs = await page.locator('.rp2-tab').allTextContents();
  console.log('tabs       :', tabs.join(' / '));
  expect(tabs.map((t) => t.trim())).toEqual(['Pending', 'Recent']);

  const body = (await page.locator('.rp2-body').textContent())!.replace(/\s+/g, ' ').trim();
  console.log('pending    :', body.slice(0, 110));

  await page.locator('.rp2-tab', { hasText: 'Recent' }).click();
  await page.waitForTimeout(1500);
  const rows = await page.locator('.rp2-reqtbl tbody tr').count();
  console.log('recent rows:', rows);
  if (rows) {
    for (const r of await page.locator('.rp2-reqtbl tbody tr').all())
      console.log('   ', (await r.textContent())!.replace(/\s+/g, ' ').trim().slice(0, 95));
  }

  // the old page must be gone
  const gone = await page.evaluate(async () => {
    const r = await fetch('/api/method/frappe.client.get_count?doctype=Page&filters=' +
      encodeURIComponent(JSON.stringify({ name: 'repack-requests' })));
    return (await r.json()).message;
  });
  console.log('old page rows in DB:', gone);
  expect(gone).toBe(0);

  // HISTORY button lands on the record
  await page.locator('.rp2-hist').click();
  await page.waitForSelector('.rh-tiles', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const tiles: Record<string, string> = {};
  for (const t of await page.locator('.rh-tile').all())
    tiles[(await t.locator('.k').textContent())!.trim()] = (await t.locator('.v').textContent())!.replace(/\s+/g, '').trim();
  console.log('history KPI:', JSON.stringify(tiles));
  expect(Object.keys(tiles).join('|').toLowerCase()).toContain('repacked');

  await page.locator('.rh-pill', { hasText: 'All' }).click();
  await page.waitForTimeout(1500);
  const hrows = await page.locator('.rh-t tbody tr').count();
  console.log('history rows (all time):', hrows);
  for (const r of (await page.locator('.rh-t tbody tr').all()).slice(0, 4))
    console.log('   ', (await r.textContent())!.replace(/\s+/g, ' ').trim().slice(0, 110));
});
