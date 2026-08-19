// TUTORIAL 14 — Create a new employee.
// Actor: Antony Sebastian (JW Manager). Setup → Employee → Add Employee: name,
// gender, designation + department (type a new one to create it), bench allotment.
import { test, gotoHome, gotoApp, say, click, typeInto, spotlight, spotOff, pause } from './helpers/tutorial';

const NAME = 'DEMO TRAINEE';

async function confirmYes(page) {
	// frappe.confirm binds Enter to its primary ("Yes") action
	await page.waitForTimeout(700);
	await page.keyboard.press('Enter');
	const prim = page.locator('.modal.show .btn-modal-primary, .modal:visible .btn-modal-primary').last();
	if (await prim.isVisible().catch(() => false)) await prim.click({ timeout: 4000 }).catch(() => {});
}
// commit a frappe Autocomplete value via keyboard (blur-clears otherwise)
async function pickAuto(page, input, value) {
	await input.click(); await input.fill(''); await input.pressSequentially(value, { delay: 70 });
	await page.waitForTimeout(500);
	await input.press('ArrowDown'); await input.press('Enter');
	await page.waitForTimeout(200);
}

test('Create a new employee', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Antony adds a new <b>employee</b> — under <b>Setup → Employee</b>.', 3000);

	await gotoApp(page, 'add-employee');
	await page.locator('#page-add-employee').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	await typeInto(page, page.locator('.ae-name input'), NAME, 'Type the <b>full name</b>.');
	await say(page, 'Pick the <b>gender</b>.', 1400);
	await pickAuto(page, page.locator('.ae-gender input'), 'Female');
	await pause(page, 300);
	await typeInto(page, page.locator('.ae-desig input'), 'KARIGAR', 'Designation — type a new one to create it.');
	await typeInto(page, page.locator('.ae-dept input'), 'WORKSHOP', 'Department — same, create on the fly.');
	await pause(page, 300);
	await spotlight(page, page.locator('.ae-benches'), 'Tap the <b>benches</b> to allot them to — it lands on the roster.', 3000);
	await click(page, page.locator('.ae-bench').first(), '');
	await spotOff(page);

	await click(page, page.locator('.ae-go'), 'Create the employee.');
	await confirmYes(page);
	await page.locator('.modal:visible').filter({ hasText: 'Employee created' }).waitFor({ state: 'visible', timeout: 12_000 });
	await say(page, 'Employee created — next, give them a login on <b>Add User</b>.', 3200);
});
