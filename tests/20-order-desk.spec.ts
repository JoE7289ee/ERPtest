// TUTORIAL 20 — the ordering desk: order several bags of one design, then print
// and transfer them from ORDERING without leaving the desk. Actor: Anakha K Jayan.
//
// Doubles as the dev SEEDER — it leaves real cards behind for other tests:
//   BAGS=25 npx playwright test 20-order-desk          # how many bags
//   SEED=1 BAGS=25 npx playwright test 20-order-desk   # no captions, much faster
//   KEEP_IN_ORDERING=1 ...                             # skip the transfer, leave them in ORDERING
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink, spotlight, spotOff, pause } from './helpers/tutorial';

const VARIANT = process.env.VARIANT || 'A13405NP-18EF-Y';   // override when seeding a site that has different designs
const PARTY   = 'AJ-KUR-TCR-KL';
const OTYPE   = 'CUSTOMER';
const BAGS    = parseInt(process.env.BAGS || '6', 10);
const SEED    = process.env.SEED === '1';          // seeding: skip the narration
const KEEP    = process.env.KEEP_IN_ORDERING === '1';

// in seed mode the helpers become no-ops so the run is quick
const narrate = async (p: any, html: string, ms?: number) => { if (!SEED) await say(p, html, ms); };
const spot = async (p: any, loc: any, html: string, ms?: number) => { if (!SEED) { await spotlight(p, loc, html, ms); await spotOff(p); } };
const wait = (p: any, ms: number) => p.waitForTimeout(SEED ? Math.min(ms, 1200) : ms);

test(`ordering desk — ${BAGS} bags, print and transfer`, async ({ page }) => {
	test.setTimeout(90_000 + BAGS * 20_000);

	await gotoHome(page);
	await narrate(page, `A repeat order: <b>${BAGS} bags</b> of the same design, then printed and sent on — all from the ordering desk.`, 4200);

	await gotoApp(page, 'place-order');
	await page.locator('#page-place-order').waitFor({ state: 'visible', timeout: 20_000 });
	await wait(page, 800);

	await pickLink(page, page.locator('.po-h-customer input'), PARTY, SEED ? '' : 'The <b>party</b>.');
	await wait(page, 500);
	await pickLink(page, page.locator('.po-h-ordertype input'), OTYPE, SEED ? '' : 'The <b>type</b>.');
	await wait(page, 500);
	await typeInto(page, page.locator('.po-h-days input'), '15', SEED ? '' : 'Due in 15 days.');
	await wait(page, 500);

	// one line for the whole quantity, then SPLIT it into a bag each
	const row0 = page.locator('.po-grid tbody tr').first();
	await typeInto(page, row0.locator('input[data-fieldname="bank"]'), VARIANT, SEED ? '' : 'The design — typed by its variant code.');
	await expect.poll(async () => await page.evaluate(() =>
		((document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim()),
		{ timeout: 25_000 }).toBe(VARIANT);
	await row0.locator('input[type="number"]').first().fill(String(BAGS));
	await page.waitForTimeout(SEED ? 400 : 1000);
	await narrate(page, `All ${BAGS} on one line — now <b>Split</b> turns it into a bag each.`, 3800);

	await click(page, row0.locator('button:has-text("Split")'), SEED ? '' : 'Split the line.');
	const sdlg = page.locator('.modal:visible').last();
	await sdlg.waitFor({ state: 'visible', timeout: 10_000 });
	await page.waitForTimeout(SEED ? 500 : 1200);
	await page.evaluate((n) => {
		const d = (window as any).cur_dialog;
		if (d) d.set_value('bags', n);
	}, BAGS);
	await page.waitForTimeout(SEED ? 400 : 900);
	await sdlg.locator('.btn-primary:visible').first().click();
	// the split must really have produced BAGS filled lines (the grid always keeps
	// one blank spare row on the end, so count the lines that carry a design)
	await expect.poll(async () => await page.evaluate(() =>
		Array.from(document.querySelectorAll('.po-grid tbody tr'))
			.filter((r) => ((r.querySelector('input[data-fieldname="design"]') as HTMLInputElement)?.value || '').trim()).length),
		{ timeout: 20_000 }).toBe(BAGS);
	await wait(page, 1500);
	await spot(page, page.locator('.po-grid'), `<b>${BAGS} lines</b>, one piece each — one bag per line.`, 3600);

	const created = page.waitForResponse((r) => r.url().includes('create_job_order') && r.status() === 200, { timeout: 90_000 });
	await click(page, page.getByRole('button', { name: 'Place Order', exact: true }), SEED ? '' : 'Place the order.');
	const body = await (await created).json();
	const order = (typeof body?.message === 'string' ? body.message : body?.message?.name) || '';
	expect(order, 'the order must have been placed').toBeTruthy();
	await page.waitForTimeout(SEED ? 3000 : 6000);
	console.log(`ORDER = ${order} | BAGS = ${BAGS}`);
	await narrate(page, `Order <b>${order}</b> — ${BAGS} cards, all waiting in ordering.`, 3600);

	// ---- the ordering desk: print, then send them on ----
	await gotoApp(page, 'ws-ordering');
	await page.waitForTimeout(SEED ? 2500 : 4000);
	await narrate(page, 'The <b>Ordering Desk</b> holds everything still in ordering — print and transfer live right here.', 4200);

	await page.locator('.od-all').first().check({ timeout: 10_000 }).catch(() => {});
	await page.waitForTimeout(SEED ? 800 : 2000);
	const ticked = await page.evaluate(() => document.querySelectorAll('.od-cb:checked').length);
	console.log(`TICKED = ${ticked}`);
	await spot(page, page.locator('.od-pr'), 'This <b>prints</b> the job cards — we will not print here.', 3600);

	if (KEEP) {
		console.log('KEEP_IN_ORDERING — left in ORDERING');
		return;
	}

	await click(page, page.locator('.od-tr'), SEED ? '' : 'Send them on.');
	const tdlg = page.locator('.modal:visible').last();
	await tdlg.waitFor({ state: 'visible', timeout: 10_000 });
	await page.waitForTimeout(SEED ? 800 : 1800);
	await tdlg.locator('select').first().selectOption('CAD').catch(() => {});
	await page.waitForTimeout(600);
	await spot(page, tdlg, 'Straight to <b>CAD</b>.', 3000);
	await tdlg.locator('.btn-primary:visible').first().click();
	await page.waitForTimeout(SEED ? 6000 : 9000);

	await narrate(page, `Done — ${BAGS} cards printed off and sent to CAD.`, 3600);
	if (!SEED) await pause(page, 1500);
	console.log(`DONE order=${order}`);
});
