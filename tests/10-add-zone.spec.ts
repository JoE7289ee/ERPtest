// TUTORIAL 10 — Add a new Zone master.
// Actor: Jishnu T J. A locality isn't in the Zone list yet — add it on Party
// Masters so it's available when building party names.
import { test, expect, gotoHome, navSidebar, say, click, typeInto, moveTo, pause } from './helpers/tutorial';

test('Add a new zone', async ({ page }) => {
	await gotoHome(page);
	await say(page, 'Jishnu needs a locality that isn’t listed yet — <b>Guruvayur</b>. Let’s add the zone.', 3000);

	await navSidebar(page, [['Party', 'Open the <b>Party</b> menu.']], 'party-masters', 'Open <b>Party Masters</b>.');
	await page.locator('#page-party-masters').waitFor({ state: 'visible', timeout: 20_000 });
	await pause(page, 900);

	const zoneCard = page.locator('.pm-card[data-kind="zone"]');
	await moveTo(page, zoneCard.locator('.h .t'));
	await say(page, 'Each master has an <b>add</b> row — code + full name. Zones can repeat across areas.', 3600);

	await typeInto(page, zoneCard.locator('.pm-addrow .code'), 'GVR', 'A short <b>code</b> for the zone…');
	await typeInto(page, zoneCard.locator('.pm-addrow .label'), 'Guruvayur', '…and the full name.');
	await click(page, zoneCard.locator('.pm-add'), 'Add it.');
	await expect(zoneCard.locator('table.pm-tbl')).toContainText('GVR', { timeout: 8000 });
	await say(page, '<b>GVR — Guruvayur</b> is added, ready to use on any new party.', 3000);
});
