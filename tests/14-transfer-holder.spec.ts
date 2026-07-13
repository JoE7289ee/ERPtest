// Transfer Holder (Delivery): scan pieces, totals, move reservation, paper trail.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('scan -> totals -> transfer -> holder + log updated', async ({ page }) => {
  await gotoApp(page, 'transfer-holder');
  const pieces = await frappeCall(page, 'jewelima.jewelima.api.get_certifiable_pieces');
  const two = pieces.slice(0, 2);

  for (const p of two) {
    await page.locator('.th-scan input').fill(p.order_bag);
    await page.locator('.th-scan input').press('Enter');
    await expect(page.locator(`.th-rows tr:has-text("${p.order_bag}")`)).toBeVisible();
  }
  // duplicate scan refused
  await page.locator('.th-scan input').fill(two[0].order_bag);
  await page.locator('.th-scan input').press('Enter');
  await expect(page.locator('.th-msg')).toContainText('already on the list');
  await expect(page.locator('.th-rows tr')).toHaveCount(2);

  // rows show current holder + in-stock-since with a days chip
  const d0 = await frappeCall(page, 'jewelima.jewelima.api.get_holder_piece', { barcode: two[0].order_bag });
  await expect(page.locator(`.th-rows tr:has-text("${two[0].order_bag}")`)).toContainText(d0.held_by);
  await expect(page.locator('.th-days').first()).toBeVisible();

  // bottom totals = sum of the two pieces (gross / pure)
  const d1 = await frappeCall(page, 'jewelima.jewelima.api.get_holder_piece', { barcode: two[1].order_bag });
  const gross = (d0.gross + d1.gross).toFixed(3);
  const pure = (d0.pure + d1.pure).toFixed(3);
  await expect(page.locator('.th-totals')).toContainText(`${gross} g`);
  await expect(page.locator('.th-totals')).toContainText(`${pure} g`);
  await page.screenshot({ path: 'test-results/transfer-holder.png' });

  // transfer to CHEMMANUR with a reason
  await page.locator('.th-holder input').fill('CHEMMANUR');
  await page.getByRole('option', { name: /CHEMMANUR/ }).first().click();
  await page.locator('.th-reason input').fill('sale delayed - moving');
  await page.locator('.th-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.th-rows tr')).toHaveCount(1, { timeout: 15_000 }); // empty-state row

  for (const p of two) {
    const v = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Order Bag', filters: p.order_bag, fieldname: 'held_by' });
    expect(v.held_by).toBe('CHEMMANUR');
  }
  const log = await frappeCall(page, 'jewelima.jewelima.api.get_recent_holder_transfers');
  expect(log.length).toBeGreaterThanOrEqual(2);
  expect(log[0].to_holder).toBe('CHEMMANUR');
  expect(log[0].reason).toBe('sale delayed - moving');
  // feed shows the moves
  await expect(page.locator('.th-feeditems .th-ft').first()).toContainText('CHEMMANUR');
});
