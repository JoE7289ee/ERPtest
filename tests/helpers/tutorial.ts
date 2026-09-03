// Teaching-video helpers for the Jewelima desk.
//
// Playwright's real mouse pointer is invisible in recordings and actions fire
// instantly — so we inject a fake cursor + a caption bar into the page, glide the
// cursor to each control, ripple on click, and pace everything so a viewer can
// follow. Use `test` from here (not @playwright/test) to get the cursor auto-installed.
import { test as base, expect, Page, Locator } from '@playwright/test';

// Runs in the PAGE on every navigation — builds the cursor, caption bar, styles,
// and a window.__tut API the Node side drives. Must be fully self-contained.
function CURSOR_SCRIPT() {
  const build = () => {
    if ((window as any).__tut || !document.body) return;
    const style = document.createElement('style');
    style.textContent = `
      #__cur{position:fixed;z-index:2147483647;left:640px;top:400px;pointer-events:none;
        transition:left .55s cubic-bezier(.33,0,.2,1),top .55s cubic-bezier(.33,0,.2,1);
        filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));}
      #__cap{position:fixed;z-index:2147483646;left:50%;bottom:34px;transform:translateX(-50%) translateY(8px);pointer-events:none;
        max-width:78vw;background:rgba(17,22,29,.94);color:#fff;
        font:600 19px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        padding:14px 26px;border-radius:14px;opacity:0;transition:opacity .35s,transform .35s;
        box-shadow:0 8px 30px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);}
      #__cap.on{opacity:1;transform:translateX(-50%) translateY(0);}
      #__cap b{color:#7ec8ff;}
      .__rip{position:fixed;z-index:2147483645;width:18px;height:18px;border-radius:50%;
        background:rgba(46,125,50,.35);border:2px solid #2e7d32;pointer-events:none;
        transform:translate(-50%,-50%) scale(1);animation:__ripk .6s ease-out forwards;}
      @keyframes __ripk{to{transform:translate(-50%,-50%) scale(4.2);opacity:0;}}
      #__box{position:fixed;z-index:2147483644;border:3px solid #2e7d32;border-radius:10px;
        pointer-events:none;opacity:0;background:rgba(46,125,50,.06);
        transition:opacity .3s,left .45s cubic-bezier(.33,0,.2,1),top .45s cubic-bezier(.33,0,.2,1),width .45s cubic-bezier(.33,0,.2,1),height .45s cubic-bezier(.33,0,.2,1);}
      #__box.on{opacity:1;animation:__boxpulse 1.5s ease-in-out infinite;}
      #__box.circle{border-radius:50%;}
      @keyframes __boxpulse{0%{box-shadow:0 0 0 2px rgba(46,125,50,.30);}50%{box-shadow:0 0 0 7px rgba(46,125,50,.10);}100%{box-shadow:0 0 0 2px rgba(46,125,50,.30);}}
    `;
    document.head.appendChild(style);
    const cur = document.createElement('div');
    cur.id = '__cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2 L4 19 L8.5 14.7 L11.4 21.4 L14.3 20.2 L11.4 13.6 L18 13.6 Z" fill="#111" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const cap = document.createElement('div');
    cap.id = '__cap';
    document.body.appendChild(cap);
    (window as any).__tut = {
      move: (x: number, y: number) => new Promise<void>((r) => {
        cur.style.left = x + 'px'; cur.style.top = y + 'px'; setTimeout(r, 580);
      }),
      caption: (html: string) => { cap.innerHTML = html; cap.classList.add('on'); },
      clearCaption: () => cap.classList.remove('on'),
      ripple: (x: number, y: number) => {
        const d = document.createElement('div'); d.className = '__rip';
        d.style.left = x + 'px'; d.style.top = y + 'px';
        document.body.appendChild(d); setTimeout(() => d.remove(), 620);
      },
      pos: () => ({ x: parseFloat(cur.style.left) || 640, y: parseFloat(cur.style.top) || 400 }),
      box: (x: number, y: number, w: number, h: number, circle?: boolean) => {
        let b = document.getElementById('__box');
        if (!b) { b = document.createElement('div'); b.id = '__box'; document.body.appendChild(b); }
        b.classList.toggle('circle', !!circle);
        b.style.left = (x - 6) + 'px'; b.style.top = (y - 6) + 'px';
        b.style.width = (w + 12) + 'px'; b.style.height = (h + 12) + 'px';
        (b as any).offsetWidth; b.classList.add('on');
      },
      boxOff: () => { const b = document.getElementById('__box'); if (b) b.classList.remove('on'); },
    };
  };
  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(CURSOR_SCRIPT);
    await use(page);
  },
});
export { expect };

// FAST=1 is for seeding, not recording: no typing delay, cushion waits capped
const FAST = !!process.env.FAST;
const KEY_DELAY = FAST ? 0 : 85;
const wait = (p: Page, ms: number) => p.waitForTimeout(FAST ? Math.min(ms, 150) : ms);

/** Start every tutorial on the Jewelima home page (so the navigation is shown). */
export async function gotoHome(page: Page) {
  await page.goto('/desk/jewelima');
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
  await page.locator('.item-anchor').first().waitFor({ state: 'visible', timeout: 20_000 });
  await wait(page, 800);
}

