import { test, expect } from '@playwright/test';

test('Party Stone Add is back, at its own route, beside Party Metal', async ({ page }) => {
  await page.goto('/app/party-stone');
  await page.waitForSelector('.pst-wrap', { timeout: 30000 });
  const title = () => page.evaluate(() => (document.querySelector('.page-head .title-area, .page-title') as HTMLElement)?.innerText?.trim().split('\n')[0] || document.title);
  console.log('title:', await title());

  const parties = await page.locator('.pst-party').count();
  console.log('party groups listed:', parties);
  expect(parties).toBeGreaterThan(0);

  // the report is untouched at its own route
  await page.goto('/app/party-stock');
  await page.waitForTimeout(2500);
  await page.waitForSelector('.pst-wrap, [id^=page-party-stock]', { timeout: 20000 }).catch(() => {});
  console.log('party-stock is still:', await title(), '| has the stone form?',
    await page.locator('.pst-wrap:visible').count());

  await page.goto('/app/party-stone');
  await page.waitForSelector('.pst-party', { timeout: 30000 });
  await page.locator('.pst-party').first().click();
  await page.waitForTimeout(1200);
  const head = (await page.locator('.pst-mainhead').textContent() || '').trim();
  console.log('picked party:', head);
  await expect(page.locator('.pst-form')).toBeVisible();

  const code = head.split('—')[0].trim();
  const stone = 'TESTSTONE' + Date.now().toString().slice(-5);
  await page.locator('.pst-stone-in').fill(stone);
  await page.waitForTimeout(900);
  console.log('preview:', (await page.locator('.pst-preview').textContent() || '').trim(),
              '| Add enabled:', !(await page.locator('.pst-add').isDisabled()));
  expect((await page.locator('.pst-preview').textContent() || '').trim()).toBe(code + '-' + stone);

  await page.locator('.pst-add').click();
  await page.waitForTimeout(2500);
  const rows = await page.locator('.pst-stone').allTextContents();
  console.log('stones now on the party:', rows.map((r) => r.replace(/\s+/g, ' ').trim()));
  expect(rows.join(' ')).toContain(code + '-' + stone);

  // a duplicate is refused before the button is even live
  await page.locator('.pst-stone-in').fill(stone);
  await page.waitForTimeout(900);
  console.log('same name again:', (await page.locator('.pst-preview').textContent() || '').trim(),
              '| Add disabled:', await page.locator('.pst-add').isDisabled());
  expect(await page.locator('.pst-add').isDisabled()).toBe(true);
  console.log('CREATED:' + code + '-' + stone);
});
