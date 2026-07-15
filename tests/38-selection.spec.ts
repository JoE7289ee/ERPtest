// Selection: pick photos from the catalog, save the record with counts.
import { expect, test } from '@playwright/test';
import { frappeCall, gotoApp, setLink } from './helpers/jewelima';

let created = '';

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'select-photos');
  if (created) await frappeCall(page, 'frappe.client.delete', { doctype: 'Selection', name: created }).catch(() => {});
  await page.close();
});

test('gallery loads, picking photos saves a Selection with the count', async ({ page }) => {
  await gotoApp(page, 'select-photos');
  await expect(page.locator('.sl2-card').first()).toBeVisible({ timeout: 20_000 });
  const total = await page.locator('.sl2-card').count();
  expect(total).toBeGreaterThan(50);           // the imported batch
  await expect(page.locator('.sl2-of')).toHaveText(String(total));

  // a card opens the photo FULL SCREEN; picking happens in the viewer
  await page.locator('.sl2-card').first().click();
  await expect(page.locator('.sl2-view')).toHaveClass(/on/);
  await expect(page.locator('.sl2-vcode')).not.toHaveText('');
  await page.locator('.sl2-pick').click();                       // pick #1
  await expect(page.locator('.sl2-pick')).toHaveClass(/picked/);
  await page.locator('.sl2-nav.next').click();                   // browse ->
  await page.locator('.sl2-pick').click();                       // pick #2
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press(' ');                                // pick #3 via Space
  await page.keyboard.press('Escape');
  await expect(page.locator('.sl2-view')).not.toHaveClass(/on/);
  await expect(page.locator('.sl2-n')).toHaveText('3');
  await expect(page.locator('.sl2-card.on')).toHaveCount(3);

  await setLink(page, '.sl2-party input', 'JD Stock');
  await page.locator('.sl2-save').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Selection saved', { timeout: 20_000 });
  const body = await page.locator('.modal:visible .modal-body').innerText();
  created = (body.match(/SEL-\d+/) || [''])[0];
  expect(created).toMatch(/^SEL-\d+/);
  await page.keyboard.press('Escape');

  // the record holds what was selected + how many
  const doc = await frappeCall(page, 'frappe.client.get', { doctype: 'Selection', name: created });
  expect(doc.total_photos).toBe(3);
  expect(doc.items.length).toBe(3);
  expect(doc.items[0].code).toBeTruthy();
  expect(doc.items[0].image).toContain('/files/selection/14-07-26/');
  await page.screenshot({ path: 'test-results/selection.png' });
});

test('selected pieces board shows what was picked', async ({ page }) => {
  // make a selection to look at
  await gotoApp(page, 'select-photos');
  await expect(page.locator('.sl2-card').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.sl2-card').first().click();
  await page.locator('.sl2-pick').click();
  await page.locator('.sl2-nav.next').click();
  await page.locator('.sl2-pick').click();
  await page.keyboard.press('Escape');
  await setLink(page, '.sl2-party input', 'JD Stock');
  await page.locator('.sl2-save').click();
  await page.locator('.modal:visible .btn-primary', { hasText: 'Yes' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Selection saved', { timeout: 20_000 });
  const nm = ((await page.locator('.modal:visible .modal-body').innerText()).match(/SEL-\d+/) || [''])[0];
  await page.keyboard.press('Escape');

  await gotoApp(page, 'selected-pieces');
  await expect(page.locator('.sp-rec').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.sp-tiles')).toContainText('Photos picked');
  await expect(page.locator('.sp-card').first()).toBeVisible();
  // focusing one record narrows the gallery to its photos
  await page.locator(`.sp-rec[data-n="${nm}"]`).click();
  await expect(page.locator('.sp-card')).toHaveCount(2, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/selected-pieces.png' });
  await frappeCall(page, 'frappe.client.delete', { doctype: 'Selection', name: nm }).catch(() => {});
});
