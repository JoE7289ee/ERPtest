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
VARIANT=A13047-18EF-Y ...   # the design to order, when the site has different ones
```

**The order-desk seeder needs a Design that already has a Design Bank.** On a
freshly wiped site `tabDesign` is empty, the grid's `design` Link filters on
`design_bank`, and the spec dies on its own assertion with `design` still blank.
Seed the records directly instead — a Job Order, its bags, then move them onto
the floor:

```python
jo  = frappe.get_doc({"doctype": "Job Order", "order_date": ..., "customer": ...}).insert()
bag = frappe.get_doc({"doctype": "Order Bag", "job_order": jo.name,
                      "design": d, "qty": 1, "bag_bom": dmat[d]}).insert()
japi.transfer_order_bags(json.dumps(bags), "CASTING", remarks="seed")
```

`jewelima.demo.demo_data.make_demo` does all of this and more, but on the current
warehouse set its stock step dies on `Raw Materials Store` (gone), and it refuses
to run at all while `sites/<site>/jewelima_demo_manifest.json` exists — a wipe
removes the records but leaves the manifest, so move it aside first.

Findings stock (for the Issue Findings tutorials) is a plain purchase:

```python
japi.post_raw_material_purchase(supplier="JD Stock", warehouse="Gold Issue - JD",
    voucher_type="SIN", items=json.dumps([{"item": "KERALA SCREW-22KYG", "weight": 40, "count": 0}]))
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

## 5b. Seeding a whole floor: `30-factory`

`tests/30-factory.spec.ts` fills a site with a working floor **through the real
desk pages, as the real people** — Reena places the orders, Jojo buys and
melts, Sheeja moves and issues, Balan runs the stone room. Nothing goes in by
API, so every card, gram and stone lands exactly the way it does on the floor
and can be issued, transferred, made into product and printed afterwards.

```bash
python3 factory_setup.py            # once per site, inside the bench container (see below)
./run-factory.sh dev                # or: ./run-factory.sh prod
./run-factory.sh dev --grep "SHEEJA"  # one actor's legs (grep is a substring of the title)
BAGS=300 PER_BENCH=20 ISSUE_N=10 STONE_N=30 TREE_N=20 ./run-factory.sh dev
```

The runner mints one session per actor and passes them as `REENA_SID` …
`BALAN_SID`. On dev that is `bench browse --user` in the dev container. **On
prod it is not** — `browse` refuses non-Administrator users without
`developer_mode` (which prod must never have) and spawns `xdg-open` browser
fallbacks — so prod mints through `LoginManager.login_as` in the bench's own
python, **in a queue-worker container, never the backend**: every CLI run inside
the live backend container killed gunicorn (18 restarts in four minutes, during
a demo). `PROD_MINT_OK=1` gates it. Legs run serially in file order and
hand state to each other through `.factory/state.json` (gitignored).

| Leg | Who | What | Page |
|---|---|---|---|
| 1 | Reena | `BAGS` cards of one design, `BATCH` per order, split into bags | place-order |
| 2 | Jojo | Standard Gold 999 + Alloy into Gold Issue | purchase-raw-material |
| 2b | Jojo | the design's stones into Stone Issue, sized to `BAGS` + 15 % | purchase-raw-material |
| 3 | Jojo | melts 18KYG / 18KWG / 18KPG / 22KYG from 999 + alloy, sends each to Casting | melt-gold |
| 4 | Sheeja | `PER_BENCH` cards from ORDERING onto every bench the rules allow (not REWORK — that is reached only from a finished piece) | transfer-order-bag |
| 5 | Sheeja | `ISSUE_N` per bench: Job Work at the weight benches, Assign at the light ones | job-work, assign-collect |
| 6 | Balan | `STONE_N` cards at SETTING / WAX SETTING marked for stone issue | stone-request |
| 7 | Balan | issues each one's plan, as himself | stone-issue |
| 8 | Sheeja | one 18KYG tree from TREE MAKING, then gross weights booked onto it | make-tree, casting-weigh |

**`factory_setup.py` is not optional.** Copy it into the bench container and
run it with the bench's own python (`docker cp … ; docker exec … env/bin/python
/home/frappe/factory_setup.py`). It is idempotent and site-agnostic — it finds
things by readable keys, never by hash — and it refuses to run if a prerequisite
is missing, naming it. It creates:

- **balan@jd.in** with `JW Stone Admin` only (buying is Jojo's job), and an
  **Employee linked to that login** — the stone station locks the issuer to it,
  so without the link Balan cannot issue at all.
- **`A13010NP-18EF-Y`**, one Active Design hung on the real `A 13010` card, with
  gold and two diamond lines. The order desk resolves a typed variant code only
  through a Design that carries a Design Bank — a wiped site has none, which is
  why `20-order-desk` cannot seed one.
- a name on the **TREE MAKING roster** — the Make Tree dialog offers only that
  bench's roster, and an empty one means an empty dropdown.

Things learned mapping the pages, which the spec works around:

- **transfer-order-bag leaves its freeze overlay stuck past 30 bags** (freeze is
  called per chunk, unfreeze once). The spec transfers in 20s with a fresh
  `gotoApp` for every batch.
- **Scan boxes clear synchronously before the lookup returns.** Never wait on
  the input emptying — wait on the row count.
- **Job Work and Assign now issue without an employee** behind a confirm; the
  spec always names one so nothing on the floor is left unowned.
- **Balan is not an admin on stone-issue**, so the issuer field is set for him
  and disabled — do not `pickLink` it.
- **Only casting-weigh writes a weight onto a card** at the tree stage;
  make-tree's wax weight is the tree's, not the cards'.

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
- **A stray `/tmp/*.py` can shadow a stdlib/venv module** inside the containers
  (`/tmp/rq.py` shadowed `rq` and broke every `import frappe`). Run one-off
  scripts from `/home/frappe`, not `/tmp`.
- **`bench --site X mariadb -e "..."` through ssh + docker exec silently dies** on
  the quoting. Copy a `.py` in and run it with `frappe-bench/env/bin/python`.
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
