// Card Info shows Issue details (who issued what, when).
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('scanning a card shows the Issue details section', async ({ page }) => {
  await gotoApp(page, 'card-info');
  // pick a card that has issue ledger rows
  const rows = await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Bag Material Ledger', filters: { entry_type: ['in', ['Stone Issue', 'Gold Issue']] },
    fields: ['order_bag'], limit_page_length: 1,
  });
  const bag = rows[0].order_bag;
  const scan = page.locator('input').first();
  await scan.fill(bag);
  await scan.press('Enter');
  await expect(page.locator('.ci-sec h4', { hasText: 'Issue details' })).toBeVisible({ timeout: 15_000 });
  const sec = page.locator('.ci-sec', { has: page.locator('h4', { hasText: 'Issue details' }) });
  await expect(sec.locator('table.ci-tbl thead')).toContainText('Issued By');
  await expect(sec.locator('table.ci-tbl tbody tr').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/card-info-issues.png' });
});
