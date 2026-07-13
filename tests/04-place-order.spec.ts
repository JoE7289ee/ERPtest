// Place Order: designed lines (type/size follow the design), split, purity variants, ordering.
import { expect, test } from '@playwright/test';
import { apiCreateDesign, apiDeleteDesign, expectToast, frappeCall, gotoApp, setLink, uid } from './helpers/jewelima';

test.describe.configure({ mode: 'serial' });
const D = `ZZPO ${uid()}`;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiCreateDesign(page, D, { type: 'RING', gold: '22KYG', goldWt: 5 });
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await gotoApp(page, 'place-order');
  await apiDeleteDesign(page, D);
  await apiDeleteDesign(page, `${D} 18P`);
  await page.close();
});

test('picking a design fills Type, sizes follow the type, default pre-selected', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  const row = page.locator('table.po-grid tbody tr').first();
  await expect(row).toContainText('RING', { timeout: 15_000 });        // Type column
  const size = row.locator('select').first();
  await expect(size).toHaveValue('0P');                                 // RING default
  const options = await size.locator('option').allInnerTexts();
  expect(options).toContain('30P');
  expect(options).toContain('MIX(10-16)');
  // weights derived from the BOM
  await expect(row).toContainText('5.000');
});

test('Split divides qty across twin lines', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  const row = page.locator('table.po-grid tbody tr').first();
  await row.locator('input[type="number"]').fill('5');
  await row.locator('button', { hasText: 'Split' }).click();
  await page.locator('.modal:visible input[data-fieldname="bags"]').fill('2');
  await page.locator('.modal:visible .btn-primary', { hasText: 'Split' }).click();
  const rows = page.locator('table.po-grid tbody tr', { hasText: D });
  await expect(rows).toHaveCount(2);
  // both bags must paint GREEN (complete lines), not red — the twin's design lands async
  await expect(rows.nth(0).locator('.po-num')).toHaveClass(/ok/);
  await expect(rows.nth(1).locator('.po-num')).toHaveClass(/ok/, { timeout: 10_000 });
});

test('New (purity variant) picker: red creates, family shows black', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  const row = page.locator('table.po-grid tbody tr').first();
  const newBtn = row.locator('button.po-new');
  await expect(newBtn).toHaveClass(/ready/); // red once a design is chosen
  await newBtn.click();
  const dlg = page.locator('.modal:visible');
  await expect(dlg).toContainText('22KYG'); // current gold shown
  await dlg.locator('button.pv-btn', { hasText: '18KPG' }).click();
  // prefilled New Design dialog
  const nd = page.locator('.modal:visible');
  await expect(nd.locator('input[data-fieldname="design_name"]')).toHaveValue(`${D} 18P`);
  await nd.locator('.btn-primary', { hasText: 'Create Design' }).click();
  await expectToast(page, 'created');
  // the line now carries the variant and its materials
  await expect(row.locator('input[data-fieldname="design"]')).toHaveValue(`${D} 18P`, { timeout: 20_000 });
  await expect(row).toContainText('75.1'); // 18K purity pulled without re-picking
  // reopen the picker from the variant: 22KYG must be BLACK (the original)
  await newBtn.click();
  const btn22 = page.locator('.modal:visible button.pv-btn', { hasText: '22KYG' });
  await expect(btn22).toContainText('●');
  await page.keyboard.press('Escape');
});

test('Materials button turns yellow after a BOM edit, Reset clears it', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  const row = page.locator('table.po-grid tbody tr').first();
  const matBtn = row.locator('button', { hasText: 'Materials' });
  await expect(row).toContainText('RING', { timeout: 15_000 });
  await expect(matBtn).not.toHaveClass(/po-mat-edited/);
  // edit the line's BOM: bump the gold weight and Apply
  await matBtn.click();
  const dlg = page.locator('.modal:visible');
  await dlg.locator('.grid-row .btn-open-row, .grid-row .edit-grid-row').first().click(); // pencil -> row detail
  await dlg.locator('input[data-fieldname="weight"]:visible').first().fill('6');
  await dlg.locator('.grid-collapse-row:visible, .grid-row-open .grid-collapse-row').first().click(); // chevron closes the row editor
  await dlg.locator('.btn-primary', { hasText: 'Apply' }).click();
  await expect(matBtn).toHaveClass(/po-mat-edited/); // yellow
  // line Reset re-pulls the design BOM -> back to normal
  await row.locator('button', { hasText: 'Reset' }).click();
  await expect(matBtn).not.toHaveClass(/po-mat-edited/, { timeout: 10_000 });
});

test('Party and Days > 0 are mandatory to place an order', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  await page.locator('table.po-grid tbody tr').first().locator('input[type="number"]').fill('1');
  // no Party, no Days -> Party guard fires first
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Pick the Party');
  await page.keyboard.press('Escape');
  // Party set, Days still 0 -> Days guard
  await setLink(page, 'input[data-fieldname="customer"]', 'JD Stock');
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Days must be more than 0');
  await page.keyboard.press('Escape');
});

test('place a real order end-to-end', async ({ page }) => {
  await gotoApp(page, 'place-order');
  await setLink(page, 'table.po-grid tbody tr >> nth=0 >> input[data-fieldname="design"]', D);
  await page.locator('table.po-grid tbody tr').first().locator('input[type="number"]').fill('1');
  await setLink(page, 'input[data-fieldname="customer"]', 'JD Stock');
  await page.locator('input[data-fieldname="days"]').fill('10');
  await page.locator('.page-actions .btn-primary', { hasText: 'Place Order' }).click();
  await expect(page.locator('.modal:visible')).toContainText('Order placed', { timeout: 30_000 });
  const modalText = await page.locator('.modal:visible .modal-body').innerText();
  const orderNo = (modalText.match(/E\d+/) || [''])[0]; // "E0005 created with N Order Bag(s)".
  expect(orderNo).toMatch(/^E\d+/);
  await page.keyboard.press('Escape');
  // due date landed on the Job Order (today + 10)
  const jo = await frappeCall(page, 'frappe.client.get', { doctype: 'Job Order', name: orderNo });
  expect(jo.due_date).toBeTruthy();
  expect(jo.customer_date).toBe(jo.due_date); // empty customer-days copies the due date
});
