// Reset Password (SM only): reset a THROWAWAY user's password, prove the login.
import { expect, test, request } from '@playwright/test';
import { gotoApp, setLink } from './helpers/jewelima';

const TEMP = 'zztestreset@jewelima.local';
const NEWPW = 'zz' + Math.random().toString(36).slice(2, 10);

test('reset a throwaway password and log in with it', async ({ page }) => {
  await gotoApp(page, 'reset-password');
  await page.locator('.rp-user input').click();
  await page.locator('.rp-user input').fill('ZZ Test');
  await page.getByRole('option', { name: /ZZ Test|zztestreset/ }).first().click();
  await expect(page.locator('.rp-who')).toContainText('ZZTESTRESET', { timeout: 8000 });
  await page.locator('.rp-pass input').fill(NEWPW);
  await page.screenshot({ path: 'test-results/reset-password.png' });
  await page.locator('.rp-go').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Password reset', { timeout: 15_000 });
  await page.keyboard.press('Escape');

  // PROOF: a fresh session can log in with the new password (by username)
  const ctx = await request.newContext({ baseURL: 'http://development.localhost:8000' });
  const res = await ctx.post('/api/method/login', { form: { usr: 'ZZTESTRESET', pwd: NEWPW } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(JSON.stringify(body)).toContain('Logged In');
  await ctx.dispose();
});
