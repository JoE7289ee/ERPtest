// TUTORIAL 19 — one card, end to end: order it, print it, and walk it through the
// floor. Two actors: ANAKHA (ordering) hands over to SHEEJA (the data desk).
// ANAKHA:  place the order -> print the bag -> transfer to CAD
// SHEEJA:  assign + collect at CAD -> CAM -> WAXING -> assign + collect (Wax Injecting)
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const VARIANT = 'A13405NP-18EF-Y';   // its card is A 13405 NP
const PARTY   = 'AJ-KUR-TCR-KL';
const OTYPE   = 'CUSTOMER';
const QTY     = '5';
const REMARK  = 'the test run';

test('end to end — order, print, CAD, CAM, WAXING', async ({ page, context }) => {
	test.setTimeout(600_000);

	// ============ ANAKHA — places the order ============
	await gotoHome(page);
	await say(page, 'One card, all the way through. <b>Anakha</b> takes the order; <b>Sheeja</b> walks it across the floor.', 4200);

	await gotoApp(page, 'place-order');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	await pickLink(page, page.locator('.po-h-customer input'), PARTY, 'The <b>party</b>.');
	await page.waitForTimeout(600);
	await pickLink(page, page.locator('.po-h-ordertype input'), OTYPE, 'The <b>type</b>.');
	await page.waitForTimeout(600);
	await typeInto(page, page.locator('.po-h-days input'), '15', 'Due in 15 days.');
	await page.waitForTimeout(600);

	// the code on a bag is the VARIANT — type that and the card comes with it
	const row = page.locator('.po-grid tbody tr').first();
	await say(page, `The bag carries the <b>variant</b> code. Type that and the D Bank fills itself.`, 3800);
	await typeInto(page, row.locator('input[data-fieldname="bank"]'), VARIANT, '');
	await expect.poll(async () => await page.evaluate(() => {
		const el = document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement;
		return (el?.value || '').trim();
	}), { timeout: 25_000 }).toBe(VARIANT);
	await spotlight(page, row.locator('input[data-fieldname="design"]'), 'Card and variant, both in.', 3000);
	await spotOff(page);

	await typeInto(page, row.locator('input[type="number"]').first(), QTY, `Quantity <b>${QTY}</b> — one bag.`);
	await page.waitForTimeout(800);

	await click(page, row.locator('button:has-text("Remark")'), 'Add a <b>remark</b>.');
	const rdlg = page.locator('.modal:visible').last();
	await rdlg.waitFor({ state: 'visible', timeout: 8000 });
	await page.waitForTimeout(600);
	await page.evaluate((t) => {
		const ta = document.querySelector('.modal.show textarea, .modal:not([style*="display: none"]) textarea') as HTMLTextAreaElement;
		if (ta) { ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); }
	}, REMARK);
	await page.waitForTimeout(800);
	await rdlg.locator('.btn-primary:visible').first().click();
	await page.waitForTimeout(1500);

	// read the order number off the API response — the toast is easy to miss
	const created = page.waitForResponse(
		(r) => r.url().includes('create_job_order') && r.status() === 200, { timeout: 60_000 });
	await click(page, page.getByRole('button', { name: 'Place Order', exact: true }), 'Place it.');
	let order = '';
	try {
		const body = await (await created).json();
		order = (body?.message?.name) || (JSON.stringify(body).match(/\b(E\d{4,})\b/) || [])[1] || '';
	} catch (e) { /* fall through to the assert below */ }
	await page.waitForTimeout(6000);
	// the last segment of a card is its QTY, not the piece number (qty 5 -> .1.5)
	const CARD = order ? `${order}.1.${QTY}` : '';
	console.log('ORDER =', order, '| CARD =', CARD);
	expect(order, 'the order must have been placed').toBeTruthy();
	await say(page, `Order <b>${order}</b> is in — card <b>${CARD}</b>.`, 3600);

	// ---- print the bag (show the steps, do NOT print) ----
	await gotoApp(page, 'print-order-bags');
	await page.waitForTimeout(3500);
	await say(page, 'The bag gets <b>printed</b> here — pick the cards, then Print. Six to a page.', 4000);
	const rowSel = page.locator(`tr:has-text("${CARD}"), .pob-row:has-text("${CARD}")`).first();
	await rowSel.scrollIntoViewIfNeeded().catch(() => {});
	await spotlight(page, rowSel, `Our card, waiting to be printed.`, 3400).catch(() => {});
	await spotOff(page);
	await spotlight(page, page.getByRole('button', { name: /Print Selected/ }), 'This prints it — we will skip that here.', 3600).catch(() => {});
	await spotOff(page);

	// ============ SHEEJA — the data desk ============
	// moving cards is the data desk's job, not the order desk's
	const sid = process.env.SHEEJA_SID;
	expect(sid, 'SHEEJA_SID must be set').toBeTruthy();
	await context.addCookies([{ name: 'sid', value: sid!, url: process.env.BASE_URL || 'http://development.localhost:8000' }]);
	await gotoHome(page);
	await say(page, 'Now <b>Sheeja</b> takes over at the data desk.', 3200);

	async function assignCollect(bench: string, workType: string, note: string) {
		await gotoApp(page, 'assign-collect');
		await page.waitForTimeout(3000);
		await say(page, note, 3400);
		// --- assign
		await page.locator('.ac-tab[data-mode="assign"]').click();
		await page.waitForTimeout(700);
		await typeInto(page, page.locator('.ac-scan input'), CARD, 'Scan the card.');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(3500);
		const emp = page.locator('.ac-emp input');
		await emp.click();
		await emp.pressSequentially('A', { delay: 60 });
		await page.waitForTimeout(2000);
		await page.getByRole('option').first().click({ timeout: 8000 }).catch(() => {});
		await page.waitForTimeout(1200);
		if (await page.locator('.ac-work select').isVisible().catch(() => false)) {
			await page.locator('.ac-work select').selectOption(workType).catch(() => {});
			await page.waitForTimeout(700);
			await spotlight(page, page.locator('.ac-work'), `Work type: <b>${workType}</b>.`, 3000);
			await spotOff(page);
		}
		await click(page, page.locator('.btn-primary:visible', { hasText: /^Assign/ }).first(), `Assign it at <b>${bench}</b>.`);
		await page.waitForTimeout(4500);
		// --- collect
		await page.locator('.ac-tab[data-mode="collect"]').click();
		await page.waitForTimeout(1200);
		await typeInto(page, page.locator('.ac-scan input'), CARD, 'Scan it back in.');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(3500);
		if (await page.locator('.ac-state select').isVisible().catch(() => false)) {
			await page.locator('.ac-state select').selectOption('Completed').catch(() => {});
			await page.waitForTimeout(700);
		}
		await click(page, page.locator('.btn-primary:visible', { hasText: /^Collect/ }).first(), 'Collect it.');
		await page.waitForTimeout(4500);
	}

	async function transferTo(dest: string, note: string) {
		await gotoApp(page, 'transfer-order-bag');
		await page.waitForTimeout(3000);
		await say(page, note, 3200);
		await typeInto(page, page.locator('.tob-scan input'), CARD, 'Scan the bag.');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(3000);
		await page.locator('.tob-to select').selectOption(dest);
		await page.waitForTimeout(800);
		await click(page, page.getByRole('button', { name: /Transfer All/ }), `Move it to <b>${dest}</b>.`);
		await page.waitForTimeout(5000);
	}

	await transferTo('CAD', 'First move: out of ordering, into <b>CAD</b>.');
	await assignCollect('CAD', 'CAD', 'At <b>CAD</b> the card is given to someone, then collected back.');
	await transferTo('CAM', 'CAD is done — on to <b>CAM</b>.');
	await transferTo('WAXING', 'And from CAM to <b>WAXING</b>.');
	await assignCollect('WAXING', 'Wax Injecting', 'At <b>WAXING</b> the job is <b>Wax Injecting</b>.');

	await say(page, 'Collected at waxing — the card is on its way.', 3600);
	await pause(page, 1500);
	console.log('WALKTHROUGH DONE for', CARD);
});
