// TUTORIAL 01 — Change a user's password.
// Actor: Antony Sebastian (JW Manager). He resets the password of Reena Alex.
// Runs against the local bench with real accounts. Starts on the home page and
// navigates to Login Accounts so the path is clear. Uses the page's own Generate
// button, so the new password is app-made (never typed here).
import { test, expect, gotoHome, sidebarSection, sidebarLink, say, click, typeInto, pause } from './helpers/tutorial';

const TARGET = 'reena@jd.in';       // Reena Alex
const TARGET_NAME = 'Reena Alex';

test('Change a user\'s password', async ({ page }) => {
  await gotoHome(page);
  await say(page, 'Antony needs to reset a colleague\'s password. Start on the <b>home page</b>.', 2400);

  await click(page, sidebarSection(page, 'Setup'),
    'In the sidebar, open <b>Setup</b>.');
  await pause(page, 400);

  await click(page, sidebarSection(page, 'Employee'),
    'Then the <b>Employee</b> group.');
  await pause(page, 400);

  await click(page, sidebarLink(page, 'reset-password'),
    'And open <b>Login Accounts</b>.');
  await page.locator('#page-reset-password').waitFor({ state: 'visible', timeout: 20_000 });
  await pause(page, 700);

  await say(page, 'This lists every login. Search for the person you need.', 2000);
  await typeInto(page, page.locator('.la-search input').first(), 'Reena',
    'Type their name or login here.');
  await page.locator('.la-search input').first().blur(); // commit the filter (table re-renders)

  const row = page.locator('tr', { hasText: TARGET_NAME }).first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await pause(page, 600);

  await click(page, page.locator(`[data-reset="${TARGET}"]`),
    'Click <b>RESET</b> on their row.');

  const modal = page.locator('.modal:visible');
  await expect(modal).toContainText('Reset password', { timeout: 8000 });
  await pause(page, 500);

  await click(page, modal.getByRole('button', { name: 'Generate' }),
    'Type a new password — or click <b>Generate</b> for a strong one.');
  await pause(page, 700);

  await click(page, modal.getByRole('button', { name: 'Reset', exact: true }),
    'Then press <b>Reset</b>.');

  const done = page.locator('.modal:visible');
  await expect(done).toContainText('Password reset', { timeout: 15_000 });
  await say(page, 'Done — the new password works right away. Hand it to them yourself.', 2600);
});
