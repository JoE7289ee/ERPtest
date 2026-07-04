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
  // login lands on the desk (/app new, /desk old). The desk splash can be flaky on a
  // dev bench, but the session cookie is already set — verify via the API instead.
  await page.waitForURL(/\/(app|desk)\b/, { timeout: 30_000 });
  const who = await page.evaluate(async () => {
    const r = await fetch('/api/method/frappe.auth.get_logged_user', { headers: { 'X-Frappe-CSRF-Token': (window as any).frappe?.csrf_token || '' } });
    return (await r.json()).message;
  });
  expect(who).not.toBe('Guest');
  await page.context().storageState({ path: '.auth/user.json' });
});
