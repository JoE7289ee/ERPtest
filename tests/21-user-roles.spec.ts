// User Roles overview (Setup > Employee): matrix of users x roles.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp } from './helpers/jewelima';

test('user roles matrix renders and matches the API', async ({ page }) => {
  await gotoApp(page, 'user-roles');
  const api = await frappeCall(page, 'jewelima.jewelima.api.get_user_roles');
  expect(api.users.length).toBeGreaterThan(0);
  expect(api.columns).toContain('Jewelima');
  expect(api.columns).toContain('System Manager');

  await expect(page.locator('.ur-rows tr')).toHaveCount(api.users.length);
  // Administrator row: SM ticked
  const admin = api.users.find((u: any) => u.user === 'Administrator');
  const $admin = page.locator('.ur-rows tr', { hasText: 'Administrator' }).first();
  const smIdx = api.columns.indexOf('System Manager');
  await expect($admin.locator('td').nth(smIdx + 1).locator('.ur-yes')).toBeVisible();
  expect(admin.has['System Manager']).toBe(true);

  // search narrows
  await page.locator('.ur-search').fill('Administrator');
  await expect(page.locator('.ur-rows tr')).toHaveCount(
    api.users.filter((u: any) => [u.user, u.full_name, u.employee, u.role_profile].join(' ').toLowerCase().includes('administrator')).length);
  await page.locator('.ur-search').fill('');
  await page.screenshot({ path: 'test-results/user-roles.png' });
});
