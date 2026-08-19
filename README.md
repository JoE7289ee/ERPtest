# ERPtest — end-to-end testing for Jewelima

Playwright suite that drives the real Jewelima desk UI. Use it to prove a change
works end to end before it reaches the floor.

**There are no fixtures or mocks.** Every run writes to a live site: orders are
placed, cards move, variants are created, stock moves. A spec that passes has
actually done the thing. Clean up what a run creates unless it is meant to stay.

The specs double as tutorial recordings (the helpers draw a cursor and captions),
but that is a side effect — the value is that they exercise the real flows.

---

## 1. Running

The app runs in Docker. You need the site URL and a **session id** per user —
minted server-side, so no passwords are handled anywhere.

```bash
CT=devcontainer-frappe-1
BENCH=/workspace/development/frappe-bench
SITE=development.localhost

sid () {   # sid <user-email>
  docker exec -u frappe $CT bash -lc "cd $BENCH && bench --site $SITE browse --user $1 2>&1" \
    | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2
}

cd ~/ERPtest
BASE_URL=http://development.localhost:8000 ERP_SID=$(sid anakha@jd.in) \
  npx playwright test 20-order-desk --project=chromium --timeout=300000 --reporter=list
```

Multi-actor specs take a second id, e.g. `SHEEJA_SID=$(sid sheeja@jd.in)`.
Switch user mid-test by replacing the cookie:

```ts
await context.addCookies([{ name: 'sid', value: process.env.SHEEJA_SID!, url: process.env.BASE_URL! }]);
```

Useful server-side checks while testing:

```bash
docker exec -u frappe $CT bash -lc "cd $BENCH && bench --site $SITE mariadb -e \
  'SELECT name,location,qty,narration FROM \`tabOrder Bag\` ORDER BY creation DESC LIMIT 5;'"

docker exec -u frappe $CT bash -lc "cd $BENCH && bench --site $SITE execute \
  jewelima.jewelima.api.get_bench_overview"
```

Seed a site with real cards (no captions, fast):

```bash
SEED=1 BAGS=25 npx playwright test 20-order-desk --project=chromium
KEEP_IN_ORDERING=1 ...      # leave them in ORDERING instead of pushing to CAD
```

---

## 2. Who can do what

Roles are created in code (`jewelima/setup.py`), so they re-apply on every
migrate. Pick the actor whose rights match the flow — testing as Administrator
hides permission bugs, which is how two real gaps reached the floor.

| Role | Opens | Notes |
|---|---|---|
| **Jewelima Ordering** | Place Order, Edit Order, Print Order Bags, Ordering Desk, Shop, Basket, Parties (read), order info pages | The order desk. Cannot transfer from the generic Transfer page. |
| **Jewelima Transfer** | Transfer Order Bag | The runner. Transfer Rules can narrow which from→to moves are allowed. |
| **JW Data Admin** | Assign/Collect, Job Work, Casting Queue, Make Tree, Print Order Bags | The bench + casting data desk. |
| **Jewelima Bench \<BENCH\>** | that one `ws-*` page, and the Workstations launcher | One role per workstation; it opens **only** its own. |
| **Stock Manager** | every workstation, benches, stock pages | Supervisor view. |
| **JW Manager** | nearly everything, plus Costing and the sale price | |
| **Jewelima Info** | Card Info, Design Info, Job Order Status, Due View, gallery | Read-only lookups. |
| **JW Party Admin** | Parties, Create Party, Party Masters, Party Stone/Metal | Creating and classifying parties. |
| **Jewelima Design Bank / Design Approver** | gallery, review, photo queues | Approver additionally approves. |
| **JW Selection** | the Selection module | |

Money is gated: **Costing** (what a piece could sell for) and the **Sold** block
(what it did sell for) are System Manager / JW Manager only, enforced server-side
— everyone else is only told a piece is sold.

---

## 3. Pages and their selectors

Stable hooks, grouped by page. Prefer these over text, which changes with wording.

**Place Order / Edit Order / Order Requests** (`public/js/order_page.js`)

| What | Selector |
|---|---|
| page root | `#page-place-order` |
| party / type / due days | `.po-h-customer input`, `.po-h-ordertype input`, `.po-h-days input` |
| the grid, one row per bag | `.po-grid tbody tr` |
| D Bank / Variant on a row | `input[data-fieldname="bank"]`, `input[data-fieldname="design"]` |
| qty | `input[type="number"]` (first in the row) |
| row buttons | `button:has-text("Materials"|"Split"|"Remark"|"Photos"|"+Var")` |
| place it | `button` named `Place Order` (exact) |
| the response carrying the order no | `create_job_order` → `{"message":"E0006"}` |

**Ordering Desk** (`ws-ordering`): `.od-cb` row ticks, `.od-all` select-all,
`.od-tr` transfer, `.od-pr` print.

**Transfer Order Bag**: `.tob-scan input` (scan + Enter), `.tob-to select`,
`Transfer All` button, `.tob-locval` shows the batch's source. One source
location per batch; sends in chunks of 30.

**Assign / Collect**: `.ac-tab[data-mode="assign"|"collect"]`, `.ac-scan input`,
`.ac-emp input`, `.ac-work select` (assign), `.ac-state select` (collect),
`Cards` picker with `.tc-all` / `.tc-none`.

