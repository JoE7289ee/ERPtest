// TUTORIAL 03 — Add someone to a bench, then assign their card.
// Actor: Antony Sebastian (JW Manager). A card waits at Waxing; we try to assign
// it to JINU, find she isn't on the Waxing bench, add her via Assign Benches,
// then come back and assign. Real accounts/records on the local bench.
import { test, expect, gotoHome, navSidebar, say, click, typeInto, pickLink, pause } from './helpers/tutorial';

const CARD = 'DEMOPB.2.2';

test('Add someone to a bench, then assign their card', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'A card is waiting at <b>Waxing</b>. We want to assign it to JINU.', 2600);

	// --- Assign / Collect: try to find JINU (she isn't on the bench yet) ---
	await navSidebar(page, [['Manufacturing', 'Open <b>Manufacturing</b>.']], 'assign-collect', 'Go to <b>Assign / Collect</b>.');
	await page.locator('#page-assign-collect').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 600);

	await typeInto(page, page.locator('.ac-scan input'), CARD, 'Scan the Waxing card.');
	await page.locator('.ac-scan input').press('Enter');
	await pause(page, 1400);

	await typeInto(page, page.locator('.ac-emp input'), 'JINU',
		'Look for <b>JINU</b> in the employee list…');
	await pause(page, 1600);
	await say(page, 'No match — JINU isn’t on the Waxing bench yet.', 2600);
	await page.locator('.ac-emp input').fill('');
	await page.keyboard.press('Escape');

	// --- Assign Benches: add JINU to Waxing ---
	await navSidebar(page, [['Setup', 'Open <b>Setup</b>.'], ['Employee', 'Then <b>Employee</b>.']],
		'assign-bench', 'Open <b>Assign Benches</b>.');
	await page.locator('#page-assign-bench').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	const waxCard = page.locator('.ab-card[data-bench="WAXING"]');
	await click(page, waxCard.locator('.ab-add'), 'On the <b>Waxing</b> bench, click <b>Add employee</b>.');
	const dlg = page.locator('.modal:visible');
	await expect(dlg).toContainText('Add to WAXING', { timeout: 8000 });
	await pickLink(page, dlg.locator('input[data-fieldname="employee"]'), 'JINU', 'Pick <b>JINU</b>.');
	await click(page, dlg.getByRole('button', { name: 'Add', exact: true }), 'Add her to the bench.');
	await pause(page, 1000);

	// --- back to Assign / Collect: now assign to JINU ---
	await say(page, 'Now back to Assign / Collect — JINU is available.', 2400);
	await navSidebar(page, [['Manufacturing', 'Open <b>Manufacturing</b>.']], 'assign-collect', 'Assign / Collect.');
	await page.locator('#page-assign-collect').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 600);

	await typeInto(page, page.locator('.ac-scan input'), CARD, 'Scan the card again.');
	await page.locator('.ac-scan input').press('Enter');
	await pause(page, 1400);

	await pickLink(page, page.locator('.ac-emp input'), 'JINU', 'This time <b>JINU</b> appears — pick her.');

	await click(page, page.locator('.ac-actions .btn-primary', { hasText: 'Assign with Employee' }),
		'Assign the card to JINU.');
	await pause(page, 1200);
	await say(page, 'Done — the Waxing card is assigned to JINU.', 2600);
});
