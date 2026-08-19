// TUTORIAL 18 — OLD Design end to end: approve a pending card, make its variant,
// then order it. Actor: Anakha K Jayan (Jewelima Ordering).
// Shows the live card preview (stones -> DW -> the card redraws) added today.
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const DESIGN = 'A 13013';          // pending — note 'A 13013 SD' also exists
const BANK   = '6hoivf7eov';       // the record behind A 13013
const TYPE   = 'NOSEPIN';
const SIEVE  = '1.5-2';
const PCS    = '4';
const PARTY  = 'AJ-KUR-TCR-KL';
const OTYPE  = 'CUSTOMER';
const QTY    = '5';

test('OLD Design → variant → order', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'A customer wants an <b>old design</b> that was never approved. Anakha can do the whole thing from Place Order.', 4000);

	await gotoApp(page, 'place-order');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	// ---- set the order up first --------------------------------------------
	await pickLink(page, page.locator('.po-h-customer input'), PARTY, 'Start with the <b>party</b>.');
	await page.waitForTimeout(700);
	await pickLink(page, page.locator('.po-h-ordertype input'), OTYPE, 'And the <b>type</b> — this one is required.');
	await page.waitForTimeout(700);
	await typeInto(page, page.locator('.po-h-days input'), '15', 'Due in 15 days.');
	await page.waitForTimeout(900);

	// ---- approve the pending card -----------------------------------------
	await click(page, page.getByRole('button', { name: 'OLD Design' }), 'Open <b>OLD Design</b>.');
	const dlg = page.locator('.modal:visible').last();
	await dlg.waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 700);
	await say(page, `Find <b>${DESIGN}</b> — only <b>pending</b> designs are listed here.`, 3400);

	await pickLink(page, dlg.locator('input[data-fieldname="pick"]'), DESIGN, '');
	// let THIS load finish before touching anything: a second load landing late
	// repaints the sieve table and silently throws away the stone edits
	await page.waitForTimeout(9000);
	// two cards start with this number — correct it only if the wrong one loaded,
	// and again wait for that load to settle
	const loaded = await page.evaluate(() => (window as any).cur_dialog.get_value('pick'));
	if (loaded !== BANK) {
		await page.evaluate((n) => { (window as any).cur_dialog.set_value('pick', n); }, BANK);
		await page.waitForTimeout(9000);
	}
	await expect.poll(async () => await dlg.locator('.od-stones tr').count(), { timeout: 15_000 }).toBeGreaterThan(0);
	await say(page, 'The card loads — its photos, weights and stones.', 2800);

	await spotlight(page, dlg.locator('.od-grid'), 'The scan, the info card and the product photo.', 3400);
	await spotOff(page);

	// ---- the stones drive the diamond weight -------------------------------
	await say(page, `The stones going in: <b>${PCS} pieces</b> of sieve <b>${SIEVE}</b>.`, 3400);
	// set the row and re-assert it: a late repaint of the sieve table can clear a
	// native selectOption, and a card approved with no stones is a broken video
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.evaluate(([sv, pc]) => {
			const sel = document.querySelector('.od-stones select.v') as HTMLSelectElement;
			const pcs = document.querySelector('.od-stones input.p') as HTMLInputElement;
			sel.value = sv; sel.dispatchEvent(new Event('change', { bubbles: true }));
			pcs.value = pc; pcs.dispatchEvent(new Event('input', { bubbles: true }));
		}, [SIEVE, PCS]);
		await page.waitForTimeout(2500);
		const ok = await page.evaluate(() => (window as any).cur_dialog.get_value('diamond_weight') > 0);
		if (ok) break;
	}
	await spotlight(page, dlg.locator('[data-fieldname="diamond_weight"]'),
		'<b>Diamond Weight fills itself</b> — pieces × the sieve average. Never typed by hand.', 4000);
	await spotOff(page);

	// ---- the live card preview --------------------------------------------
	await page.waitForTimeout(2500);
	await spotlight(page, dlg.locator('[data-fieldname="card_html"]'),
		'And the <b>card redraws</b> as you edit — this is exactly what gets stored.', 4200);
	await spotOff(page);

	// the whole video is a lie if the stones did not register
	await expect.poll(async () => await page.evaluate(() =>
		(window as any).cur_dialog.get_value('diamond_weight')), { timeout: 15_000 }).toBeGreaterThan(0);

	// ---- design type, then approve -----------------------------------------
	const dt = dlg.locator('select[data-fieldname="design_type"]');
	await expect.poll(async () => await dt.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1);
	await dt.selectOption(TYPE, { timeout: 10_000 });
	await pause(page, 700);
	await say(page, `Give it a <b>Design Type</b> — <b>${TYPE}</b>. That is what lets it be approved.`, 3600);

	await click(page, dlg.getByRole('button', { name: /Approve/ }), 'Approve it.');

	// ---- the variant --------------------------------------------------------
	const vdlg = page.locator('.modal.jw-mat-dlg:visible');
	await expect(vdlg).toBeVisible({ timeout: 25_000 });
	await page.waitForTimeout(1500);
	await say(page, 'Approved — straight on to <b>Create Variant</b>. The design is the blueprint; the variant is what you order.', 4200);

	await vdlg.locator('select[data-fieldname="karat"]').selectOption('18K');
	await page.waitForTimeout(500);
	await vdlg.locator('select[data-fieldname="quality"]').selectOption('EF');
	await page.waitForTimeout(1200);
	await spotlight(page, vdlg.locator('[data-fieldname="prev"]'), 'An <b>18K</b> version with <b>EF</b> stones.', 3400);
	await spotOff(page);
	await click(page, vdlg.getByRole('button', { name: /Create/ }), 'Create the variant.');
	// the header fields are unreachable until the modal and the freeze overlay clear
	await page.locator('.modal.jw-mat-dlg').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
	await page.locator('.freeze').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
	await page.waitForTimeout(3000);

	// ---- order it -----------------------------------------------------------
	await say(page, 'The party and the type are already set — all that is left is how many.', 3600);

	// the variant lands in the row asynchronously — typing a qty before it arrives
	// gets the order rejected with "Qty but no Design"
	await expect.poll(async () => await page.evaluate(() => {
		const el = document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement;
		return (el && el.value || '').trim().length;
	}), { timeout: 30_000 }).toBeGreaterThan(0);

	const row = page.locator('.po-grid tbody tr').first();
	await typeInto(page, row.locator('input[type="number"]').first(), QTY, `Quantity: <b>${QTY}</b>.`);
	await page.waitForTimeout(1200);

	await click(page, page.getByRole('button', { name: 'Place Order', exact: true }), 'Place the order.');
	await page.waitForTimeout(6000);
	const alert = (await page.locator('.desk-alert, .alert-body').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
	console.log('ORDER RESULT =', alert.slice(0, 120));
	await say(page, `Done — <b>${QTY} pieces</b> on order, from a design that was not even approved a minute ago.`, 4000);
	await pause(page, 1500);
});
