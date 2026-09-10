import { test, expect } from '@playwright/test';

test('Remove Hallmarking: a table, KPIs, one reason for the lot', async ({ page }) => {
  const pieces = (process.env.PIECES || '').split(',').filter(Boolean);
  test.skip(pieces.length < 2, 'need two hallmarked pieces');
  await page.goto('/app/remove-hallmarking');
  await page.waitForSelector('.rh-f input', { timeout: 30000 });

  // the session list is gone
  const secs = await page.locator('.rh-sec').allTextContents();
  console.log('sections:', JSON.stringify(secs));
  expect(secs.join('|').toLowerCase()).not.toContain('removed this session');

  for (const p of pieces.slice(0, 2)) {
    await page.locator('.rh-f input').fill(p.replace(/^E/i, ''));   // no E
    await page.locator('.rh-f input').press('Enter');
    await page.waitForTimeout(1000);
  }
  const rows = await page.locator('.rh-t tbody tr').count();
  console.log('rows:', rows);
  expect(rows).toBe(2);
  console.log('row 1:', (await page.locator('.rh-t tbody tr').first().textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 95));

  const kpis = await page.evaluate(() => [...document.querySelectorAll('.rh-kpis .rh-kpi')].map((k) => ({
    k: (k.querySelector('.k')?.textContent || '').trim(),
    v: (k.querySelector('.v')?.textContent || '').trim(),
    detail: (k.querySelector('.rh-bt')?.textContent || '').replace(/\s+/g, ' ').trim() ||
            (k.querySelector('.sub')?.textContent || '').trim() })));
  console.log('KPIs:', JSON.stringify(kpis, null, 1));
  expect(kpis.some((x) => x.k === 'Centres')).toBe(true);
  expect(kpis.some((x) => x.k === 'Batches')).toBe(true);

  // double scan refused
  await page.locator('.rh-f input').fill(pieces[0].replace(/^E/i, ''));
  await page.locator('.rh-f input').press('Enter');
  await page.waitForTimeout(800);
  expect(await page.locator('.rh-t tbody tr').count()).toBe(2);
  console.log('double scan:', (await page.locator('.rh-msg').textContent() || '').trim().slice(0, 60));

  console.log('button:', (await page.locator('.rh-go').textContent() || '').trim());
  await page.locator('.rh-go').click();
  await page.waitForSelector('.modal.show [data-fieldname="reason"]', { timeout: 10000 });
  // (the empty-reason guard is proven server-side — clicking it here stacks
  // Frappe's own Missing Values dialog over the one we still need)
  await page.locator('.modal.show [data-fieldname="reason"] textarea').fill('stamp unreadable on the whole tray');
  await page.locator('.modal.show .btn-primary', { hasText: 'Remove them' }).click();
  await page.waitForTimeout(4500);
  console.log('after:', (await page.locator('.rh-msg').textContent() || '').trim().slice(0, 100));
  expect(await page.locator('.rh-t tbody tr td.bag').count(), 'table cleared').toBe(0);
});
