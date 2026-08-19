// TUTORIAL 06 — Due View: see every card that's due soon or overdue.
// Actor: Sangeetha (Jewelima Info + Ordering). From the home page she opens
// Due View, reads the board, and changes the "due within" window to widen or
// narrow what she sees.
import { test, gotoHome, navSidebar, say, click, typeInto, moveTo, pause } from './helpers/tutorial';

test('Due View — read the board and change the due window', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Sangeetha wants to check which orders are <b>due soon</b> — or already late.', 2800);

	// --- navigate: Info → Due View ---
	await navSidebar(page, [['Info', 'Open <b>Info</b> in the sidebar.']], 'due-view', 'Open <b>Due View</b>.');
	await page.locator('#page-due-view').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 900);

	await say(page, 'This is <b>Due View</b> — every live card that\'s due soon, grouped by its bench.', 3400);

	// --- read the board ---
	const firstBench = page.locator('.dv-bench').first();
	await moveTo(page, firstBench.locator('.h b'));
	await say(page, 'Each panel is one <b>bench</b> — you can see exactly where each card is sitting.', 3400);

	const overChip = page.locator('.dv-days.over').first();
	if (await overChip.isVisible().catch(() => false)) {
		await moveTo(page, overChip);
		await say(page, 'A <b>red</b> chip means the card is <b>overdue</b> — past its promised date.', 3200);
	}
	const soonChip = page.locator('.dv-days.soon').first();
	if (await soonChip.isVisible().catch(() => false)) {
		await moveTo(page, soonChip);
		await say(page, 'An <b>amber</b> chip counts the <b>days left</b> before it\'s due.', 3200);
	}

	// --- the stones column ---
	const stone = page.locator('.dv-stone').first();
	if (await stone.isVisible().catch(() => false)) {
		await moveTo(page, stone);
		await say(page, 'The <b>Stones</b> column shows each card\'s stone bucket — grey means not weighed in yet.', 3600);
	}

	// --- change the due window ---
	const daysIn = page.locator('.dv-days-in');
	await say(page, 'Change the <b>“Due within”</b> box to widen or narrow the window.', 3000);
	await typeInto(page, daysIn, '0', 'Type <b>0</b> to see <b>only</b> what\'s already overdue…');
	await daysIn.press('Tab');
	await page.waitForFunction(() => document.querySelectorAll('.dv-bench').length >= 0, undefined, { timeout: 8000 });
	await pause(page, 1600);
	await say(page, 'Now only the <b>overdue</b> cards remain.', 2600);

	await typeInto(page, daysIn, '7', 'Type <b>7</b> to look a whole week ahead.');
	await daysIn.press('Tab');
	await pause(page, 1600);
	await moveTo(page, page.locator('.dv-total'));
	await say(page, 'The total updates — that\'s how many cards are <b>at risk</b> in the next 7 days.', 3400);

	// --- drill in ---
	await moveTo(page, page.locator('.dv-card').first());
	await say(page, 'Click any <b>card</b> to open its Card Info, or a <b>design</b> for Design Info. Due View is read-only.', 3800);
	await pause(page, 800);
});
