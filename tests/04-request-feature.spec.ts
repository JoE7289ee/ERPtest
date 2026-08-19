// TUTORIAL 04 — Request a feature and track it.
// Actor: Lenus Thomas (Jewelima Info). Raises a request, then learns to read the
// status stages and to filter to just his own. Real account on the local bench.
import { test, expect, gotoHome, sidebarLink, say, click, typeInto, pause } from './helpers/tutorial';

const REQUEST = 'Please add a dark-mode option for the desk — it would be easier on the eyes during long shifts.';

test('Request a feature and track it', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Anyone can request a feature and follow its progress.', 2400);

	await click(page, sidebarLink(page, 'request-feature'), 'Open <b>Request Feature</b> from the sidebar.');
	await page.locator('#page-request-feature').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 700);

	// raise a request
	await typeInto(page, page.locator('.rf-desc'), REQUEST, 'Describe what you want — write as much as you like.');
	await click(page, page.locator('.rf-submit'), 'Submit the request.');
	await pause(page, 1500);
	await say(page, 'It’s in — every request starts as <b>Open</b>.', 2400);

	// see through the stages
	await say(page, 'These tiles are the stages a request moves through.', 2400);
	await click(page, page.locator('.rf-tile[data-s="Open"]'), 'Click <b>Open</b> to see open requests.');
	await pause(page, 800);
	await click(page, page.locator('.rf-tile[data-s="In Progress"]'), 'Or <b>In Progress</b> — being worked on.');
	await pause(page, 800);
	await click(page, page.locator('.rf-tile[data-s="Closed"]'), 'Or <b>Closed</b> — finished ones.');
	await pause(page, 800);
	await click(page, page.locator('.rf-tile[data-s=""]'), 'Back to <b>All</b>.');
	await pause(page, 700);

	// filter to just mine
	await click(page, page.locator('.rf-mine'), 'Tick <b>only mine</b> to see just your own requests.');
	await pause(page, 1400);
	await say(page, 'That’s it — raise requests and track them right here.', 2600);
});
