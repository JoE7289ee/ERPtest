// Design Bank: Add Design page (check / auto-number / create), Retire Design guard.
import { expect, test } from '@playwright/test';
import { expectToast, frappeCall, gotoApp, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const CODE = `ZZDB ${uid()}`;

test('Add Design: check availability, create with weights + tag', async ({ page }) => {
  await gotoApp(page, 'add-design');
  const dno = page.locator('input[data-fieldname="design_no"]');
  await dno.fill(CODE);
  await page.locator('.ad-check').click();
  await expect(page.locator('.ad-status')).toContainText('available');
  await page.locator('input[data-fieldname="gross_weight"]').fill('7.25');
  await page.locator('input[data-fieldname="diamond_weight"]').fill('0.4');
  await page.locator('.ad-tag-input').fill('ZZTESTTAG');
  await page.locator('.ad-tag-input').press('Enter');
  await expect(page.locator('.ad-chips .ad-chip', { hasText: 'ZZTESTTAG' })).toBeVisible();
  await page.locator('.ad-create').click();
  await expectToast(page, 'Created');
  // duplicate now rejected by Check
  await dno.fill(CODE);
  await page.locator('.ad-check').click();
  await expect(page.locator('.ad-status')).toContainText('already exists');
});

test('Auto-number completes a prefix with a never-used number', async ({ page }) => {
  await gotoApp(page, 'add-design');
  await page.locator('input[data-fieldname="design_no"]').fill('ZZDB');
  await page.locator('.ad-auto').click();
  await expect(page.locator('.ad-status')).toContainText('never used');
  const v = await page.locator('input[data-fieldname="design_no"]').inputValue();
  expect(v).toMatch(/^ZZDB \d+$/);
});

test('Retire Design deletes an unused catalog entry', async ({ page }) => {
  await gotoApp(page, 'retire-design');
  const name = (await frappeCall(page, 'frappe.client.get_list', {
    doctype: 'Design Bank', filters: { design_no: CODE }, fields: ['name'], limit_page_length: 1,
  }))[0].name;
  const pick = page.locator('input[data-fieldname="design"]');
  await pick.fill(name);
  await page.locator('.awesomplete:visible li').first().click();
  await expect(page.locator('.rd-banner')).toContainText('safe to remove', { timeout: 15_000 });
  await page.locator('.rd-del').click();
  await page.locator('.modal:visible .btn-primary', { hasText: /yes|confirm/i }).click();
  await expectToast(page, 'Removed');
  // cleanup the throwaway tag
  await frappeCall(page, 'jewelima.jewelima.design_bank_api.delete_tag', { tag_name: 'ZZTESTTAG' }).catch(() => {});
});