/** A sidebar section header by its exact label (click to expand/collapse). */
export function sidebarSection(page: Page, label: string): Locator {
  return page.locator('.item-anchor', { has: page.locator('.sidebar-item-label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }) }).first();
}

/** A sidebar page link by the desk route it points to. */
export function sidebarLink(page: Page, route: string): Locator {
  return page.locator(`a.item-anchor[href="/desk/${route}"], a.item-anchor[href="/app/${route}"]`).first();
}

/** Navigate via the sidebar with the cursor: expand each section (only if the
 * target link isn't already showing, so re-visits don't collapse it), then click
 * the link. `sections` is [[label, caption], …]. */
export async function navSidebar(page: Page, sections: [string, string][], route: string, linkCaption: string) {
  const link = sidebarLink(page, route);
  for (const [label, cap] of sections) {
    if (await link.isVisible().catch(() => false)) break;
    await click(page, sidebarSection(page, label), cap);
    await wait(page, 300);
  }
  await click(page, link, linkCaption);
}

/** Open a desk route and wait for the page to be ready (cursor re-injects on nav). */
export async function gotoApp(page: Page, route: string) {
  await page.goto(`/desk/${route}`);
  await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
  const wrapper = page.locator(`#page-${route}`);
  try {
    await wrapper.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    await page.reload();
    await page.waitForFunction(() => (window as any).frappe && (window as any).frappe.boot, undefined, { timeout: 30_000 });
    await wrapper.waitFor({ state: 'visible', timeout: 20_000 });
  }
  await wait(page, 500);
}

/** Call a whitelisted server method through the app's own session. */
export async function frappeCall<T = any>(page: Page, method: string, args: Record<string, any> = {}): Promise<T> {
  return await page.evaluate(
    async ({ method, args }) => (await (window as any).frappe.call({ method, args })).message,
    { method, args }
  );
}

/** Show a caption at the bottom and hold long enough to read it. */
export async function say(page: Page, html: string, holdMs = 1500) {
  await page.evaluate((h) => (window as any).__tut?.caption(h), html);
  await wait(page, holdMs);
}

/** Glide the fake cursor (and the real mouse, for hover states) to a control's centre. */
export async function moveTo(page: Page, loc: Locator) {
  await loc.first().waitFor({ state: 'visible', timeout: 12_000 }); // fail fast, don't hang the whole test
  await loc.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
  const box = await loc.boundingBox();
  if (!box) throw new Error('moveTo: element has no bounding box');
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y, { steps: 24 });
  await page.evaluate(({ x, y }) => (window as any).__tut?.move(x, y), { x, y });
  await wait(page, 200);
  return { x, y };
}

/** Move to a control, ripple, then click it. */
export async function click(page: Page, loc: Locator, caption?: string) {
  if (caption) await say(page, caption);
  const { x, y } = await moveTo(page, loc);
  await page.evaluate(({ x, y }) => (window as any).__tut?.ripple(x, y), { x, y });
  await wait(page, 220);
  await loc.click({ timeout: 15_000 }); // fail fast instead of hanging the whole test
  await wait(page, 550);
}

/** Move to a field and type into it at a readable pace. */
export async function typeInto(page: Page, loc: Locator, text: string, caption?: string) {
  if (caption) await say(page, caption);
  await moveTo(page, loc);
  await loc.click();
  await loc.fill('');
  await loc.pressSequentially(text, { delay: KEY_DELAY });
  await wait(page, 450);
}

/** Type into a Frappe Link field and pick the matching option from THAT field's
 * own awesomplete dropdown (scoped, so stale/hidden dropdowns can't trip it). */
export async function pickLink(page: Page, inputLocator: Locator, value: string, caption?: string) {
  if (caption) await say(page, caption);
  await moveTo(page, inputLocator);
  await inputLocator.click();
  await inputLocator.fill('');
  await inputLocator.pressSequentially(value, { delay: KEY_DELAY });
  const opt = page.getByRole('option', { name: new RegExp(value, 'i') }).first();
  await opt.waitFor({ state: 'visible', timeout: 9000 });
  await wait(page, 350);
  await opt.click();
  await wait(page, 500);
}

export const pause = (page: Page, ms = 800) => wait(page, ms);

/** Draw an animated highlight box around a control (optionally circular), glide the
 * cursor to it, and hold with a caption. Great for "look here" overview moments. */
export async function spotlight(page: Page, loc: Locator, caption?: string, holdMs = 2600, circle = false) {
  await loc.first().waitFor({ state: 'visible', timeout: 12_000 });
  await loc.first().scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
  const box = await loc.first().boundingBox();
  if (!box) return;
  if (caption) await page.evaluate((h) => (window as any).__tut?.caption(h), caption);
  await page.evaluate(({ x, y, w, h, c }) => (window as any).__tut?.box(x, y, w, h, c),
    { x: box.x, y: box.y, w: box.width, h: box.height, c: circle });
  await page.mouse.move(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), { steps: 18 });
  await page.evaluate(({ x, y }) => (window as any).__tut?.move(x, y),
    { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) });
  await wait(page, holdMs);
}
export async function spotOff(page: Page) { await page.evaluate(() => (window as any).__tut?.boxOff()); }
