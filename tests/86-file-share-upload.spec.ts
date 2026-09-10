import { test, expect } from '@playwright/test';

// Three files in one go used to leave the page behind a freeze overlay still
// reading "Uploading 1 of 3" — frappe.dom.freeze() counts its calls, so three
// freezes against one unfreeze never lifted, and only a reload cleared it.
test('a three-file upload finishes on screen — no stuck overlay, no reload', async ({ page }) => {
  test.setTimeout(600000);                       // the dev bench is slow to boot the desk
  const t0 = Date.now();
  const lap = (s: string) => console.log('  ⏱', s, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  page.on('requestfinished', async (r) => {
    if (r.url().includes('file_share_upload')) {
      const t = r.timing();
      console.log('  [upload]', (await r.response())?.status(), Math.round(t.responseEnd - t.startTime) + 'ms');
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('file_share')) console.log('  [failed]', r.url().split('.').pop(), r.failure()?.errorText);
  });

  await page.goto('/app/file-share');
  lap('goto');
  await page.waitForSelector('.fs-drop', { timeout: 60000 });
  await page.waitForTimeout(800);
  lap('page ready');

  const before = await page.locator('.fs-t tbody tr').count();
  console.log('rows before  :', before);

  const stamp = Date.now();
  await page.locator('.fs-file').setInputFiles([1, 2, 3].map((n) => ({
    name: `share-test-${stamp}-${n}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(`file ${n} of the three-at-once test\n`),
  })));

  // wait on the page's own state, not on a toast that comes and goes — and on
  // the names, not a row count: the list is capped nowhere now, but a count is
  // the wrong thing to hang a test on either way
  await page.waitForFunction(
    (s) => [...document.querySelectorAll('.fs-t tbody tr')]
      .filter((r) => (r.textContent || '').includes(s)).length === 3,
    `share-test-${stamp}`, { timeout: 120000 });
  lap('three rows listed');
  await page.waitForTimeout(800);

  const frozen = await page.locator('#freeze.in').count();
  const count = await page.evaluate(() => (window as any).frappe.dom.freeze_count);
  // .textContent() on a missing element waits for it to appear, and this config
  // sets no action timeout — so ask whether it is there first
  const $msg = page.locator('#freeze .freeze-message p.lead');
  const msg = (await $msg.count()) ? await $msg.textContent() : '(no overlay)';
  console.log('freeze left  :', frozen, '· freeze_count', count, '· overlay:', msg);
  expect(frozen, 'the overlay must be gone').toBe(0);
  expect(count, 'freeze/unfreeze must balance').toBe(0);

  const after = await page.locator('.fs-t tbody tr').count();
  const names = await page.locator('.fs-t tbody tr').evaluateAll((rs) =>
    rs.slice(0, 3).map((r) => (r.querySelector('td')?.textContent || '').trim()));
  console.log('rows before/after:', before, '->', after);
  names.forEach((n) => console.log('   ', n));
  expect(after, 'all three land in the list').toBe(before + 3);
  expect(names.join(' '), 'and they are there without a reload').toContain(`share-test-${stamp}`);
});
