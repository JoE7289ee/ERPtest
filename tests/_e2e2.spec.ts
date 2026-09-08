import { test, expect } from '@playwright/test';
test('buy 25g of 999 gold as JW Stock Admin', async ({ page }) => {
  test.setTimeout(240_000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto('/app/purchase-raw-material');
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    const set = (sel: string, v: string) => {
      const i = document.querySelector(sel + ' input') as HTMLInputElement;
      i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('.pr-h-voucher', 'OGD'); set('.pr-h-supplier', 'SAMSA'); set('.pr-h-wh', 'Gold Issue - JD');
  });
  await page.waitForTimeout(1200);
  // first row: pick the item through its Link control, then type the grams
  const rowState = await page.evaluate(async () => {
    const tr = document.querySelector('.pr-grid tbody tr, table tbody tr') as HTMLElement;
    const linkInput = tr.querySelector('input[data-fieldname="item"]') as HTMLInputElement;
    linkInput.value = 'Standard Gold 999';
    linkInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    const nums = [...tr.querySelectorAll('input[type=number]')] as HTMLInputElement[];
    return { item: linkInput.value, numCount: nums.length, disabled: nums.map(n => n.disabled) };
  });
  console.log('ROW ' + JSON.stringify(rowState));
  await page.waitForTimeout(800);
  const filled = await page.evaluate(() => {
    const tr = document.querySelector('.pr-grid tbody tr, table tbody tr') as HTMLElement;
    const nums = [...tr.querySelectorAll('input[type=number]')] as HTMLInputElement[];
    // cols: purity, count, gram, carat
    const gram = nums[2];
    gram.value = '25'; gram.dispatchEvent(new Event('input', { bubbles: true }));
    return { purity: nums[0].value, gram: gram.value };
  });
  console.log('FILLED ' + JSON.stringify(filled));
  await page.waitForTimeout(1000);
  // submit
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.page-actions button, button')].find(x => /Post Purchase|Purchase|Save/i.test(x.textContent || ''));
    (b as HTMLElement)?.click();
  });
  await page.waitForTimeout(3000);
  const dlg = await page.evaluate(() => {
    const m = document.querySelector('.modal.show') as HTMLElement;
    return { open: !!m, text: m?.innerText?.replace(/\s+/g,' ').slice(0, 150) };
  });
  console.log('CONFIRM ' + JSON.stringify(dlg) + ' ERRS ' + JSON.stringify(errs));
});
