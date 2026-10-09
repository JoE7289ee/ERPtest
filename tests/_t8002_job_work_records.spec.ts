// Job Work Records: Order date and Party columns, the card's picture on hover, a click marks the line.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) npx playwright test _t8002_job_work_records --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('job work records', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/desk/job-work-records');
  const head = page.locator('.mr-t thead th');
  await expect(head.first()).toBeVisible({ timeout: 60_000 });
  const cols = (await head.allInnerTexts()).map((t) => t.trim().toUpperCase());
  expect(cols.slice(0, 4)).toEqual(['CARD', 'DESIGN', 'ORDER DATE', 'PARTY']);
  const rows = page.locator('.mr-t tbody tr');
  await expect(rows.first().locator('td').nth(2)).toHaveText(/^\d{4}-\d{2}-\d{2}$|^—$/);
  const withPic = page.locator('td.mr-card[data-img]').first();
  await expect(withPic).toBeVisible();
  await withPic.hover();
  await expect(page.locator('.mr-pic')).toBeVisible();
  expect(await page.locator('.mr-pic').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('url(');
  await page.screenshot({ path: 'test-results/job-work-records.png' });
  await page.mouse.move(5, 5);
  await expect(page.locator('.mr-pic')).toBeHidden();
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveClass(/mr-on/);
  await rows.nth(2).click();
  await expect(rows.nth(1)).not.toHaveClass(/mr-on/);
  await expect(rows.nth(2)).toHaveClass(/mr-on/);
  // the other bench books keep their columns
  await page.goto('/desk/assign-collect-records');
  await expect(page.locator('.mr-t thead th').first()).toBeVisible({ timeout: 60_000 });
  expect((await page.locator('.mr-t thead th').allInnerTexts()).map((t) => t.trim().toUpperCase())).not.toContain('PARTY');
  expect(errors).toEqual([]);
});
