// Add Employee (Setup > Employee): lean intake + bench allotment.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('create employee with new designation + bench allotment', async ({ page }) => {
  await gotoApp(page, 'add-employee');
  await page.locator('.ae-name input').fill('ZZTEST WORKER');
  await page.locator('.ae-gender input').fill('Male');
  await page.locator('.ae-desig input').fill('ZZTEST SETTER');
  // allot to two benches
  await page.locator('.ae-bench', { hasText: /^FILING$/ }).click();
  await page.locator('.ae-bench', { hasText: /^SETTING$/ }).click();
  await expect(page.locator('.ae-bench.on')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/add-employee.png' });

  await page.locator('.ae-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Employee created', { timeout: 15_000 });
  await page.keyboard.press('Escape');

  // verify: employee exists, designation auto-created, rosters updated
  const emp = await frappeCall(page, 'frappe.client.get_list', { doctype: 'Employee',
    filters: { employee_name: 'ZZTEST WORKER' }, fields: ['name', 'designation', 'status'], limit_page_length: 1 });
  expect(emp[0].designation).toBe('ZZTEST SETTER');
  expect(emp[0].status).toBe('Active');
  const fil = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Bench', filters: 'FILING', fieldname: 'roster' });
  expect(fil.roster).toContain('ZZTEST WORKER');
  const set = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Bench', filters: 'SETTING', fieldname: 'roster' });
  expect(set.roster).toContain('ZZTEST WORKER');
  console.log('MADE', emp[0].name);
});
