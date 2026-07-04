import { expect, test as setup } from '@playwright/test';
import fs from 'fs';

const USER = process.env.ERP_USER || 'Administrator';
const PASSWORD = process.env.ERP_PASSWORD || 'admin';

setup('authenticate', async ({ page }) => {
  fs.mkdirSync('.auth', { recursive: true });
  await page.goto('/login');
  await page.locator('#login_email').fill(USER);
  await page.locator('#login_password').fill(PASSWORD);
  await page.locator('.btn-login').click();
  await page.waitForURL(/\/(app|desk)\b/, { timeout: 30_000 });
  await expect(page.locator('.navbar').first()).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: '.auth/user.json' });
});
