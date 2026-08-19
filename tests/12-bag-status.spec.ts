// TUTORIAL 12 — Bag Status: upload the Bag Status report and read the key tabs.
// Actor: Femi Paul (ESMITH). Export the report from E-Smith, upload it, and walk
// the two tabs that matter — CUST and KPI. Uses highlight "spotlight" boxes.
import { test, gotoHome, gotoApp, say, click, spotlight, spotOff, pause } from './helpers/tutorial';

const REPORT = '/Users/josephdaison/Downloads/BAG_STATUS_REPORT_11-06-2026-09-53-44.xlsx';

test('Bag Status — upload the report and read CUST + KPI', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'In <b>E-Smith</b>, export the <b>Bag Status</b> report — leave it exactly as it is…', 3400);
	await say(page, '…then bring it here, to <b>Bag Status</b>.', 2400);

	// Bag Status lives under the E-Smith menu
	const esmith = page.locator('.section-item').filter({ hasText: 'E-SMITH' }).locator('.standard-sidebar-item').first();
	await spotlight(page, esmith, 'Bag Status lives under the <b>E-SMITH</b> menu.', 2800);
	await spotOff(page);
	await gotoApp(page, 'bag-status');
	await page.locator('#page-bag-status').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 800);

	// --- upload the report ---
	await spotlight(page, page.locator('.bs-file'), 'Upload the <b>.xlsx</b> you exported from E-Smith.', 2800, true);
	await page.locator('.bs-input').setInputFiles(REPORT);
	await page.locator('.bs-views button[data-v="cust"]').waitFor({ state: 'visible', timeout: 45_000 });
	await pause(page, 500);
	await spotOff(page);
	await say(page, 'Parsed — the whole factory’s work-in-progress, straight from the file.', 2800);

	// --- headline tiles ---
	await spotlight(page, page.locator('.bs-tiles'), 'Headline totals for the WIP on the floor.', 3000);

	// --- CUST tab ---
	await spotlight(page, page.locator('.bs-views button[data-v="cust"]'), 'Open the <b>CUST</b> tab.', 1800, true);
	await click(page, page.locator('.bs-views button[data-v="cust"]'), '');
	await pause(page, 900);
	await say(page, '<b>CUST</b> — the customer-marked bags, most <b>past-due first</b>.', 3200);
	await spotlight(page, page.locator('.bs-body'), 'Tick locations or set a <b>due</b> filter to narrow it — the same rows print.', 3800);

	// --- KPI tab ---
	await spotlight(page, page.locator('.bs-views button[data-v="kpi"]'), 'Open the <b>KPI</b> dashboard.', 1800, true);
	await click(page, page.locator('.bs-views button[data-v="kpi"]'), '');
	await pause(page, 1000);
	await spotlight(page, page.locator('.bs-body'), 'WIP exposure, aging, <b>bottleneck stages</b>, holder load and CUST delivery risk.', 4400);
	await spotOff(page);
	await say(page, 'That’s Bag Status — the WIP report, read at a glance.', 2600);
});
