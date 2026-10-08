// Findings: issue has no "to a location"; recover works from a scanned card and says why a locked card is refused.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_findings_cards --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('findings cards only', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const [finished, floor] = (process.env.CARDS || 'E7624.1.1,E7627.1.1').split(',');
  await page.goto('/desk/issue-findings');
  await expect(page.locator('.if-go')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.if-tab')).toHaveCount(0);
  await expect(page.locator('.if-loc')).toHaveCount(0);
  await expect(page.locator('.if-bag input')).toBeVisible();
  await page.goto('/desk/recover-findings');
  const scan = page.locator('.rf-scan');
  await expect(scan).toBeVisible({ timeout: 60_000 });
  await scan.fill(finished); await scan.press('Enter');
  await expect(page.locator('.rf-list .rf-msg.err')).toContainText('finished product', { timeout: 20_000 });
  await expect(page.locator('.rf-go')).toBeDisabled();
  await scan.fill(floor.replace(/^E/, '')); await scan.press('Enter');
  await expect(page.locator('.rf-loc')).toContainText(floor, { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/recover-findings.png' });
  expect(errors).toEqual([]);
});
