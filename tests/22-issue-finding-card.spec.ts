// TUTORIAL 22 — Issue Findings, onto a CARD. Actor: Jojo K K (JW Stock Admin).
// A finding leaves the shelf and lands on a card as GOLD in the same movement —
// one submitted Repack, plus a ledger row so the card's own materials carry it.
//
//   BASE_URL=http://development.localhost:8000 ERP_SID=<sid> npx playwright test 22-issue-finding-card
//
// Needs findings stock in Gold Issue and an unfinished card. CARD/FINDING/GRAMS
// override the defaults when a site has different data.
import { test, expect, gotoHome, navSidebar, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const FINDING = process.env.FINDING || 'KERALA SCREW-22KYG';
const CARD    = process.env.CARD    || 'E7517.1.1';
const GRAMS   = process.env.GRAMS   || '4.5';
const PCS     = '6';

const shelfRow = (page: any, item: string) => page.locator(`.if-t tbody tr[data-i="${item}"]`);

test('issue a finding onto a card', async ({ page }) => {
	test.setTimeout(240_000);

	await gotoHome(page);
	await say(page, 'Findings — screws, pipes, tickly. We take <b>one off the shelf and put it on a card</b>.', 4200);

	await navSidebar(page,
		[['Stock', 'Findings live under <b>Stock</b>.'], ['Findings', 'Their own group.']],
		'issue-findings', 'Issue Findings.');
	await pause(page, 1400);

	// ---- the shelf ----------------------------------------------------------
	await spotlight(page, page.locator('.if-shelf'),
		'This is the shelf — the findings standing in <b>Gold Issue</b>. That is where a finding belongs: it is never transferred out, only issued.', 4600);
	await spotOff(page);

	await spotlight(page, page.locator('.if-shelf thead'),
		'Weight is what you hold. <b>Pure</b> is that weight through its purity — a finding is gold already.', 4400);
	await spotOff(page);

	// ---- pick it off the shelf, don't type it -------------------------------
	await click(page, shelfRow(page, FINDING),
		'Click it on the shelf. That fills the form — no typing the code.');
	// the row sets the Link field, which validates over the network, but the page runs
	// becomes() on a flat 150ms timer. Wait for the value, then nudge change so the
	// "becomes" line is never computed off a field that is still empty.
	await expect.poll(async () => await page.locator('.if-item input').inputValue(),
		{ timeout: 15_000 }).toBe(FINDING);
	await page.locator('.if-item input').dispatchEvent('change');
	await pause(page, 1400);

	await spotlight(page, page.locator('.if-becomes'),
		'And it says what it <b>becomes</b>. Issuing does not move a finding — it turns it into karat gold. The finding stops existing.', 5200);
	await spotOff(page);

	await typeInto(page, page.locator('.if-w'), GRAMS, `The weight going out: <b>${GRAMS} grams</b>.`);
	await pause(page, 800);
	await typeInto(page, page.locator('.if-p'), PCS,
		'Pieces if you counted them. Optional — the <b>weight</b> is what moves the stock.');
	await pause(page, 1000);

	// ---- where it goes ------------------------------------------------------
	await spotlight(page, page.locator('.if-tabs'),
		'Two places a finding can go: onto <b>a card</b>, or to a location. We are on a card.', 4200);
	await spotOff(page);

	await pickLink(page, page.locator('.if-bag input'), CARD, 'Scan the card it goes onto.');
	await pause(page, 1000);
	await typeInto(page, page.locator('.if-r'), 'screws for the setting bench', 'A note, so the trail reads.');
	await pause(page, 1200);

	await click(page, page.locator('.if-go'), 'Issue it.');
	// .if-msg goes visible for ok AND err alike — assert the success class, or a refused
	// issue passes the run and gets narrated as a success on the recording.
	await expect(page.locator('.if-msg')).toHaveClass(/\bok\b/, { timeout: 30_000 });
	await pause(page, 2200);

	await spotlight(page, page.locator('.if-msg'),
		'Done — and it says the gold it became and the card it is on.', 4600);
	await spotOff(page);

	await spotlight(page, shelfRow(page, FINDING),
		`The shelf redrew itself. <b>${GRAMS} g</b> less of it, and less pure gold with it.`, 4600);
	await spotOff(page);

	await say(page, 'One submitted <b>Repack</b> did that — the finding out of Gold Issue, the gold into the <b>In Bags</b> pool. A ledger row is what puts it on that card.', 5200);
	await pause(page, 1200);
});
