// TUTORIAL 15 — Create a new user (login) for an employee.
// Actor: Antony Sebastian (JW Manager). Setup → Employee → Add User: pick an
// employee without a login, set the username, tick roles, Create. No password here.
import { test, gotoHome, gotoApp, say, click, typeInto, spotlight, spotOff, pause } from './helpers/tutorial';

const NAME = 'DEMO TRAINEE';

async function confirmYes(page) {
	// frappe.confirm binds Enter to its primary ("Yes") action
	await page.waitForTimeout(700);
	await page.keyboard.press('Enter');
	const prim = page.locator('.modal.show .btn-modal-primary, .modal:visible .btn-modal-primary').last();
	if (await prim.isVisible().catch(() => false)) await prim.click({ timeout: 4000 }).catch(() => {});
}
async function pickAuto(page, input, value) {
	await input.click(); await input.fill(''); await input.pressSequentially(value, { delay: 70 });
	await page.waitForTimeout(500);
	await input.press('ArrowDown'); await input.press('Enter');
	await page.waitForTimeout(200);
}

test('Create a new user', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Now Antony gives that employee a <b>login</b> — <b>Setup → Employee → Add User</b>.', 3200);

	await gotoApp(page, 'add-user');
	await page.locator('#page-add-user').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	await say(page, 'Pick an <b>employee without a login</b>.', 1600);
	await pickAuto(page, page.locator('.au-pick input'), NAME);
	await page.locator('.au-card.show').waitFor({ state: 'visible', timeout: 8000 });
	await pause(page, 600);

	await spotlight(page, page.locator('.au-un'), 'A <b>username</b> is suggested — adjust it if you like.', 3000);
	await spotOff(page);
	await spotlight(page, page.locator('.au-roles'), 'Tick the <b>roles</b> this login should carry.', 3000);
	await page.locator('.au-role', { hasText: 'Jewelima Info' }).locator('input.au-rolecb').check();
	await pause(page, 400);
	await spotOff(page);

	await click(page, page.locator('.au-go'), 'Create the user.');
	await confirmYes(page);
	await page.locator('.modal:visible').filter({ hasText: 'User created' }).waitFor({ state: 'visible', timeout: 12_000 });
	await say(page, 'Login created — set the password separately, and they’re in.', 3000);
});
