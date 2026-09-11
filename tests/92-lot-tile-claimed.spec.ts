import { test, expect } from '@playwright/test';

// Every tile on the Lot Selection board shows the parcel's claimed weight and
// the day it was received — checked against what the server holds, tile by tile.
const SHOTS = '/tmp/claude-501/-Users-josephdaison-learn-aumms-aumms/438b9975-b5fa-4c0d-a85c-09ecac4ded83/scratchpad';

test('board tiles show claimed weight and received date', async ({ page }) => {
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  await page.waitForTimeout(800);

  const server = await page.evaluate(async () => {
    const r = await (window as any).frappe.call({ method: 'jewelima.jewelima.api.get_stone_lots', args: { status: '' } });
    return (r.message.rows || []).map((x: any) => ({ name: x.name, claimed: x.claimed, received_on: x.received_on,
      shown: x.received_on ? (window as any).frappe.datetime.str_to_user(x.received_on) : '—' }));
  });
  const tiles = await page.locator('.ls-card').evaluateAll((cs) => cs.map((c) => ({
    name: (c.querySelector('.nm')?.textContent || '').trim(),
    labels: [...c.querySelectorAll('.head .n')].map((n) => (n.textContent || '').trim()),
    claimed: (c.querySelector('.head .b')?.textContent || '').replace(/\s+/g, '').trim(),
    received: (c.querySelector('.head .dt')?.textContent || '').trim(),
    below: [...c.querySelectorAll('.nums .n')].map((n) => (n.textContent || '').trim()),
  })));
  console.log('tiles:', tiles.length, '| server lots:', server.length);
  let checked = 0;
  for (const t of tiles) {
    const s = server.find((x: any) => x.name === t.name);
    if (!s) continue;
    const want = s.claimed ? Number(s.claimed).toFixed(3) + 'ct' : '—ct';
    console.log(`  ${t.name.padEnd(17)} claimed ${t.claimed.padEnd(11)} (server ${want}) | received ${t.received.padEnd(11)} (server ${s.shown})`);
    expect(t.labels).toEqual(['Claimed', 'Received']);
    expect(t.claimed).toBe(want);
    expect(t.received).toBe(s.shown);
    expect(t.below, 'what became of the parcel is still underneath').toEqual(['Assorted', 'Selected', 'Rejection']);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
  console.log('tiles checked against the server:', checked);
  await page.locator('.ls-grid').screenshot({ path: SHOTS + '/lot-tiles.png' });
});
