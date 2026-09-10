import { test, expect } from '@playwright/test';

test('Price Charts: diamonds group by quality, Basis column, BACK CHAIN rule', async ({ page }) => {
  const ch = process.env.CH || '';
  test.skip(!ch, 'need a chart');
  await page.goto('/app/price-charts');
  await page.waitForSelector('.pc-g .a', { timeout: 30000 });
  await page.locator(`.pc-g [data-name="${ch}"]`).first().click();
  await page.waitForSelector('table[data-k=dmd] tbody tr', { timeout: 20000 });
  await page.waitForTimeout(800);

  const dmd = await page.locator('table[data-k=dmd] tbody tr').evaluateAll((rows) => rows.map((r) => {
    const i = [...r.querySelectorAll('input')].map((x) => (x as HTMLInputElement).value);
    const s = (r.querySelector('select') as HTMLSelectElement)?.value;
    return { q: s || '', line: `${s}  ${i[0]} - ${i[1]} ct  @ ${i[2]}` };
  }));
  console.log('diamond rows as shown (was shuffled in the DB):');
  dmd.forEach((x) => console.log('    ' + x.line));
  const quals = dmd.map((x) => x.q);
  const runs = quals.filter((q, i) => i === 0 || q !== quals[i - 1]);
  console.log('quality runs:', runs.join(' -> '));
  expect(quals[0]).toContain('EF');
  expect(new Set(runs).size, 'each quality is one unbroken run').toBe(runs.length);

  const heads = (await page.locator('table[data-k=mk] thead th').allTextContents()).filter(Boolean);
  console.log('making columns:', JSON.stringify(heads));
  expect(heads).toContain('Basis');

  await page.locator('.add[data-k=mk]').click();
  await page.waitForTimeout(700);
  const row = page.locator('table[data-k=mk] tbody tr').last();
  await row.locator('select[data-f=design_type]').selectOption('BACK CHAIN');
  await row.locator('select[data-f=basis]').selectOption('Per Gram');
  await row.locator('input[data-f=rate]').fill('500');
  await page.waitForTimeout(400);
  console.log('added rule -> type:', await row.locator('select[data-f=design_type]').inputValue(),
              '| basis:', await row.locator('select[data-f=basis]').inputValue(),
              '| rate:', await row.locator('input[data-f=rate]').inputValue());
  expect(await row.locator('select[data-f=design_type]').inputValue()).toBe('BACK CHAIN');

  // save it and read it back off the server — a Basis that does not persist is no use
  await page.locator('.pc-save, button:has-text("Save")').first().click();
  await page.waitForTimeout(3500);
  const back = await page.evaluate(async (n) => {
    const r = await (window as any).frappe.call({ method: 'jewelima.jewelima.api.get_price_chart', args: { name: n } });
    return (r.message.making_rules || []).map((x: any) => `${x.design_type || 'DEFAULT'} / ${x.basis} / ${x.rate}`);
  }, ch);
  console.log('making rules on the server now:', JSON.stringify(back));
  expect(back.join(' | ')).toContain('BACK CHAIN / Per Gram / 500');
});
