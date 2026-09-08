import { test } from '@playwright/test';
test('melt + transfer pages open and work for the role', async ({ page }) => {
  test.setTimeout(240_000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  for (const p of ['melt-gold', 'stock-transfer', 'purchase-history', 'loss-collection', 'loss-writeoff', 'loss-report', 'loss-history', 'melt-history']) {
    await page.goto('/app/' + p);
    await page.waitForTimeout(4000);
    const st = await page.evaluate(() => ({
      denied: document.body.innerText.includes('not have enough permissions'),
      notfound: document.body.innerText.includes('Not found'),
      painted: !!document.querySelector('.layout-main-section > *') }));
    console.log(`PAGE ${p} -> ${st.denied ? 'DENIED' : st.notfound ? 'NOT-FOUND' : st.painted ? 'ok' : 'blank'}`);
  }
  console.log('ERRS ' + JSON.stringify(errs.slice(0, 4)));
});
