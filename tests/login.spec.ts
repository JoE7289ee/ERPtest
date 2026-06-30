import { expect, test } from '@playwright/test';

const USER = process.env.ERP_USER || 'Administrator';
const PASSWORD = process.env.ERP_PASSWORD || 'admin';

test('Administrator can log in to ERPNext', async ({ page }) => {
  await page.goto('/login');

  await page.locator('#login_email').fill(USER);
  await page.locator('#login_password').fill(PASSWORD);
  await page.locator('.btn-login').click();

  // Successful login lands on the Frappe desk (/app on newer, /desk on older)
  await page.waitForURL(/\/(app|desk)\b/, { timeout: 30_000 });

  // The desk navbar confirms an authenticated session
  await expect(page.locator('.navbar').first()).toBeVisible({ timeout: 30_000 });
});