**Job Work** (weight benches): `.jw-tab[data-mode=...]`, scan field, employee,
`.jw-total`. Receipt takes a weight-in per card.

**Shop / Basket**: `.sp-q` search, `.sp-type`, `.sp-tag` chips, `.sp-gwmin/max`,
`.sp-dwmin/max`, `.sp-card` tiles, `.sp-vrow` + `.sp-addbtn`, `.sp-newv` new
variant, `.sp-bk` basket. Basket: `.bk-line`, `.bk-q`, `.bk-rm` remark,
`.bk-mats`, `.bk-go`.

**Workstations / Bench Info**: `.wt-tile[data-b="WAXING"]`, `.bi-tile`.

**Make Tree**: tree list, `+ Add a piece`, wax weight prompt.

---

## 4. The flows worth testing

**Order → floor** (`19-end-to-end` does all of this)

1. Place Order: party, type, due days, a variant, qty → `Place Order`
2. Print Order Bags (order desk can print its own)
3. Transfer ORDERING → CAD (data desk)
4. Assign/Collect at CAD, work type + collection state
5. Transfer CAD → CAM → WAXING
6. Assign/Collect at WAXING (`Wax Injecting`)

**Ordering shortcuts**

- Type a **variant code** (`A13405NP-18EF-Y`) into D Bank — it resolves to its
  card and fills both columns.
- One line with qty N, then **Split** → N bags of 1.
- **Shop → Basket → Place Order** carries qty, remark and edited materials.

**Weight benches** — issue, then receipt with a weight-in:
lighter books **loss** (In Bags → `<bench> -LOSS`), heavier books **gain**
(`Production` → In Bags). A gain over **0.100 g** is refused at both the API and
the screen.

**Always verify in the database, not just on screen.** The order exists, the
narration is the remark you typed, `tabOrder Bag BOM Item` holds the materials
you edited, `tabBench Issue` has the work type and collection state.

---

## 5. Naming and data rules

- **Card** = `<order>.<line>.<qty>` — a 5-piece bag is `E0002.1.5`, not `.1.1`.
- **Variant** = `<card><karat><quality>-<colour>`, e.g. `A13405NP-18EF-Y`;
  22K is restricted to YG, so it names `…-22EF` with no colour letter.
- **New design** numbers come from the type's bank code: RING → `JR-n`,
  NOSEPIN → `JNP-n`.
- **Design Bank names are hashes** — the readable code lives in `design_no`.
- A design's **gross is always stored as 18K**; the dialog converts.
- **Diamond weight is never typed** — it is the sieve average.

## 6. Gotchas that each cost a debugging session

- **`--reporter=line` overwrites `console.log`** — later lines vanish. Use `list`.
- **`test-results/` is wiped at the start of every run.** Convert any video in
  the same command as the run.
- **Link fields store the record *name*, not the code you see.** Typing the
  visible text silently fails — pick from the dropdown or set the real name.
- **`page.evaluate(() => cur_dialog.set_value(...))` hangs**: the arrow returns
  Frappe's late promise and `evaluate` waits for it. Use `() => { …; }`.
- **`locator.getAttribute()` on a missing element waits the full timeout** and
  looks exactly like a page hang. Pass `{ timeout: 4000 }`.
- **Modals are `position: fixed`, so `offsetParent` is null** — find visible ones
  with `.modal.show`.
- **Stacked dialogs**: `.modal.show .btn-primary` can hit the one behind. Pick the
  modal containing a field you know, then its button.
- **Autocompletes render `.awesomplete li`; Link fields render `role=option`.**
- **Read-only fields render as text, not `<input>`** — read with
  `cur_dialog.get_value(...)`.
- **The order grid keeps a blank spare row** — count rows carrying a design.
- **Resetting a naming series while an `Order No Reservation` exists** makes the
  next order fail with *Duplicate Name*. Clear reservations too.
- **Desk pages stay alive between visits.** Anything expecting fresh data needs
  `on_page_show`; a stale board is not necessarily a bug in the data.

## 7. Writing a spec

```ts
import { test, expect, gotoApp, say, click, typeInto, pickLink,
         spotlight, spotOff } from './helpers/tutorial';

await gotoApp(page, 'place-order');
await pickLink(page, page.locator('.po-h-customer input'), 'AJ-KUR-TCR-KL', '');
await typeInto(page, row.locator('input[data-fieldname="bank"]'), 'A13405NP-18EF-Y', '');
await expect.poll(async () => await page.evaluate(() =>
  (document.querySelector('.po-grid tbody tr input[data-fieldname="design"]') as HTMLInputElement)?.value
)).toBe('A13405NP-18EF-Y');
```

`say` / `spotlight` / `spotOff` only matter when recording; wrap them so a fast
run can skip them (see `SEED` in `20-order-desk`).

**Assert the outcome, not the clicks.** Check the record was created, the weight
landed, the dialog opened. Every real bug this suite has caught — discarded stone
edits, a permission gap that stopped the order desk printing, materials silently
dropped — was found by an assertion, never by a click that merely succeeded.
