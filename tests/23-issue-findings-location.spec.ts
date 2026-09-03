// TUTORIAL 23 — Issue Findings, to a LOCATION. Actor: Jojo K K (JW Stock Admin).
// Same movement as issuing onto a card, but the gold lands in a warehouse instead
// of on one card. Also shows the colourless finding: a Common Finding has no
// colour of its own, so the colour is picked at issue.
//
//   BASE_URL=http://development.localhost:8000 ERP_SID=<sid> npx playwright test 23-issue-findings-location
//
// FINDING/LOCATION/GRAMS override the defaults when a site has different data.
import { test, expect, gotoHome, navSidebar, say, click, typeInto, pickLink, moveTo, spotlight, spotOff, pause } from './helpers/tutorial';

const FINDING  = process.env.FINDING  || 'TICKLY-18K-2.00';
const LOCATION = process.env.LOCATION || 'Casting - JD';
const GRAMS    = process.env.GRAMS    || '6';
const PCS      = '3';

const shelfRow = (page: any, item: string) => page.locator(`.if-t tbody tr[data-i="${item}"]`);

test('issue findings to a location', async ({ page }) => {
	test.setTimeout(240_000);

	await gotoHome(page);
	await say(page, 'Findings do not always go onto a card. Sometimes they go <b>to a department</b> — as gold.', 4400);

	await navSidebar(page,
		[['Stock', 'Stock.'], ['Findings', 'Findings.']],
		'issue-findings', 'Issue Findings.');
	await pause(page, 1400);

	// ---- the one switch that changes everything -----------------------------
	await spotlight(page, page.locator('.if-tabs'),
		'The whole difference is this switch. Same movement, different destination.', 4200);
	await spotOff(page);

	await click(page, page.locator('.if-tab[data-t="Location"]'), 'Take the second one — <b>to a location</b>.');
	await pause(page, 1200);

	// ---- a finding with no colour of its own --------------------------------
	await click(page, shelfRow(page, FINDING), `Off the shelf: <b>${FINDING}</b>.`);
	// same async-Link / 150ms-timer race as tutorial 22 — and here losing it would also
	// hide the colour question, which the server then refuses the issue without.
	await expect.poll(async () => await page.locator('.if-item input').inputValue(),
		{ timeout: 15_000 }).toBe(FINDING);
	await page.locator('.if-item input').dispatchEvent('change');
	await pause(page, 1600);

	await spotlight(page, page.locator('.if-colour-wrap'),
		'A <b>Common Finding</b> has no colour of its own — the same tickly can become yellow, pink or white. So it asks.', 5200);
	await spotOff(page);

	await say(page, 'So we tell it: <b>white</b>.');
	await moveTo(page, page.locator('.if-colour'));
	await page.selectOption('.if-colour', 'W');
	await pause(page, 1400);
	await spotlight(page, page.locator('.if-becomes'),
		'Pick white and it becomes <b>18KWG</b>. Pick pink and the very same finding becomes 18KPG.', 4800);
	await spotOff(page);

	await typeInto(page, page.locator('.if-w'), GRAMS, `<b>${GRAMS} grams</b> going out.`);
	await pause(page, 700);
	await typeInto(page, page.locator('.if-p'), PCS, 'Three of them.');
	await pause(page, 1000);

	// ---- the destination ----------------------------------------------------
	await pickLink(page, page.locator('.if-loc input'), LOCATION, 'And where the gold lands.');
	await pause(page, 1000);
	await typeInto(page, page.locator('.if-r'), 'to casting', 'A note.');
	await pause(page, 1200);

	await click(page, page.locator('.if-go'), 'Issue.');
	// .if-msg goes visible for ok AND err alike — assert the success class, or a refused
	// issue passes the run and gets narrated as a success on the recording.
	await expect(page.locator('.if-msg')).toHaveClass(/\bok\b/, { timeout: 30_000 });
	await pause(page, 2200);

	await spotlight(page, page.locator('.if-msg'),
		'Gone from the shelf, landed in the warehouse — as <b>18KWG</b>, not as a tickly.', 4800);
	await spotOff(page);

	await spotlight(page, shelfRow(page, FINDING),
		`<b>${GRAMS} g</b> off the shelf. Nothing about this is a transfer — the finding was consumed.`, 4600);
	await spotOff(page);

	await say(page, 'To a location the gold just sits in that warehouse, ready to be used. To a card it goes to the <b>In Bags</b> pool, with a ledger row naming the card.', 5400);
	await pause(page, 1200);
});
