// TUTORIAL 05 — Add a size to a design type, then order it.
// Actor: Sangeetha (Jewelima Ordering). A nose-pin only offers size NA on Place
// Order; she adds XS on Design Types, comes back, and places the order.
import { test, expect, gotoHome, gotoApp, navSidebar, say, click, typeInto, pickLink, pause } from './helpers/tutorial';

const DESIGN = 'A 13047 A';        // approved Design Bank card (a NOSEPIN), has a ready variant
const TYPE = 'NOSEPIN';
const SIZE = 'XS';
const PARTY = 'AJ-KUR-TCR-KL';     // a real party from the Parties directory

test('Add a size to a design type, then order it', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Sangeetha wants to order a <b>nose-pin</b> — but the size she needs is missing.', 2600);

	// --- Place Order: the design only offers NA ---
	await navSidebar(page, [['Orders', 'Open <b>Orders</b>.']], 'place-order', 'Go to <b>Place Order</b>.');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	const bankIn = page.locator('.po-grid tbody tr').first().locator('input[data-fieldname="bank"]');
	await pickLink(page, bankIn, DESIGN, 'Pick the design from the <b>Design Bank</b> — its variant fills in.');
	await page.locator('.po-grid tbody tr').first().locator('input[data-fieldname="design"]')
		.waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 800);
	const size = page.locator('.po-grid tbody tr').first().locator('select').first();
	await expect(size).toBeVisible({ timeout: 10_000 });
	await pause(page, 500);
	let opts = await size.locator('option').allInnerTexts();
	expect(opts.join(',')).toContain('NA');
	await say(page, 'The Size list only has <b>NA</b> — there’s no XS. Let’s add it.', 3000);

	// --- Design Types: add XS to the type (sidebar → Order Setup → Design Types) ---
	await navSidebar(page, [['Setup', 'Open <b>Setup</b> in the sidebar.'], ['Order Setup', 'Then <b>Order Setup</b>.']],
		'design-types', 'Open <b>Design Types</b>.');
	await page.locator('#page-design-types').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	const typeRow = page.locator('table.dt-tbl tbody tr', { hasText: TYPE }).first();
	const addSize = typeRow.locator('.dt-addsize');
	await typeInto(page, addSize, SIZE, `On the <b>${TYPE}</b> row, type the new size…`);
	await addSize.press('Enter');
	await pause(page, 1200);
	await expect(typeRow).toContainText(SIZE, { timeout: 8000 });
	await say(page, 'XS is added to the design’s size list.', 2400);

	// --- back to Place Order: XS is now available; place the order ---
	await navSidebar(page, [['Orders', 'Open <b>Orders</b>.']], 'place-order', 'Back to <b>Place Order</b>.');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	await pickLink(page, page.locator('.po-h-customer input'), PARTY, 'Pick the party.');
	await typeInto(page, page.locator('.po-h-days input'), '15', 'Set the due in days.');

	const bankIn2 = page.locator('.po-grid tbody tr').first().locator('input[data-fieldname="bank"]');
	await pickLink(page, bankIn2, DESIGN, 'Pick the design again from the Design Bank.');
	await page.locator('.po-grid tbody tr').first().locator('input[data-fieldname="design"]')
		.waitFor({ state: 'visible', timeout: 10_000 });
	await pause(page, 700);
	const size2 = page.locator('.po-grid tbody tr').first().locator('select').first();
	opts = await size2.locator('option').allInnerTexts();
	expect(opts.join(',')).toContain(SIZE);
	await say(page, 'Now <b>XS</b> is in the list — choose it.', 2400);
	await click(page, size2, '');
	await size2.selectOption(SIZE);
	await pause(page, 500);

	await typeInto(page, page.locator('.po-grid tbody tr').first().locator('input[type="number"]'), '1', 'Quantity: 1.');
	await click(page, page.getByRole('button', { name: 'Place Order', exact: true }), 'Place the order.');
	await expect(page.locator('.modal:visible')).toContainText('Order placed', { timeout: 15_000 });
	await say(page, 'Order placed — one nose-pin in size XS.', 2600);
});
