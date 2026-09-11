import { test, expect } from '@playwright/test';

// Floor cards carry a holder now, and Transfer Holder can move it. A card on
// the floor shows PLAN weights and says so; a cancelled card, or a product away
// from stock, is still refused — by the same rule the transfer itself uses.
test('Transfer Holder moves a hold on a card still on the floor', async ({ page }) => {
  await page.goto('/app/transfer-holder');
  await page.waitForSelector('.th-scan input', { timeout: 30000 });
  await page.waitForTimeout(1200);

  // find the cards to use from the server rather than hardcoding names
  const pick = await page.evaluate(async () => {
    const q = async (filters: any, fields: string[]) => {
      const u = '/api/method/frappe.client.get_list?doctype=Order%20Bag'
        + '&filters=' + encodeURIComponent(JSON.stringify(filters))
        + '&fields=' + encodeURIComponent(JSON.stringify(fields)) + '&limit_page_length=1';
      return ((await (await fetch(u)).json()).message || [])[0] || null;
    };
    return {
      floor: await q([['is_finished', '=', 0], ['stock_status', '=', 'In Production'], ['held_by', 'is', 'set']],
        ['name', 'held_by', 'customer', 'location']),
      cancelled: await q([['stock_status', '=', 'Cancelled']], ['name']),
      away: await q([['is_finished', '=', 1], ['stock_status', 'in', ['At Certification', 'At Hallmarking', 'Stone Change']]],
        ['name', 'stock_status']),
      other: (await (await fetch('/api/method/frappe.client.get_list?doctype=Customer&limit_page_length=3&fields='
        + encodeURIComponent(JSON.stringify(['name'])))).json()).message || [],
    };
  });
  console.log('floor card :', JSON.stringify(pick.floor));
  console.log('cancelled  :', JSON.stringify(pick.cancelled));
  console.log('away piece :', JSON.stringify(pick.away));
  expect(pick.floor, 'a floor card with a holder — the backfill should have made plenty').toBeTruthy();

  const scan = async (code: string) => {
    await page.locator('.th-scan input').fill(code);
    await page.locator('.th-scan input').press('Enter');
    await page.waitForTimeout(2200);
  };
  const dismiss = async () => {
    const m = page.locator('.modal.show');
    const txt = (await m.count()) ? ((await m.last().textContent()) || '').replace(/\s+/g, ' ').trim() : '';
    if (await m.count()) await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return txt;
  };

  // refusals first: nothing should land on the list
  if (pick.cancelled) {
    await scan(pick.cancelled.name);
    const said = await dismiss();
    console.log('cancelled ->', said.slice(0, 90) || '(no dialog)');
    expect(said.toLowerCase()).toContain('cancelled');
  }
  if (pick.away) {
    await scan(pick.away.name);
    const said = await dismiss();
    console.log('away      ->', said.slice(0, 110) || '(no dialog)');
    expect(said.toLowerCase()).toContain('in stock');
  }
  expect(await page.locator('.th-rows tr .th-bar').count(), 'refused cards stay off the list').toBe(0);

  // the floor card goes on, marked floor + PLAN
  await scan(pick.floor.name);
  const row = page.locator('.th-rows tr').filter({ hasText: pick.floor.name }).first();
  const rowTxt = ((await row.textContent()) || '').replace(/\s+/g, ' ').trim();
  console.log('row       :', rowTxt);
  expect(rowTxt.toLowerCase()).toContain('floor');
  console.log('totals    :', ((await page.locator('.th-totals').textContent()) || '').replace(/\s+/g, ' ').trim());

  // move it to somebody else
  const to = (pick.other.map((c: any) => c.name).find((n: string) => n !== pick.floor.held_by));
  console.log('moving to :', to, '(from', pick.floor.held_by + ')');
  await page.locator('.th-holder input').fill(to);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.locator('.th-reason input').fill('spec — party changed while the card was being made');
  await page.locator('.th-go').click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4000);

  const after = await page.evaluate(async (nm: string) => {
    const bag = (await (await fetch('/api/method/frappe.client.get_value?doctype=Order%20Bag'
      + '&filters=' + encodeURIComponent(JSON.stringify({ name: nm }))
      + '&fieldname=' + encodeURIComponent(JSON.stringify(['held_by', 'customer', 'is_finished'])))).json()).message;
    const ht = (await (await fetch('/api/method/frappe.client.get_list?doctype=Holder%20Transfer'
      + '&filters=' + encodeURIComponent(JSON.stringify({ order_bag: nm }))
      + '&fields=' + encodeURIComponent(JSON.stringify(['name', 'from_holder', 'to_holder', 'stage']))
      + '&order_by=creation%20desc&limit_page_length=1')).json()).message || [];
    return { bag, ht: ht[0] };
  }, pick.floor.name);
  console.log('card now  :', JSON.stringify(after.bag));
  console.log('record    :', JSON.stringify(after.ht));
  expect(after.bag.held_by).toBe(to);
  expect(after.bag.customer, 'the order itself is untouched').toBe(pick.floor.customer);
  expect(after.ht.stage).toBe('Floor');
  console.log('feed      :', ((await page.locator('.th-feeditems .th-ft').first().textContent()) || '').replace(/\s+/g, ' ').trim());
});
