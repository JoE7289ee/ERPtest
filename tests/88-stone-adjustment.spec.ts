import { test, expect } from '@playwright/test';

// Count the loose stone room against the books, submit the gap, a manager
// writes it off — and the ledger actually moves.
test('Stone Adjustment: count, request, approve, and the books follow', async ({ page }) => {
  await page.goto('/app/stone-adjustment');
  await page.waitForSelector('.sa2-t tbody tr', { timeout: 30000 });
  await page.waitForTimeout(1200);

  console.log('warehouse  :', (await page.locator('.sa2-wh').textContent())!.replace(/\s+/g, ' ').trim());
  console.log('families   :', (await page.locator('.sa2-f').allTextContents()).join(' / '));

  const kpi = async () => {
    const o: Record<string, string> = {};
    for (const k of await page.locator('.sa2-k').all())
      o[(await k.locator('.k').textContent())!.trim()] = (await k.locator('.v').textContent())!.replace(/\s+/g, '').trim();
    return o;
  };
  console.log('KPI before :', JSON.stringify(await kpi()));

  // the first stone: count it 2 ct light
  const row = page.locator('.sa2-t tbody tr').first();
  const item = (await row.locator('td.sa2-it').textContent())!.trim().split('\n')[0].trim();
  const books = Number((await row.locator('td.sa2-bk').textContent())!.trim().split('\n')[0]);
  console.log('counting   :', item, '· books', books);

  await row.locator('.sa2-in').fill(String(books - 2));
  await page.waitForTimeout(500);
  console.log('difference :', (await row.locator('td.sa2-d').textContent())!.trim());
  expect((await row.locator('td.sa2-d').textContent())!.trim()).toBe('-2.000');
  console.log('KPI after  :', JSON.stringify(await kpi()));
  console.log('button     :', (await page.locator('.sa2-go').textContent())!.trim(),
    '· disabled', await page.locator('.sa2-go').isDisabled());
  // no reason typed yet -> still refused
  expect(await page.locator('.sa2-go').isDisabled()).toBe(true);

  await page.locator('.sa2-why input').fill('spec run — the tray is light');
  await page.waitForTimeout(400);
  expect(await page.locator('.sa2-go').isDisabled()).toBe(false);

  await page.locator('.sa2-go').click();
  const ask = (await page.locator('.modal.show .modal-body').first().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('asks       :', ask.slice(0, 190));
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(4000);

  const pending = (await page.locator('.sa2-body').textContent())!.replace(/\s+/g, ' ').trim();
  console.log('pending    :', pending.slice(0, 150));
  expect(pending).toContain('SADJ-');
  expect(await page.locator('.sa2-ok').count()).toBeGreaterThan(0);

  // approve it -> a Stock Reconciliation, and the books drop by 2
  await page.locator('.sa2-ok').first().click();
  await page.locator('.modal.show .btn-primary', { hasText: 'Yes' }).click();
  await page.waitForTimeout(6000);

  // it is off the Pending tab now — that IS the outcome
  console.log('pending now:', (await page.locator('.sa2-body').textContent())!.replace(/\s+/g, ' ').trim().slice(0, 60));
  await page.locator('.sa2-tab', { hasText: 'Recent' }).click();
  await page.waitForTimeout(2000);
  const after = (await page.locator('.sa2-body').textContent())!.replace(/\s+/g, ' ').trim();
  console.log('recent     :', after.slice(0, 200));
  expect(after).toContain('Approved');
  expect(after, 'the Stock Reconciliation it wrote').toMatch(/MAT-RECO|SR-|STO-RECO/);

  await page.reload();
  await page.waitForSelector('.sa2-t tbody tr', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const nowBooks = Number((await page.locator('.sa2-t tbody tr').filter({ hasText: item }).first()
    .locator('td.sa2-bk').textContent())!.trim().split('\n')[0]);
  console.log('books now  :', nowBooks, '(was', books + ')');
  expect(Math.abs(nowBooks - (books - 2))).toBeLessThan(0.0006);
});
