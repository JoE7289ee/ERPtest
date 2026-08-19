// TUTORIAL 08 — Create a new party.
// Actor: Jishnu T J. Build a party from the code masters — Group + District +
// State — watch the name assemble, and create it.
import { test, expect, gotoHome, navSidebar, say, click, pickLink, pause } from './helpers/tutorial';

test('Create a new party', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Jishnu registers a new customer — <b>Rithika Jewellery</b> in Thrissur.', 2800);

	await navSidebar(page, [['Party', 'Open the <b>Party</b> menu.']], 'create-party', 'Open <b>Create Party</b>.');
	await page.locator('#page-create-party').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);
	await say(page, 'A party name is built from master <b>codes</b> — pick them and it assembles itself.', 3400);

	await pickLink(page, page.locator('.cp-group input'), 'RTK', 'Pick the <b>Group</b> (the company).');
	await pickLink(page, page.locator('.cp-district input'), 'Thrissur', 'Pick the <b>District</b>.');
	await pickLink(page, page.locator('.cp-state input'), 'Kerala', 'Pick the <b>State</b>.');
	await pause(page, 700);
	await expect(page.locator('.cp-preview')).toContainText('RTK-TCR-KL', { timeout: 8000 });
	await say(page, 'The name builds live: <b>RTK-TCR-KL</b>. Create it.', 3000);

	await click(page, page.locator('.cp-create'), 'Create the party.');
	await expect(page.locator('.cp-district input')).toHaveValue('', { timeout: 12_000 });
	await say(page, 'Party created — <b>RTK-TCR-KL</b> is now in the directory.', 2800);
});
