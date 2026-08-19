// TUTORIAL 02 — Change your own login name & password (self-service).
// Actor: Anakha K Jayan. Opens My Account from the bottom-left avatar, changes
// her username + password, signs out, and signs back in with the new details.
// Real account on the local bench — the new credentials are kept.
import { test, expect, gotoHome, say, click, typeInto, pause } from './helpers/tutorial';

const NEW_USERNAME = 'anakha_kj';
const NEW_PASSWORD = 'Anakha@2026';

test('Change your own login name and password', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'You can change your own login name and password. Start at the home page.', 2400);

	await click(page, page.locator('.sidebar-user-button'),
		'Click your name at the <b>bottom-left</b> to open your account.');
	await page.locator('#page-my-account').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	// --- login name ---
	await typeInto(page, page.locator('.ma-username'), NEW_USERNAME,
		'Type a new <b>login name</b>.');
	await click(page, page.locator('.ma-save-un'), 'Save it.');
	await pause(page, 700);

	// --- password ---
	await typeInto(page, page.locator('.ma-pw1'), NEW_PASSWORD,
		'Type a new <b>password</b>…');
	await typeInto(page, page.locator('.ma-pw2'), NEW_PASSWORD,
		'…and type it again to confirm.');
	await click(page, page.locator('.ma-save-pw'), 'Change the password.');
	await pause(page, 900);

	// --- sign out and back in with the new details ---
	await say(page, 'Now sign out and sign back in with the new details.', 2200);
	await click(page, page.locator('.ma-signout'), 'Sign out.');
	await page.locator('#login_email').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	await typeInto(page, page.locator('#login_email'), NEW_USERNAME,
		'Enter the new <b>login name</b>.');
	await typeInto(page, page.locator('#login_password'), NEW_PASSWORD,
		'And the new <b>password</b>.');
	await click(page, page.locator('.btn-login'), 'Sign in.');

	await page.waitForURL(/\/(app|desk)\b/, { timeout: 30_000 });
	await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
	await pause(page, 800);
	await say(page, 'Signed in with the new login name and password. Done.', 2600);
});
