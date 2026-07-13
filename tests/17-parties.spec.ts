// Parties review page: group assignment + Party label sweep spot-checks.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('group two parties, pills update; then revert', async ({ page }) => {
  await gotoApp(page, 'parties');
  await expect(page.locator('.pt-count')).toContainText('parties');
  // pick two JOS parties via search
  await page.locator('.pt-search').fill('JOS PUK');
  await page.locator('.pt-rows tr[data-name="JOS PUK"]').click();
  await page.locator('.pt-search').fill('JOS TRY');
  await page.locator('.pt-rows tr[data-name="JOS TRY NEW"]').click();
  await expect(page.locator('.pt-selcount')).toHaveText('2');
  await page.locator('.pt-group input').fill('ZZTEST GRP');
  await page.locator('.pt-assign').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.pt-pill[data-p="ZZTEST GRP"]')).toBeVisible({ timeout: 15_000 });
  // pill filters to exactly the two
  await page.locator('.pt-pill[data-p="ZZTEST GRP"]').click();
  await page.locator('.pt-search').fill('');
  await expect(page.locator('.pt-rows tr[data-name]')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/parties.png' });
  const v = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Customer', filters: 'JOS PUK', fieldname: 'customer_group' });
  expect(v.customer_group).toBe('ZZTEST GRP');
  // revert both to Individual
  await frappeCall(page, 'jewelima.jewelima.api.set_party_group', { names: ['JOS PUK', 'JOS TRY NEW'], group: 'Individual' });
});

test('Party labels live on doctypes', async ({ page }) => {
  await gotoApp(page, 'parties');
  const meta = await page.evaluate(async () => {
    const f = (window as any).frappe;
    await f.model.with_doctype('Job Order');
    const jo = f.get_meta('Job Order').fields.find((x: any) => x.fieldname === 'customer').label;
    await f.model.with_doctype('Order Bag');
    const ob = f.get_meta('Order Bag').fields.find((x: any) => x.fieldname === 'customer').label;
    return { jo, ob };
  });
  expect(meta.jo).toBe('Party');
  expect(meta.ob).toBe('Party');
});
