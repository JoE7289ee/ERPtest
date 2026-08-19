// TUTORIAL 17 — New Design: mint a brand-new design card from Place Order.
// Actor: Anakha K Jayan (Jewelima Ordering). This is the door for a design that
// has NEVER existed before — it gets a fresh J-series number (RING -> JR-n).
// Shows: the 18K gross rule, the automatic DW from the sieves, the product
// photo, the live card render, then the 22K/EF variant.
import { test, expect, gotoHome, gotoApp, say, click, typeInto, spotlight, spotOff, pause } from './helpers/tutorial';
import fs from 'fs';
import path from 'path';

const TYPE  = 'NOSEPIN';
const SIEVE = '2.5-3';   // avg 0.01 ct -> 6 pcs = DW 0.06
const PCS   = '6';
const GROSS = '0.3';     // weighed at 18K
const PHOTO = path.resolve(__dirname, '../assets/butterfly.png');

test('New Design — create a brand-new design and its 22K EF variant', async ({ page }) => {
	expect(fs.existsSync(PHOTO), `product photo missing at ${PHOTO}`).toBeTruthy();

	await gotoHome(page);
	await say(page, 'This is for a design that has <b>never existed before</b> — a completely new one.', 3600);

	await gotoApp(page, 'place-order');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	await say(page, 'An <b>old</b> design already has a card. A <b>new</b> one gets a fresh number from the system.', 3800);
	await click(page, page.getByRole('button', { name: 'New Design' }), 'Open <b>New Design</b>.');
	const dlg = page.locator('.modal:visible').last();
	await dlg.waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 900);

	// ---- design type -> the J-series number -------------------------------
	const dt = dlg.locator('select[data-fieldname="design_type"]');
	await expect.poll(async () => await dt.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1);
	await spotlight(page, dlg.locator('[data-fieldname="design_type"]'),
		'Pick the <b>Design Type</b> first — it decides the number.', 3400);
	await dt.selectOption(TYPE, { timeout: 10_000 });
	await pause(page, 800);
	await say(page, 'Every new design is numbered in the <b>J-series</b>. A NOSEPIN becomes <b>JNP-…</b>, a RING <b>JR-…</b>.', 4200);
	await spotOff(page);

	// ---- the karat rule ----------------------------------------------------
	await spotlight(page, dlg.locator('[data-fieldname="karat"]'),
		'The bank always stores an <b>18K</b> gross…', 3200);
	await dlg.locator('select[data-fieldname="karat"]').selectOption('22K');
	await page.waitForTimeout(800);
	await say(page, '…so if you weighed it at <b>22K</b> or <b>14K</b>, say so here and the system converts for you.', 4000);
	await dlg.locator('select[data-fieldname="karat"]').selectOption('18K');
	await page.waitForTimeout(600);
	await spotOff(page);

	await typeInto(page, dlg.locator('input[data-fieldname="gross_weight"]'), GROSS,
		'This piece was weighed at <b>18K</b> — 0.3 g.');
	await page.waitForTimeout(900);

	// ---- stones drive the diamond weight -----------------------------------
	await say(page, 'Now the stones. This one has <b>6 pieces</b> of sieve <b>2.5-3</b>.', 3400);
	await dlg.locator('.nd-stones select.v').first().selectOption(SIEVE);
	await page.waitForTimeout(400);
	await typeInto(page, dlg.locator('.nd-stones input.p').first(), PCS, '');
	await page.waitForTimeout(1200);
	await spotlight(page, dlg.locator('[data-fieldname="diamond_weight"]'),
		'<b>Diamond Weight fills itself</b> — pieces × the sieve average. Never typed by hand.', 4200);
	await spotOff(page);
	// prove the DW really computed
	await expect.poll(async () => await page.evaluate(() =>
		(window as any).cur_dialog.get_value('diamond_weight')), { timeout: 10_000 }).toBeGreaterThan(0);

	// ---- the product photo -------------------------------------------------
	await say(page, 'Add the <b>product photo</b>. No photo? It goes to the Photo Queue instead.', 3800);
	await dlg.locator('input.nd-file').setInputFiles(PHOTO);
	await page.waitForTimeout(2500);
	await spotlight(page, dlg.locator('.nd-prev'), 'The photo is in.', 2600);
	await spotOff(page);

	// ---- the live card -----------------------------------------------------
	await page.waitForTimeout(2500);
	await spotlight(page, dlg.locator('[data-fieldname="card_html"]'),
		'The <b>card builds itself</b> as you type — this is what the floor will see.', 4200);
	await spotOff(page);

	await click(page, dlg.getByRole('button', { name: /Create/ }), 'Create it.');

	// ---- straight into the variant ----------------------------------------
	const vdlg = page.locator('.modal.jw-mat-dlg:visible');
	await expect(vdlg).toBeVisible({ timeout: 25_000 });
	await page.waitForTimeout(1500);
	const title = (await vdlg.locator('.modal-title').innerText().catch(() => '')).trim();
	console.log('NEW DESIGN CARD =', title);
	await say(page, 'Created — and it goes straight on to <b>Create Variant</b>.', 3400);

	await say(page, 'The design is the blueprint. The <b>variant</b> is what you actually order — karat, stones, colour.', 4200);
	await vdlg.locator('select[data-fieldname="karat"]').selectOption('22K');
	await page.waitForTimeout(600);
	await vdlg.locator('select[data-fieldname="quality"]').selectOption('EF');
	await page.waitForTimeout(1200);
	await spotlight(page, vdlg.locator('[data-fieldname="prev"]'),
		'A <b>22K</b> version with <b>EF</b> stones.', 3600);
	await spotOff(page);

	await click(page, vdlg.getByRole('button', { name: /Create/ }), 'Create the variant.');
	await page.waitForTimeout(4000);
	await say(page, 'Done — a brand-new design, and a variant ready to order.', 3400);
	await pause(page, 1500);
});
