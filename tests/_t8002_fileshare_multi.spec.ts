// File Share: an admin ticks several files and deletes them in one go; another login sees no ticks.
//   . ./t8002-env.sh && SMOKE_SID=$(SID Administrator) OTHER_SID=$(SID sangeetha@jd.in) npx playwright test _t8002_fileshare_multi --project=chromium --no-deps
import { test, expect } from '@playwright/test';
test.use({ video: 'off' });
test('file share multi delete', async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await context.addCookies([{ name: 'sid', value: process.env.SMOKE_SID!, url: process.env.BASE_URL! }]);
  await page.goto('/desk/file-share');
  const p = page.locator('#page-file-share');
  await expect(p.locator('.fs-drop')).toBeVisible({ timeout: 60_000 });
  const tag = 'ZZT' + Math.random().toString(36).slice(2, 7);
  await p.locator('.fs-file').setInputFiles([1, 2, 3].map((i) => ({ name: `${tag}-${i}.txt`, mimeType: 'text/plain', buffer: Buffer.from('x' + i) })));
  await p.locator('.fs-q').fill(tag);
  await expect(p.locator('.fs-one')).toHaveCount(3, { timeout: 30_000 });
  await expect(p.locator('.fs-rmsel')).toBeHidden();
  await p.locator('.fs-one').nth(0).check();
  await expect(p.locator('.fs-rmsel')).toHaveText('Delete selected (1)');
  await p.locator('.fs-all').click();
  await expect(p.locator('.fs-rmsel')).toHaveText('Delete selected (3)');
  await p.locator('.fs-all').click();
  await expect(p.locator('.fs-rmsel')).toBeHidden();
  await p.locator('.fs-one').nth(0).check(); await p.locator('.fs-one').nth(1).check();
  await p.locator('.fs-rmsel').click();
  await page.locator('.modal.show .btn-primary').first().click();
  await expect(p.locator('.fs-one')).toHaveCount(1, { timeout: 20_000 });
  // someone who is not an admin: no ticks, and the call itself is refused
  const c2 = await browser.newContext({ baseURL: process.env.BASE_URL });
  await c2.addCookies([{ name: 'sid', value: process.env.OTHER_SID!, url: process.env.BASE_URL! }]);
  const p2 = await c2.newPage();
  await p2.goto('/desk/file-share');
  await expect(p2.locator('#page-file-share .fs-drop')).toBeVisible({ timeout: 60_000 });
  await p2.locator('#page-file-share .fs-q').fill(tag);
  await expect(p2.locator('#page-file-share .fs-body tr[data-n]')).toHaveCount(1, { timeout: 20_000 });
  await expect(p2.locator('#page-file-share .fs-one')).toHaveCount(0);
  const left = await p2.locator('#page-file-share .fs-body tr[data-n]').getAttribute('data-n');
  const refused = await p2.evaluate((n) => new Promise((res) => (window as any).frappe.call({ method: 'jewelima.jewelima.api.file_share_delete_many', args: { names: JSON.stringify([n]) }, error: () => res(true) }).then(() => res(false), () => res(true))), left);
  expect(refused).toBe(true);
  await c2.close();
  await p.locator('.fs-all').click(); await p.locator('.fs-rmsel').click();
  await page.locator('.modal.show .btn-primary').first().click();
  await expect(p.locator('.fs-one')).toHaveCount(0, { timeout: 20_000 });
});
