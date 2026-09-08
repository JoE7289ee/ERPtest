import { test, expect } from '@playwright/test';
test('post the purchase for real', async ({ page }) => {
  test.setTimeout(240_000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
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
  await page.evaluate(async () => {
    const tr = document.querySelector('table tbody tr') as HTMLElement;
    const li = tr.querySelector('input[data-fieldname="item"]') as HTMLInputElement;
    li.value = 'Standard Gold 999';
    li.dispatchEvent(new Event('input', { bubbles: true })); li.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    const nums = [...tr.querySelectorAll('input[type=number]')] as HTMLInputElement[];
    nums[2].value = '25'; nums[2].dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Post Purchase' }).click();
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => {
    const m = document.querySelector('.modal.show') as HTMLElement;
    const alert = (document.querySelector('.desk-alert, .alert-body') as HTMLElement)?.innerText?.replace(/\s+/g,' ').slice(0,140) || '';
    return { modal: m?.innerText?.replace(/\s+/g,' ').slice(0, 200) || '', alert };
  });
  console.log('AFTER-POST ' + JSON.stringify(after));
  console.log('ERRS ' + JSON.stringify(errs));
});
