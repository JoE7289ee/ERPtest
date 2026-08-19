// TUTORIAL 09 — Add a branch to an existing party (company).
// Actor: Jishnu T J. Akkara Jewellers already has Thrissur stores; add another
// branch in a new locality — same Group, a different Zone makes a new party.
import { test, expect, gotoHome, navSidebar, say, click, pickLink, pause } from './helpers/tutorial';

test('Create a new branch for an existing party', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Jishnu adds a new <b>branch</b> for an existing company — <b>Akkara Jewellers</b>.', 3000);

	await navSidebar(page, [['Party', 'Open the <b>Party</b> menu.']], 'create-party', 'Open <b>Create Party</b>.');
	await page.locator('#page-create-party').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);
	await say(page, 'Same company, new store? Keep the <b>Group</b> — a different <b>Zone</b> makes the branch.', 3600);

	await pickLink(page, page.locator('.cp-group input'), 'AJ', 'Pick the existing company — <b>AJ</b>.');
	await pickLink(page, page.locator('.cp-zone input'), 'Poonkunnam', 'Add the <b>Zone</b> (the new locality).');
	await pickLink(page, page.locator('.cp-district input'), 'Thrissur', 'District — Thrissur.');
	await pickLink(page, page.locator('.cp-state input'), 'Kerala', 'State — Kerala.');
	await pause(page, 700);
	await expect(page.locator('.cp-preview')).toContainText('AJ-PKM-TCR-KL', { timeout: 8000 });
	await say(page, 'A distinct name — <b>AJ-PKM-TCR-KL</b> — the Poonkunnam branch.', 3200);

	await click(page, page.locator('.cp-create'), 'Create the branch.');
	await expect(page.locator('.cp-district input')).toHaveValue('', { timeout: 12_000 });
	await say(page, 'Branch created — Akkara now has a Poonkunnam party.', 2800);
});
