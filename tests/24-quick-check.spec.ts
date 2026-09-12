// TUTORIAL 24 — Quick Check: what a repair would cost, before it is taken in.
// Actor: Antony Sebastian (JW Manager). Writes NOTHING — the page is a
// calculator with a print, which is the point being taught.
//
//   BASE_URL=http://development.localhost:8000 ERP_SID=<sid> \
//     npx playwright test 24-quick-check --project=chromium --reporter=list
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink, moveTo, collapseSidebar, spotlight, spotOff, pause } from './helpers/tutorial';
import type { Page, Locator } from '@playwright/test';

const RING_IN = '5.000', RING_OUT = '5.400';
const STUD_IN = '2.100', STUD_OUT = '2.160';

const row = (page: Page, i: number) => page.locator('.qc-body tr').nth(i);

/** A <select> in the grid: glide to it, then choose — Frappe's own controls are
 * links, but the grid's item and purity boxes are plain selects. */
async function pickOption(page: Page, loc: Locator, value: string, caption?: string) {
	if (caption) await say(page, caption);
	await loc.scrollIntoViewIfNeeded().catch(() => {});
	const box = await loc.boundingBox();
	if (box) {
		await page.mouse.move(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), { steps: 18 });
		await page.evaluate(({ x, y }) => (window as any).__tut?.move(x, y),
			{ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) });
	}
	await loc.selectOption(value);
	await pause(page, 700);
}

/** Pick a type of work from the MultiSelectPills box. Its awesomplete list has no
 * ARIA roles — Frappe's Link fields do, this control does not — so the option is
 * matched by its own text instead. */
async function pickPill(page: Page, value: string, caption?: string) {
	const inp = page.locator('.modal.show [data-fieldname="works"] input').first();
	if (caption) await say(page, caption);
	await moveTo(page, inp);
	await inp.click();
	await inp.fill('');
	await inp.pressSequentially(value, { delay: 70 });
	const opt = page.locator('.modal.show [data-fieldname="works"] li',
		{ hasText: new RegExp(`^${value}$`, 'i') }).first();
	await opt.waitFor({ state: 'visible', timeout: 9000 });
	await pause(page, 400);
	await opt.click();
	// the awesomplete list stays open over the qty boxes underneath it, so put it
	// away before anything below is touched
	await page.evaluate(() => {
		const i = document.querySelector('.modal.show [data-fieldname="works"] input') as HTMLInputElement | null;
		i?.blur();
		document.querySelector('.modal.show [data-fieldname="works"] ul')?.setAttribute('hidden', '');
	});
	await pause(page, 700);
}

