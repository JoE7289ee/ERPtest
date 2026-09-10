import { test, expect } from '@playwright/test';

test('a sieve reaches the keep table as soon as it is typed, and status is Open/Closed', async ({ page }) => {
  const lot = process.env.LOT || '';
  test.skip(!lot, 'need a lot');
  await page.goto('/app/lot-selection');
  await page.waitForSelector('.ls-f', { timeout: 30000 });
  console.log('board chips:', (await page.locator('.ls-f').allTextContents()).join(' / '));
  expect(await page.locator('.ls-f').allTextContents()).toEqual(['Open', 'Closed', 'All']);

  await page.locator('.ls-f', { hasText: 'All' }).click();
  await page.waitForSelector('.ls-card', { timeout: 20000 });
  const tag = (await page.locator('.ls-card').filter({ hasText: lot }).first().locator('.ls-tag').textContent() || '').trim();
  console.log('lot tag on the board:', tag);
  expect(['Open', 'Closed']).toContain(tag);

  await page.locator('.ls-card').filter({ hasText: lot }).first().click();
  await page.waitForSelector('.ls-keep .ls-kt', { timeout: 20000 });
  await page.waitForTimeout(1000);
  const before = await page.locator('.ls-keep .ls-kt tbody tr').count();
  console.log('keep rows before adding a sieve:', before);

  // add a sieve and type into it — it must appear in the keep table at once.
  // + Sieve only appears once a sieve has actually been picked
  const opts = (await page.locator('.ls-pick select option').allTextContents())
    .map((o) => o.trim()).filter(Boolean);
  await page.locator('.ls-pick select').selectOption(opts[0]);
  await page.waitForTimeout(300);
  await page.locator('.ls-addbtn').click();
  await page.waitForTimeout(400);
  await page.keyboard.type('7');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.keyboard.type('4');
  await page.waitForTimeout(900);
  const after = await page.locator('.ls-keep .ls-kt tbody tr').count();
  const rows = await page.locator('.ls-keep .ls-kt tbody tr').evaluateAll((rs) => rs.map((r) =>
    [...r.querySelectorAll('td')].map((c) => (c.querySelector('input') as HTMLInputElement)?.value
      ?? (c.textContent || '').trim()).join(' | ')));
  console.log('keep rows after :', after);
  rows.forEach((r) => console.log('   ', r));
  expect(after).toBe(before + 1);
  // the new sieve is there with its 4 ct assorted, ready to ask for
  expect(rows[rows.length - 1]).toContain('4.000');
});
