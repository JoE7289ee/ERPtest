import { test, expect } from '@playwright/test';

test('Rework: E-less scan, a table, a destination, KPIs, batch send', async ({ page }) => {
  const pieces = (process.env.PIECES || '').split(',').filter(Boolean);
  console.log('pieces:', pieces);
  test.skip(pieces.length < 2, 'need two finished pieces in stock');

  await page.goto('/app/rework');
  await page.waitForSelector('.rw-scan input', { timeout: 30000 });

  // the destination picker, defaulting to REWORK
  const dest = page.locator('.rw-dest select');
  await expect(dest).toHaveValue('REWORK');
  console.log('destinations:', (await dest.locator('option').allTextContents()).join(', '));

  // "Sent back this session" is a button at the top now
  const sentBtn = page.locator('.page-actions button', { hasText: 'Sent back this session' });
  await expect(sentBtn, 'top button').toBeVisible();
  console.log('top button:', (await sentBtn.textContent() || '').trim());

  // scan two, both WITHOUT the E
  for (const p of pieces.slice(0, 2)) {
    await page.locator('.rw-scan input').fill(p.replace(/^E/i, ''));
    await page.locator('.rw-scan input').press('Enter');
    await page.waitForTimeout(900);
  }
  const rows = await page.locator('.rw-t tbody tr').count();
  console.log('rows on the table:', rows);
  expect(rows).toBe(2);
  console.log('first row:', (await page.locator('.rw-t tbody tr').first().textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 90));

  // KPIs below the table
  const kpis = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.rw-kpis .rw-kpi')].map((k) => [
      (k.querySelector('.k')?.textContent || '').trim(),
      (k.querySelector('.v')?.textContent || '').trim()])));
  console.log('KPIs:', JSON.stringify(kpis));
  expect(kpis['Total gross']).toBeTruthy();
  expect(kpis['Stones by bracket']).toBeTruthy();
  console.log('brackets:', (await page.locator('.rw-brk .rw-bt').textContent().catch(() => '(none)') || '').replace(/\s+/g, ' ').trim());

  // a double scan is refused rather than booked twice
  await page.locator('.rw-scan input').fill(pieces[0].replace(/^E/i, ''));
  await page.locator('.rw-scan input').press('Enter');
  await page.waitForTimeout(800);
  expect(await page.locator('.rw-t tbody tr').count(), 'double scan not added').toBe(2);
  console.log('double scan:', (await page.locator('.rw-msg').textContent() || '').trim().slice(0, 70));

  // pick a different destination, then send the lot
  await dest.selectOption('FILING');
  await page.waitForTimeout(300);
  const go = page.locator('.rw-go');
  console.log('button says:', (await go.textContent() || '').trim());
  await go.click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4000);
  console.log('after send:', (await page.locator('.rw-msg').textContent() || '').trim().slice(0, 110));
  expect(await page.locator('.rw-t tbody tr td.bag').count(), 'table cleared').toBe(0);
  console.log('top button now:', (await sentBtn.textContent() || '').trim());
  expect((await sentBtn.textContent() || '')).toContain('(2)');

  // and the session list opens from it
  await sentBtn.click();
  await page.waitForTimeout(900);
  console.log('session list:', (await page.locator('.modal.show .modal-body table').textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 130));
});
