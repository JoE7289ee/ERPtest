// Order Bag Actual tab shows Issue Details.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('Actual tab renders the Issue Details table', async ({ page }) => {
  await gotoApp(page, 'item-stock');
  const rows = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Bag Material Ledger', filters: { entry_type: ['in', ['Stone Issue', 'Gold Issue']] },
    fields: ['order_bag'], limit_page_length: 1,
  });
  const bag = rows[0].order_bag;
  await page.goto(`/app/order-bag/${encodeURIComponent(bag)}`);
  await page.getByRole('tab', { name: 'Actual' }).click();
  const sec = page.locator(".ci-issue-marker");
  await expect(sec.locator('table thead')).toContainText('Issued By', { timeout: 15_000 });
  await expect(sec.locator("table tbody tr").first()).toBeVisible();
  await page.screenshot({ path: 'test-results/order-bag-issues.png' });
});
