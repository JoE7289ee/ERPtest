import { test, expect } from '@playwright/test';

test('Confirm HUID reloads its pool every time it is shown', async ({ page }) => {
  let pool = 0;
  page.on('request', (r) => { if (r.url().includes('get_huid_pool')) pool++; });

  await page.goto('/app/confirm-huid');
  await page.waitForTimeout(2500);
  const first = pool;
  console.log('pool loads on first open:', first);
  expect(first).toBeGreaterThan(0);

  // leave and come back — the browser keeps the page, so only on_page_show can
  // make it ask the server again. This is the stale-cache case the redirect hits.
  await page.goto('/app/hallmark-out');
  await page.waitForTimeout(2000);
  await page.goto('/app/confirm-huid');
  await page.waitForTimeout(2500);
  console.log('pool loads after coming back:', pool);
  expect(pool, 'coming back re-asks the server').toBeGreaterThan(first);

  // and the batch collected a moment ago is on it, unaided
  const txt = await page.evaluate(() => {
    const el = document.getElementById('page-confirm-huid');
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  });
  console.log('HALL-0063 present:', txt.includes('HALL-0063'));
  expect(txt).toContain('HALL-0063');
});
