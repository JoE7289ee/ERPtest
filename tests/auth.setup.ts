import { expect, test as setup } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://development.localhost:8000';
const USER = process.env.ERP_USER || 'Administrator';
const PASSWORD = process.env.ERP_PASSWORD || 'admin';

// Saves a logged-in session that every tutorial reuses. Preferred path: a
// server-minted session id passed as ERP_SID (password-free, from `bench browse
// --user Administrator`). Falls back to a normal UI login if no SID is given.
setup('authenticate', async ({ page }) => {
  fs.mkdirSync('.auth', { recursive: true });

  if (process.env.ERP_SID) {
    await page.context().addCookies([{ name: 'sid', value: process.env.ERP_SID, url: BASE }]);
    await page.goto('/app');
    await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
  } else {
    await page.goto('/login');
    await page.locator('#login_email').fill(USER);
    await page.locator('#login_password').fill(PASSWORD);
    await page.locator('.btn-login').click();
    await page.waitForURL(/\/(app|desk)\b/, { timeout: 30_000 });
  }

  const who = await page.evaluate(async () => {
    const r = await fetch('/api/method/frappe.auth.get_logged_user', {
      headers: { 'X-Frappe-CSRF-Token': (window as any).frappe?.csrf_token || '' },
    });
    return (await r.json()).message;
  });
  expect(who).not.toBe('Guest');
  await page.context().storageState({ path: '.auth/user.json' });
});
