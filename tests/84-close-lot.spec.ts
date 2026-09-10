import { test, expect } from '@playwright/test';

test('CLOSE LOT end to end in the page', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-keep .ls-kt', { timeout: 20000 });
  await page.waitForTimeout(1200);

  await expect(page.locator('.ls-close'), 'the CLOSE LOT button').toBeVisible();
  await page.locator('.ls-close').click();
  const warn = (await page.locator('.modal.show .modal-body').first().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('close asks:', warn.slice(0, 200));
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4500);

  const reqs = await page.locator('.ls-rq').evaluateAll((rs) => rs.map((r) => r.textContent!.replace(/\s+/g, ' ').trim()));
  console.log('requests raised:'); reqs.forEach((r) => console.log('   ', r.slice(0, 70)));
  expect(reqs.length).toBe(2);
  expect(reqs.join(' ').toLowerCase()).toContain('close');
  expect(reqs.join(' ').toLowerCase()).toContain('buy');

  // approving the CLOSE first must be refused
  const closeRow = page.locator('.ls-rq').filter({ hasText: 'close' }).first();
  await closeRow.locator('.ls-yes').click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(3500);
  const err = (await page.locator('.modal.show').last().textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
  console.log('closing early ->', err.slice(0, 150) || '(no dialog)');
  expect(err.toLowerCase()).toContain('waiting to be decided');
  await page.locator('.modal.show .btn-modal-close, .modal.show .btn-primary').first().click().catch(() => {});
  await page.waitForTimeout(800);

  // settle the purchase, then close
  const buyRow = page.locator('.ls-rq').filter({ hasText: 'buy' }).first();
  await buyRow.locator('.ls-yes').click();
  await page.waitForSelector('.modal.show .ls-pt', { timeout: 15000 });
  await page.locator('.modal.show .btn-primary', { hasText: 'PURCHASE' }).click();
  await page.waitForTimeout(6000);
  console.log('purchase posted, records:', (await page.locator('.ls-pr').allTextContents()).join(', '));

  await page.locator('.ls-rq').filter({ hasText: 'close' }).first().locator('.ls-yes').click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(6000);

  const state = await page.evaluate(async (n) => {
    const r = await (window as any).frappe.call({ method: 'jewelima.jewelima.api.get_stone_lot', args: { name: n } });
    return { status: r.message.status, items: (r.message.items || []).map((i: any) =>
      `${i.sieve} tray=${i.actual} bought=${i.purchased} returned=${i.returned}`) };
  }, lot);
  console.log('after closing -> status', state.status);
  state.items.forEach((i: string) => console.log('   ', i));
  expect(state.status).toBe('Closed');
  expect(state.items.join(' ')).toContain('returned=');
  console.log('CLOSE LOT button gone:', !(await page.locator('.ls-close').isVisible().catch(() => false)));
});
