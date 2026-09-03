// TUTORIAL 21 — Purchase Raw Material: taking gold into stock. Actor: Jojo K K
// (JW Stock Admin). Posts a real submitted Purchase Receipt + SIN voucher.
//
//   BASE_URL=https://erp.jdserveraccess.in ERP_SID=<sid> npx playwright test 21-purchase-raw-material
//
// GRAMS=300 changes the weight. The page picks the warehouse from the first item,
// so nothing here sets it by hand — that is the point being taught.
import { test, gotoHome, gotoApp, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const GOLD     = 'Standard Gold 995';
const FINDING  = 'KERALA SCREW-22KYG';
const GRAMS    = process.env.GRAMS || '300';
const FIND_G   = '12.5';

const row = (page: any, i: number) => page.locator('.pr-body tr').nth(i);
const itemBox = (page: any, i: number) => row(page, i).locator('.frappe-control input').first();
// purity, qty, gram, carat — in column order
const numBox = (page: any, i: number, n: number) => row(page, i).locator('input[type="number"]').nth(n);

test('purchase raw material — 300 g of standard gold into stock', async ({ page }) => {
	test.setTimeout(240_000);

	await gotoHome(page);
	await say(page, 'Taking gold into stock. We buy <b>300 g of Standard Gold 995</b> — and let the page do the thinking.', 4200);

	await gotoApp(page, 'purchase-raw-material');
	await pause(page, 900);

	await spotlight(page, page.locator('.pr-head'),
		'The header is already filled in: the voucher and the supplier. <b>Warehouse is empty</b> — the page will choose it for us.', 4200);
	await spotOff(page);

	// ---- line 1: the gold ---------------------------------------------------
	await pickLink(page, itemBox(page, 0), GOLD, 'Pick the item. Type enough of the name and choose it.');
	await pause(page, 1200);

	await spotlight(page, row(page, 0),
		'Picking the item filled the <b>UOM</b> and the <b>purity</b> — 99.5. Nobody types purity here.', 4000);
	await spotOff(page);

	await spotlight(page, page.locator('.pr-h-wh'),
		'And the <b>warehouse</b> chose itself: gold goes to <b>Gold Issue</b>. Only the first line decides this.', 4200);
	await spotOff(page);

	await spotlight(page, row(page, 0),
		'The line is <b>red</b> — it has an item, but nobody has said how much.', 3400);
	await spotOff(page);

	await typeInto(page, numBox(page, 0, 2), GRAMS, `Now the weight: <b>${GRAMS} grams</b>.`);
	await pause(page, 1400);

	await spotlight(page, row(page, 0),
		'<b>Green.</b> This line will post. A fresh line appeared underneath on its own.', 3600);
	await spotOff(page);

	await spotlight(page, page.locator('.pr-tiles'),
		'<b>Pure gold in — 298.500 g.</b> That is the weight through its own purity: 300 g of 995. It is the number the vault cares about.', 5000);
	await spotOff(page);

	// ---- line 2: findings, to show the grouping ----------------------------
	await pickLink(page, itemBox(page, 1), FINDING, 'A second line — a finding.');
	await pause(page, 1000);
	await typeInto(page, numBox(page, 1, 2), FIND_G, 'Twelve and a half grams.');
	await pause(page, 1400);

	await spotlight(page, page.locator('.pr-tiles'),
		'Findings come in a group per karat and colour, so they add up into one <b>GOLD FINDINGS</b> figure.', 4400);
	await spotOff(page);

	// ---- the two things that stop a mistake --------------------------------
	await pickLink(page, itemBox(page, 2), 'Standard Gold 999', 'One more item — but watch what happens if we stop here.');
	await pause(page, 1400);
	await spotlight(page, row(page, 2),
		'<b>Red</b> again, and the tiles did not move. A half-typed line can never inflate the totals.', 4200);
	await spotOff(page);
	await click(page, row(page, 2).locator('button'), 'Take it off.');
	await pause(page, 1000);

	// the warehouse guard, shown rather than described
	await pickLink(page, itemBox(page, 2), 'CZ 22-22.5', 'Now a <b>stone</b>, on a sheet bound for Gold Issue.');
	await pause(page, 1000);
	await typeInto(page, numBox(page, 2, 3), '1.5', 'One and a half carats.');
	await pause(page, 800);
	await typeInto(page, numBox(page, 2, 1), '8', 'Eight pieces.');
	await pause(page, 1600);

	await spotlight(page, page.locator('.pr-warn'),
		'A <b>heads-up</b>, not a block — stones usually go to Stone Issue. You can still post it here if you mean to.', 4800);
	await spotOff(page);
	await click(page, row(page, 2).locator('button'), 'This time we will take it off.');
	await pause(page, 1400);

	// ---- print, then post ---------------------------------------------------
	await spotlight(page, page.locator('.page-actions button:has-text("Print")').first(),
		'<b>Print</b> puts the sheet on paper before anything is committed — to check, or to hand to whoever is weighing.', 4400);
	await spotOff(page);

	await spotlight(page, page.locator('.pr-tiles'),
		'Two lines of gold, and the tiles say exactly what is going in. Ready.', 3800);
	await spotOff(page);

	await click(page, page.locator('.page-actions button:has-text("Post Purchase")').first(),
		'And post it.');
	await pause(page, 3500);

	await say(page, 'Posted. That wrote a submitted <b>Purchase Receipt</b> and a <b>SIN</b> voucher — the gold is in Gold Issue.', 5000);
	await pause(page, 1200);
});
