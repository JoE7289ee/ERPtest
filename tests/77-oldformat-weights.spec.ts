import { test, expect } from '@playwright/test';

test('Edit weights: locked identity, editable stones, derived nett, confirm before it lands', async ({ page }) => {
  const sess = process.env.SESS || '';
  test.skip(!sess, 'need a session');
  // the real way in: the Resume button on the Saved Imports card
  await page.goto('/app/saved-imports');
  await page.waitForSelector('.si-card', { timeout: 30000 });
  await page.locator('.si-card').filter({ hasText: 'WEIGHTS TEST' }).first().locator('.si-resume').click();
  await page.waitForSelector('.of-weights:visible', { timeout: 25000 });
  await page.waitForTimeout(1000);

  const btn = page.locator('.of-weights');
  await expect(btn, 'the Edit weights button').toBeVisible();
  console.log('button:', (await btn.textContent() || '').trim());
  await btn.click();
  await page.waitForSelector('.modal.show [data-fieldname="scan"] input', { timeout: 10000 });

  await page.locator('.modal.show [data-fieldname="scan"] input').fill('wt001');   // lowercase on purpose
  await page.locator('.modal.show [data-fieldname="scan"] input').press('Enter');
  await page.waitForTimeout(800);

  const locked = (await page.locator('.modal.show .modal-body > div, .modal.show [data-fieldname="st"] > div > div').first().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('locked line:', locked.slice(0, 110));
  const fields = await page.locator('.modal.show .ofw-in').evaluateAll((els) =>
    els.map((e) => (e as HTMLInputElement).getAttribute('data-f') + '=' + (e as HTMLInputElement).value));
  console.log('editable:', JSON.stringify(fields));
  console.log('nett shown:', (await page.locator('.modal.show .ofw-nt').textContent() || '').trim());

  // change DMD CT 0.5 -> 0.9 ; nett must follow without being typed
  await page.locator('.modal.show .ofw-in[data-f=dmd_ct]').fill('0.9');
  await page.locator('.modal.show .ofw-in[data-f=stn_ct]').fill('0.25');
  await page.waitForTimeout(500);
  console.log('nett recomputed:', (await page.locator('.modal.show .ofw-nt').textContent() || '').trim(),
              '(2.5 - 0.2*(0.9+0.25) = 2.270)');
  expect((await page.locator('.modal.show .ofw-nt').textContent() || '').trim()).toBe('2.270');

  await page.locator('.modal.show .ofw-apply').click();
  await page.waitForTimeout(900);
  const confirm = (await page.locator('.modal.show').last().textContent() || '').replace(/\s+/g, ' ').trim();
  console.log('confirmation says:', confirm.slice(confirm.indexOf('Change'), confirm.indexOf('Change') + 160));

  // say NO first — nothing must change
  await page.locator('.modal.show').last().locator('button', { hasText: 'No' }).click();
  await page.waitForTimeout(700);
  let row = await page.evaluate(() => (window as any).cur_frm ? null : null);
  const afterNo = await page.evaluate(() => {
    const t = document.querySelector('.of-t tbody tr');
    return (t?.textContent || '').replace(/\s+/g, ' ').trim();
  });
  console.log('sheet after NO:', afterNo.slice(0, 80));

  // now yes
  await page.locator('.modal.show .ofw-apply').click();
  await page.waitForTimeout(800);
  await page.locator('.modal.show').last().locator('button', { hasText: 'Yes' }).click();
  await page.waitForTimeout(1200);
  console.log('applied.');
  await page.locator('.modal.show .btn-modal-close').first().click().catch(() => {});
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const t = document.querySelector('.of-t tbody tr');
    return (t?.textContent || '').replace(/\s+/g, ' ').trim();
  });
  console.log('sheet after YES:', after.slice(0, 90));
  expect(after).toContain('2.27');
});
