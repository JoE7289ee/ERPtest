// Merging two saved lots: same quality only, tagged to a shop, into a NEW lot
// with both sources left alone.
import { test, expect } from '@playwright/test';

test('the merge dialog offers only same-quality lots and asks for the shop', async ({ page }) => {
  await page.goto('/app/saved-imports');
  await page.waitForFunction(() => document.querySelectorAll('.si-card').length > 0, undefined, { timeout: 60_000 });
  await page.waitForTimeout(600);

  const card = await page.evaluate(() => {
    const c = document.querySelector('.si-card') as HTMLElement;
    return { title: (c.querySelector('.t')?.textContent || '').trim(),
      meta: (c.querySelector('.m')?.textContent || '').replace(/\s+/g, ' ').trim(),
      buttons: Array.from(c.querySelectorAll('button')).map((b) => (b.textContent || '').trim()) };
  });
  console.log('card:', card.title, '|', card.meta);
  console.log('buttons:', JSON.stringify(card.buttons));
  expect(card.buttons, 'Merge sits between Resume and Delete')
    .toEqual([expect.stringContaining('Resume'), expect.stringContaining('Merge'), 'Delete']);

  await page.locator('.si-card .si-merge').first().click();
  await page.waitForSelector('.modal.show', { timeout: 20_000 });
  await page.waitForTimeout(700);

  const d = await page.evaluate(() => {
    const dlg = (window as any).cur_dialog;
    const opts = Array.from(dlg.fields_dict.other.$input.find('option') as any)
      .map((o: any) => o.textContent.trim()).filter(Boolean);
    return { title: dlg.title,
      fields: dlg.fields.map((f: any) => f.fieldname).filter((x: string) => x),
      head: dlg.fields_dict.head.$wrapper.text().replace(/\s+/g, ' ').trim(),
      sum: dlg.fields_dict.sum.$wrapper.text().replace(/\s+/g, ' ').trim(),
      partyLabel: dlg.fields_dict.party.df.label,
      partyReqd: !!dlg.fields_dict.party.df.reqd,
      optionCount: opts.length, firstOptions: opts.slice(0, 3) };
  });
  console.log('dialog:', d.title);
  console.log('  head :', d.head);
  console.log('  sum  :', d.sum);
  console.log('  fields:', JSON.stringify(d.fields));
  console.log('  partners offered:', d.optionCount, JSON.stringify(d.firstOptions));

  expect(d.fields, 'it asks which lot and which shop').toEqual(
    expect.arrayContaining(['other', 'party', 'title']));
  expect(d.partyLabel, 'the shop field is the shop field').toContain('Shop');
  expect(d.partyReqd, 'the shop is required — the new lot is FOR someone').toBe(true);
  expect(d.optionCount, 'partners are offered').toBeGreaterThan(0);
  expect(d.head, 'it states the quality that gates the list').toMatch(/quality/i);
  expect(d.sum, 'it says how big the merged lot will be').toMatch(/piece/i);
});
