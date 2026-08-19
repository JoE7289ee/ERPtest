// TUTORIAL 11 — Party Gold: upload the Party Selection report and read it.
// Actor: Femi Paul (ESMITH). Export the report from E-Smith, upload it here, and
// walk the key numbers. Uses highlight "spotlight" boxes for emphasis.
import { test, gotoHome, gotoApp, say, click, spotlight, spotOff, pause } from './helpers/tutorial';

const REPORT = '/Users/josephdaison/Downloads/PARTY_SELECTION_REPORT_10-06-2026-09-47-11.xlsx';

test('Party Gold — upload the report and read it', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'In <b>E-Smith</b>, export the <b>Party Selection</b> report — leave it exactly as it is…', 3400);
	await say(page, '…then bring it here, to <b>Party Gold</b>.', 2400);

	// Party Gold lives under the E-Smith menu
	const esmith = page.locator('.section-item').filter({ hasText: 'E-SMITH' }).locator('.standard-sidebar-item').first();
	await spotlight(page, esmith, 'Party Gold lives under the <b>E-SMITH</b> menu.', 2800);
	await spotOff(page);
	await gotoApp(page, 'party-gold');
	await page.locator('#page-party-gold').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	// --- upload the report ---
	await spotlight(page, page.locator('.pg-file'), 'Upload the <b>.xlsx</b> you exported from E-Smith.', 2800, true);
	await page.locator('.pg-input').setInputFiles(REPORT);
	await page.locator('.pg-tiles .pg-tile').first().waitFor({ state: 'visible', timeout: 45_000 });
	await spotOff(page);
	await say(page, 'Parsed — parties, gold and aging come straight out of the file.', 2800);

	// --- headline tiles ---
	await spotlight(page, page.locator('.pg-tiles'), 'Headline totals: <b>pieces, net gold, diamonds</b>, and the <b>oldest</b> holding.', 3800);

	// --- columns + aging bands ---
	await spotlight(page, page.locator('.pg-t thead'), 'The <b>aging bands</b> — net gold held 0–30, 31–90, 91–180, and 180+ days.', 4000);

	// --- a group ---
	await spotlight(page, page.locator('.pg-grp').first(), 'Each <b>customer group</b> and the gold it holds.', 3400);

	// --- flip to Design Types ---
	await spotlight(page, page.locator('.pg-view'), 'Flip the view…', 1800, true);
	await click(page, page.locator('.pg-view'), '');
	await pause(page, 800);
	await say(page, '<b>Design Types</b> — which designs are out, and which groups hold them.', 3200);
	await click(page, page.locator('.pg-view'), 'Back to <b>Parties</b>.');
	await pause(page, 700);

	// --- a party statement ---
	await click(page, page.locator('.pg-grp').first(), 'Open a group…');
	await pause(page, 700);
	if (!(await page.locator('.pg-back-stmt').isVisible().catch(() => false))) {
		await spotlight(page, page.locator('.pg-party').first(), 'The <b>parties</b> inside the group.', 2800);
		await click(page, page.locator('.pg-party.stmt').first(), 'Click a party for its <b>statement</b>.');
		await page.locator('.pg-back-stmt').waitFor({ state: 'visible', timeout: 10_000 });
	}
	await pause(page, 700);
	await spotlight(page, page.locator('.pg-body'), 'Every piece for that party, <b>oldest first</b> — ready to print.', 3600);
	await click(page, page.locator('.pg-back-stmt'), 'Back.');
	await pause(page, 700);

	// --- KPI dashboard ---
	await spotlight(page, page.locator('.pg-kpi'), 'Open the <b>KPI dashboard</b>.', 1800, true);
	await click(page, page.locator('.pg-kpi'), '');
	await pause(page, 1000);
	await spotlight(page, page.locator('.pg-body'), 'Exposure, aging and <b>concentration</b> — plus a payment watchlist and the stalest designs.', 4400);
	await spotOff(page);
	await say(page, 'That’s Party Gold — the old report, read at a glance.', 2600);
});