test('quick check — two rings and two studs, priced and printed', async ({ page }) => {
	test.setTimeout(300_000);

	await gotoHome(page);
	await say(page, 'A customer is at the counter asking what a repair will cost. <b>Quick Check</b> answers that — and saves nothing.', 4400);

	await gotoApp(page, 'repair-quick-check');
	await pause(page, 900);

	await collapseSidebar(page, 'Fold the menu away first — the sheet is wide and every column earns its place.');
	await pause(page, 700);

	// The complaint that prompted the fold: with the menu open the columns were
	// squeezed, not scrolled — Qty came out 27px wide and In Wt 48px, too narrow
	// to read 5.000 back. Assert the boxes are legible and the sheet needs no
	// sideways scroll, so a column added later cannot quietly crush them again.
	const fit = await page.evaluate(() => {
		const w = (sel: string) => Math.round(
			document.querySelector('.qc-body tr:first-child ' + sel)!.getBoundingClientRect().width);
		return {
			qty: w('.c-qty'), win: w('.c-win'), wout: w('.c-wout'),
			box: (document.querySelector('.qc-gridbox') as HTMLElement).clientWidth,
			table: (document.querySelector('table.qc-t') as HTMLElement).scrollWidth,
		};
	});
	console.log('sheet fit:', JSON.stringify(fit));
	expect(fit.win, `In Wt box is ${fit.win}px`).toBeGreaterThanOrEqual(62);
	expect(fit.wout, `Out Wt box is ${fit.wout}px`).toBeGreaterThanOrEqual(62);
	expect(fit.table, `sheet is ${fit.table}px in a ${fit.box}px box`).toBeLessThanOrEqual(fit.box + 1);

	await spotlight(page, page.locator('.qc-head'),
		'Who it is for, the board rate, GST, and a note for the paper. That is the whole header.', 4200);
	await spotOff(page);

	await pickLink(page, page.locator('.qc-h-party input'), 'AKSHAYA',
		'Name the party. If they have been billed before, their old rates come with them.');
	await pause(page, 1400);

	// ---- two rings ----------------------------------------------------------
	await pickOption(page, row(page, 0).locator('.c-item'), 'RING',
		'First line. <b>Two rings.</b>');
	await typeInto(page, row(page, 0).locator('.c-qty'), '2');
	await pause(page, 700);

	await typeInto(page, row(page, 0).locator('.c-win'), RING_IN,
		'Weigh them in — this is <b>our</b> weight, not what the customer says.');
	await pause(page, 1100);

	await spotlight(page, row(page, 0).locator('td.num').first(),
		'<b>Added is still a dash.</b> Nothing is charged for metal until the piece is weighed OUT.', 4000);
	await spotOff(page);

	await typeInto(page, row(page, 0).locator('.c-wout'), RING_OUT,
		'What we expect them to weigh when the work is done.');
	await pause(page, 1200);

	await spotlight(page, row(page, 0).locator('td.num').first(),
		'<b>+0.400 g.</b> The difference is gold the workshop puts in, and it is worked out for you.', 4200);
	await spotOff(page);

	// ---- two studs -----------------------------------------------------------
	await pickOption(page, row(page, 1).locator('.c-item'), 'STUD',
		'Second line. <b>Two studs.</b>');
	await typeInto(page, row(page, 1).locator('.c-qty'), '2');
	await typeInto(page, row(page, 1).locator('.c-win'), STUD_IN);
	await typeInto(page, row(page, 1).locator('.c-wout'), STUD_OUT, 'In and out.');
	await pause(page, 1400);

	// ---- the work ------------------------------------------------------------
	await click(page, row(page, 0).locator('.c-work'), 'Now the work. What do the rings need?');
	await pause(page, 900);
	await pickPill(page, 'soldering', 'Soldering, to start.');
	await pickPill(page, 'POLISHING', 'And a polish.');
	await pause(page, 900);
	await spotlight(page, page.locator('.modal.show [data-fieldname="qty_html"]'),
		'<b>How many of each</b> — a ring can carry three solderings. It is the count that is charged, not the piece.', 4400);
	await spotOff(page);
	await typeInto(page, page.locator('.modal.show input[data-w="soldering"]'), '3', 'Three solderings.');
	await click(page, page.locator('.modal.show .btn-primary'), 'Set.');
	await pause(page, 1200);

	await click(page, row(page, 1).locator('.c-work'), 'The studs only need polishing.');
	await pause(page, 900);
	await pickPill(page, 'POLISHING');
	await click(page, page.locator('.modal.show .btn-primary'), 'Set.');
	await pause(page, 1400);

	// ---- a stone -------------------------------------------------------------
	await click(page, row(page, 0).locator('.c-stones'), 'A stone has to be reset in one of the rings.');
	await pause(page, 900);
	await page.locator('.modal.show .sd-b').first().selectOption('DMD');
	await pause(page, 600);
	await page.locator('.modal.show .sd-s').first().selectOption('OOO-OO');
	await pause(page, 600);
	await typeInto(page, page.locator('.modal.show .sd-p').first(), '2',
		'Two diamonds. <b>Leave the carats</b> — the sieve chart knows what they weigh.');
	await pause(page, 1600);
	await spotlight(page, page.locator('.modal.show .sd-t'),
		'It filled the carats in from the chart, and it will say so if a weight is far off the sieve.', 4200);
	await spotOff(page);
	await click(page, page.locator('.modal.show .btn-primary'), 'Save.');
	await pause(page, 1500);

	// ---- the board, then the rates -------------------------------------------
	await click(page, page.locator('.page-actions button:has-text("Board Rate")'),
		'Gold is charged at the board rate. Fetch today’s.');
	await pause(page, 2500);
	await click(page, page.locator('.modal.show .qc-bpick').first(), 'Take the first line.');
	await pause(page, 1600);

	await spotlight(page, page.locator('.qc-work'),
		'Every type of work you used is listed here, with how many. <b>The rate is yours to set.</b>', 4400);
	await spotOff(page);

	await typeInto(page, page.locator('.qc-work tr:has-text("soldering") .qc-wrate'), '200', 'Two hundred a soldering.');
	await pause(page, 900);
	await typeInto(page, page.locator('.qc-work tr:has-text("POLISHING") .qc-wrate'), '85', 'Eighty-five a polish.');
	await pause(page, 1100);

	await typeInto(page, page.locator('.qc-srate').first(), '68000', 'And the diamonds, per carat.');
	await pause(page, 1400);

	await typeInto(page, page.locator('.qc-h-gst input'), '3', 'Three percent GST on top.');
	await page.locator('.qc-h-gst input').press('Tab');
	await pause(page, 1600);

	// ---- what it came to ------------------------------------------------------
	await spotlight(page, page.locator('.qc-tiles'),
		'Work, metal, stones, GST — and the total. <b>Nothing here has been saved.</b>', 4800);
	await spotOff(page);

	await spotlight(page, row(page, 0).locator('td.num').nth(2),
		'Hover any figure and it shows the sum behind it — board rate, GST out, karat, grams.', 4400);
	await spotOff(page);

	// ---- the paper ------------------------------------------------------------
	// Show the quotation itself rather than the browser's print dialog, which a
	// recording cannot capture.
	await page.evaluate(() => {
		const obs = new MutationObserver(() => {
			const fr = document.getElementById('jw-repair-frame') as HTMLIFrameElement | null;
			if (fr && fr.contentWindow) {
				(fr.contentWindow as any).print = () => {};
				fr.style.cssText = 'position:fixed;left:6vw;top:4vh;width:88vw;height:88vh;border:1px solid #999;'
					+ 'background:#fff;visibility:visible;z-index:99999;box-shadow:0 14px 50px rgba(0,0,0,.4);';
				obs.disconnect();
			}
		});
		obs.observe(document.body, { childList: true });
	});
	await click(page, page.locator('.page-actions button:has-text("Print Quotation")'), 'Print it.');
	await pause(page, 2200);
	await say(page, 'The quotation. It says <b>QUOTATION</b> and carries no number — there is no document behind it.', 5200);
	await pause(page, 3000);
	await page.evaluate(() => document.getElementById('jw-repair-frame')?.remove());
	await pause(page, 900);

	await say(page, 'Leave the page and the sheet is gone. When the work is really taken in, it goes through <b>New Repair Order</b>.', 5200);
	await pause(page, 1200);
});
