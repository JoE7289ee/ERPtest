// TUTORIAL 25 — Fetching today's board rate at the repair counter.
// Actor: Antony Sebastian (JW Manager). Reads the live board; writes nothing.
//
//   BASE_URL=http://development.localhost:8000 ERP_SID=<sid> \
//     npx playwright test 25-board-rate --project=chromium --reporter=list
import { test, gotoHome, gotoApp, say, click, typeInto, spotlight, spotOff, pause } from './helpers/tutorial';
import type { Page } from '@playwright/test';

const row = (page: Page, i: number) => page.locator('.qc-body tr').nth(i);

test('board rate — fetching today’s gold rate on a repair quote', async ({ page }) => {
	test.setTimeout(240_000);

	await gotoHome(page);
	await say(page, 'Gold on a repair is charged at the <b>board rate</b>. Here is how to fetch today’s without leaving the counter.', 4600);

	await gotoApp(page, 'repair-quick-check');
	await pause(page, 900);

	await spotlight(page, page.locator('.qc-h-gold'),
		'The Board Rate box. It opens on whatever this party was last charged — which may be days old.', 4400);
	await spotOff(page);

	await click(page, page.locator('.page-actions button:has-text("Board Rate")'),
		'So fetch the live one.');
	await pause(page, 3000);

	await spotlight(page, page.locator('.modal.show table'),
		'Today’s board, line by line, each with the time it was read. These are the boards we actually follow.', 5200);
	await spotOff(page);

	await spotlight(page, page.locator('.modal.show .qc-bpick').first(),
		'<b>Which line is our board rate is your call</b> — the page does not choose for you.', 4400);
	await spotOff(page);

	await click(page, page.locator('.modal.show .qc-bpick').first(), 'Pick one and it fills the box.');
	await pause(page, 1600);

	await spotlight(page, page.locator('.qc-h-gold'),
		'In it goes. Every line on the quote is now priced off this figure.', 4000);
	await spotOff(page);

	// show it actually driving a figure
	await page.locator('.qc-body tr').first().locator('.c-item').selectOption('RING');
	await pause(page, 700);
	await typeInto(page, row(page, 0).locator('.c-win'), '5.000', 'Put a ring on the sheet to see it work.');
	await typeInto(page, row(page, 0).locator('.c-wout'), '5.400', 'In, and out.');
	await pause(page, 1600);

	await spotlight(page, row(page, 0).locator('td.num').nth(2),
		'<b>0.400 g of gold</b>, priced at today’s board. Hover it and it shows the whole sum.', 4800);
	await spotOff(page);

	await say(page, 'The board is quoted <b>with GST in it</b>, so the tax comes out before the karat is taken — the same two steps a repair bill uses.', 5600);
	await pause(page, 1200);

	await spotlight(page, page.locator('.page-actions button:has-text("Board Rate")'),
		'Fetch it again whenever the board moves. Nothing on the sheet is lost.', 4200);
	await spotOff(page);
});
