// Add User (Setup > Employee): create a login from the Employee list only.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('create a user from an employee; conventions + linkback verified', async ({ page }) => {
  await gotoApp(page, 'add-user');
  const api = await frappeCall(page, 'jewelima.jewelima.api.get_employees_without_user');
  expect(api.employees.length).toBeGreaterThan(0);
  expect(api.roles).toContain('Jewelima');

  const first = api.employees[0];
  // pick from the dropdown -> the assignment card appears
  await page.locator('.au-pick input').fill(first.employee_name);
  await page.locator('.awesomplete li', { hasText: first.employee_name }).first().click();
  await expect(page.locator('.au-card')).toHaveClass(/show/);
  await expect(page.locator('.au-emp')).toHaveText(first.employee_name);
  await expect(page.locator('.au-un')).toHaveValue(first.username);
  // Jewelima base role pre-ticked on the card
  await expect(page.locator('.au-role', { hasText: /^Jewelima$/ }).locator('input')).toBeChecked();
  await page.screenshot({ path: 'test-results/add-user.png' });

  await page.locator('.au-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('User created', { timeout: 15_000 });
  await page.keyboard.press('Escape');

  // verify: user exists w/ username + roles + module profile; employee linked; gone from the list
  const email = first.username.toLowerCase() + '@jewelima.local';
  const u = await frappeCall(page, 'frappe.client.get', { doctype: 'User', name: email });
  expect(u.username).toBe(first.username);
  expect(u.user_type).toBe('System User');
  expect(u.module_profile).toBe('Jewelima Only');
  expect(u.roles.some((r: any) => r.role === 'Jewelima')).toBe(true);
  const link = await frappeCall(page, 'frappe.client.get_value', { doctype: 'Employee', filters: first.employee, fieldname: 'user_id' });
  expect(link.user_id).toBe(email);
  const after = await frappeCall(page, 'jewelima.jewelima.api.get_employees_without_user');
  expect(after.employees.some((e: any) => e.employee === first.employee)).toBe(false);
  // shows up on the User Roles matrix with the Jewelima tick
  const ur = await frappeCall(page, 'jewelima.jewelima.api.get_user_roles');
  const mine = ur.users.find((x: any) => x.user === email);
  expect(mine.has['Jewelima']).toBe(true);
  console.log('MADE', email, '| employee', first.employee);
});
