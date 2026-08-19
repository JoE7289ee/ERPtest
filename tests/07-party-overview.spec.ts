// TUTORIAL 07 — Parties: navigation + overview.
// Actor: Jishnu T J (JW Party Admin). Open the new Party menu, tour the directory,
// search by an old name, read a party's numbers, and glance at Party Masters.
import { test, expect, gotoHome, navSidebar, say, click, typeInto, moveTo, pause } from './helpers/tutorial';

test('Parties — navigation and overview', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Jishnu opens the new <b>Party</b> menu — it sits just above Setup.', 2800);

	// --- open Parties ---
	await navSidebar(page, [['Party', 'Open the <b>Party</b> menu.']], 'parties', 'Open <b>Parties</b>.');
	await page.locator('#page-parties').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 900);
	await say(page, 'This is the <b>party directory</b> — every party by its structured code name.', 3200);

	// --- search, incl. old name ---
	const q = page.locator('.pt-q input');
	await typeInto(page, q, 'AKKARA K.CHIRA', 'Search by name, code — or even the <b>old name</b>.');
	await pause(page, 900);
	await say(page, 'The old name <b>AKKARA K.CHIRA</b> resolves straight to its new party.', 3200);
	const row = page.locator('.pt-body tr[data-name="AJ-KUR-TCR-KL"]');
	await click(page, row, 'Open the party.');
	await page.locator('.pt-detail').waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 700);

	// --- the KPIs on the detail ---
	await moveTo(page, page.locator('.pt-tags').first());
	await say(page, 'Its identity — <b>Group · Zone · District · State</b> — and any old names.', 3200);
	await moveTo(page, page.locator('.pt-nums').first());
	await say(page, 'And the numbers that matter: <b>orders, on the floor, in stock, sold</b>.', 3400);

	// --- Party Masters counts ---
	await navSidebar(page, [['Party', 'Back to the <b>Party</b> menu.']], 'party-masters', 'Open <b>Party Masters</b>.');
	await page.locator('#page-party-masters').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 900);
	await say(page, 'Party Masters lists every <b>Group, Zone, District, State</b> — and how many parties use each.', 3600);
	await pause(page, 800);
});
