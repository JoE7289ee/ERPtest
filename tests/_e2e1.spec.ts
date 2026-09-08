import { test, expect } from '@playwright/test';
test('JW Stock Admin buys gold in', async ({ page }) => {
  test.setTimeout(180_000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto('/app/purchase-raw-material');
  await page.waitForTimeout(7000);
  const shape = await page.evaluate(() => ({
    denied: document.body.innerText.includes('not have enough permissions'),
    voucher: !!document.querySelector('.pr-h-voucher input'),
    rows: document.querySelectorAll('.pr-grid tbody tr, table tbody tr').length }));
  console.log('PAGE ' + JSON.stringify(shape));
  // fill the header
  await page.evaluate(() => {
    const set = (sel: string, v: string) => {
      const i = document.querySelector(sel + ' input') as HTMLInputElement;
      if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    set('.pr-h-voucher', 'OGD');
    set('.pr-h-supplier', 'SAMSA');
    set('.pr-h-wh', 'Gold Issue - JD');
  });
  await page.waitForTimeout(1500);
  const hdr = await page.evaluate(() => ({
    v: (document.querySelector('.pr-h-voucher input') as HTMLInputElement)?.value,
    s: (document.querySelector('.pr-h-supplier input') as HTMLInputElement)?.value,
    w: (document.querySelector('.pr-h-wh input') as HTMLInputElement)?.value }));
  console.log('HEADER ' + JSON.stringify(hdr) + ' ERRS ' + JSON.stringify(errs));
});
