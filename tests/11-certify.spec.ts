// Certification: send from the desk (certify), track + receive on the
// Certification Out board (batch panels, chip-click receive dialogs).
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
let bags: string[] = [];
let batch = '';

test('send two pieces from the desk', async ({ page }) => {
  await gotoApp(page, 'certify');
  const pieces = await frappeCall(page, 'jewelima.jewelima.api.get_certifiable_pieces');
  expect(pieces.length).toBeGreaterThanOrEqual(2);
  bags = pieces.slice(0, 2).map((p: any) => p.order_bag);

  for (const b of bags) {
    await page.locator(`.ct-pieces tr[data-bag="${b}"]`).click();
  }
  await expect(page.locator('.ct-selcount')).toHaveText('2');
  await page.locator('.ct-lab').fill('BIS Centre TCR');
  await page.locator('.ct-send').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator(`.ct-pieces tr[data-bag="${bags[0]}"]`)).toHaveCount(0, { timeout: 15_000 });

  const m = await frappeCall(page, 'jewelima.jewelima.api.get_certification_batches');
  batch = m.batches[0].name;
  expect(m.batches[0].total).toBe(2);
  expect(m.summary.pieces_out).toBe(2);
  for (const b of bags) {
    const st = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Order Bag', filters: b, fieldname: 'stock_status' });
    expect(st.stock_status).toBe('At Certification');
  }
});

test('board shows the batch + summary; chip-click receives pieces back', async ({ page }) => {
  await gotoApp(page, 'certification-out');
  const m0 = await frappeCall(page, 'jewelima.jewelima.api.get_certification_batches');
  const mine0 = m0.batches.find((x: any) => x.name === batch);
  // header summary carries the API numbers (pure gold + stones of what's out)
  const cards = page.locator('.co-card .v');
  await expect(cards.nth(0)).toHaveText(String(m0.summary.pieces_out));
  await expect(cards.nth(1)).toHaveText(`${m0.summary.pure_gold.toFixed(3)} g`);
  await expect(cards.nth(2)).toHaveText(`${m0.summary.stones_ct.toFixed(3)} ct`);
  await expect(cards.nth(3)).toHaveText(String(m0.summary.batches_out));
  // batch panel with sent date + both chips pending
  const $col = page.locator(`.co-col[data-name="${batch}"]`);
  await expect($col).toContainText(mine0.sent_on);
  await expect($col.locator('.co-chip.pend')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/certification-out.png' });

  // receive piece 1 via its chip (HUID)
  await $col.locator('.co-chip.pend').first().click();
  await page.locator('.modal:visible input[data-fieldname="huid"]').fill('ZZTEST1');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Receive' }).click();
  await expect(page.locator(`.co-col[data-name="${batch}"] .co-chip.pend`)).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator(`.co-col[data-name="${batch}"]`)).toContainText('1/2');

  // receive piece 2 (cert no)
  await page.locator(`.co-col[data-name="${batch}"] .co-chip.pend`).first().click();
  await page.locator('.modal:visible input[data-fieldname="certificate_no"]').fill('IGI-TEST-9');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Receive' }).click();
  await expect(page.locator(`.co-col[data-name="${batch}"] .co-chip.pend`)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(`.co-col[data-name="${batch}"]`)).toContainText('2/2');

  const m1 = await frappeCall(page, 'jewelima.jewelima.api.get_certification_batches');
  const mine1 = m1.batches.find((x: any) => x.name === batch);
  expect(mine1.status).toBe('Received');
  expect(m1.summary.pieces_out).toBe(0);
  const stamped = mine1.items.map((r: any) => r.huid || r.certificate_no).sort();
  expect(stamped).toEqual(['IGI-TEST-9', 'ZZTEST1']);
  for (const b of bags) {
    const st = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Order Bag', filters: b, fieldname: 'stock_status' });
    expect(st.stock_status).toBe('In Stock');
  }
});
