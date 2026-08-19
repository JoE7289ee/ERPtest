// TUTORIAL 16 — OLD Design: review & approve a pending design from Place Order.
// Actor: Anakha K Jayan (Jewelima Ordering). Shows the karat rule (the bank stores
// an 18K gross) and the automatic Diamond Weight (the DMD sieve average).
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const DESIGN = '18628';   // pending, 246 pcs of sieve 1.5-2 -> DW 1.722
const TYPE = 'PENDANT';

test('OLD Design — review and approve', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Anakha needs an <b>old design</b> that isn’t approved yet — she can do it right from Place Order.', 3400);

	await gotoApp(page, 'place-order');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	await click(page, page.getByRole('button', { name: 'OLD Design' }), 'Open <b>OLD Design</b>.');
	const dlg = page.locator('.modal:visible').last();
	await dlg.waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 700);
	await say(page, 'Search the <b>pending</b> design by its number — approved ones aren’t listed here.', 3400);

	await pickLink(page, dlg.locator('input[data-fieldname="pick"]'), DESIGN, '');
	await page.waitForTimeout(2500);
	// the card must really load, else everything after this is meaningless
	await expect(dlg.locator('input[data-fieldname="gross_weight"]')).not.toHaveValue('0', { timeout: 15_000 });
	await expect.poll(async () => await dlg.locator('.od-stones tr').count(), { timeout: 10_000 }).toBeGreaterThan(0);
	await say(page, 'The card loads — its photos, weights and stones.', 2800);

	await spotlight(page, dlg.locator('.od-grid'), 'Raw scan, the info card, the product photo and the customer image.', 3600);
	await spotOff(page);

	// the sieve rows drive the diamond weight
	await spotlight(page, dlg.locator('.od-stbl'), 'The <b>sieves</b>: each row is a size and how many pieces.', 3400);
	await spotlight(page, dlg.locator('[data-fieldname="diamond_weight"]'),
		'<b>Diamond Weight fills itself</b> — pcs × the sieve’s average. It’s never typed by hand.', 4200);
	await spotOff(page);

	// change pcs -> DW recomputes live
	const pcs = dlg.locator('.od-stones input.p').first();
	await typeInto(page, pcs, '100', 'Change the pieces…');
	await page.waitForTimeout(900);
	await spotlight(page, dlg.locator('[data-fieldname="diamond_weight"]'), '…and the carats follow instantly.', 3000);
	await spotOff(page);
	await typeInto(page, pcs, '246', 'Put the real count back.');
	await page.waitForTimeout(900);

	// the karat rule
	await spotlight(page, dlg.locator('[data-fieldname="karat"]'),
		'The bank stores every gross as an <b>18K</b> figure…', 3200);
	await dlg.locator('select[data-fieldname="karat"]').selectOption('22K');
	await page.waitForTimeout(700);
	await say(page, '…so if you weighed the piece at <b>22K</b>, pick it here and the system converts.', 3600);
	await dlg.locator('select[data-fieldname="karat"]').selectOption('18K');
	await page.waitForTimeout(600);
	await spotOff(page);

	// design type is what makes it approvable (wait for the list to load first)
	const dt = dlg.locator('select[data-fieldname="design_type"]');
	await expect.poll(async () => await dt.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1);
	await dt.selectOption(TYPE, { timeout: 10_000 });
	await pause(page, 600);
	await say(page, 'Give it a <b>Design Type</b> — that’s what lets it be approved.', 3000);

	await click(page, dlg.getByRole('button', { name: /Approve/ }), 'Approve it.');
	// prove it: the Create Variant dialog takes over once the design is approved
	await expect(page.locator('.modal.jw-mat-dlg:visible')).toBeVisible({ timeout: 20_000 });
	await page.waitForTimeout(1200);
	await say(page, 'Approved — and it goes straight on to <b>Create Variant</b>.', 3200);
	await pause(page, 1500);
});
