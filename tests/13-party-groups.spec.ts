// TUTORIAL 13 — Party Groups: the map behind the E-Smith imports.
// Actor: Femi Paul (ESMITH). What the map is, how new spellings scan into OTHER
// on import, how to create a new group, and how to move a spelling to JD STOCK.
import { test, gotoHome, gotoApp, say, click, typeInto, spotlight, spotOff, pause } from './helpers/tutorial';

test('Party Groups — sort the import map', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Party Groups is the <b>lookup</b> behind Party Gold and Bag Status.', 3000);

	// lives under E-Smith
	const esmith = page.locator('.section-item').filter({ hasText: 'E-SMITH' }).locator('.standard-sidebar-item').first();
	await spotlight(page, esmith, 'Find it under the <b>E-SMITH</b> menu.', 2600);
	await spotOff(page);
	await gotoApp(page, 'party-groups');
	await page.locator('#page-party-groups').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 900);

	// layout
	await spotlight(page, page.locator('.gm-card').first(), 'Each card is a <b>group</b>; each chip is a party <b>spelling</b> from the old reports.', 3800);

	// OTHER — where imports land
	const other = page.locator('.gm-card').filter({ has: page.locator('.nm', { hasText: /^OTHER$/ }) }).first();
	await spotlight(page, other, 'On <b>import</b>, any new spelling auto-files into <b>OTHER</b> — you sort them from here.', 4200);

	// create a new group (Add a spelling → a brand-new group name)
	await spotlight(page, page.locator('.gm-add-p'), 'To <b>create a group</b>: type a spelling…', 2200);
	await typeInto(page, page.locator('.gm-add-p'), 'DEMO SPELLING', '');
	await typeInto(page, page.locator('.gm-add-g'), 'DEMO GROUP', '…and a brand-new group name.');
	await click(page, page.locator('.gm-add-go'), 'Add — the group is created.');
	await pause(page, 900);
	await spotlight(page, page.locator('.gm-card').filter({ has: page.locator('.nm', { hasText: /^DEMO GROUP$/ }) }).first(),
		'A new <b>DEMO GROUP</b> now holds that spelling.', 3000);

	// move TCRBTQ from OTHER to JD STOCK
	await spotlight(page, page.locator('.gm-chip[data-p="TCRBTQ"]'), 'Now move <b>TCRBTQ</b> out of OTHER…', 2400);
	await click(page, page.locator('.gm-chip[data-p="TCRBTQ"]'), 'Pick it.');
	await pause(page, 500);
	await typeInto(page, page.locator('.gm-move'), 'JD STOCK', 'Type the target group — <b>JD STOCK</b>…');
	await click(page, page.locator('.gm-move-go'), '…and Move.');
	await pause(page, 1000);
	await spotlight(page, page.locator('.gm-card').filter({ has: page.locator('.nm', { hasText: /^JD STOCK$/ }) }).first(),
		'<b>TCRBTQ</b> now sits under <b>JD STOCK</b>.', 3400);
	await spotOff(page);
	await say(page, 'That’s Party Groups — keep the import map tidy and every report groups right.', 2800);
});
