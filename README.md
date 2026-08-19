# ERPtest — Playwright suite for Jewelima

Browser tests **and** the narrated tutorial videos for the Jewelima ERPNext app.
The same harness does both: a spec drives the real desk UI, and the helpers draw a
moving cursor, captions and spotlights on top so the recording is watchable.

Everything here runs against a **live site** — there are no fixtures or mocks. A
spec that "passes" has genuinely placed the order, moved the card, created the
variant. Treat every run as writing real data.

---

## Layout

```
tests/
  NN-name.spec.ts     numbered tutorials — each records one video
  auth.setup.ts       logs in with a server-minted session id (no password)
  helpers/tutorial.ts the harness: say / click / typeInto / pickLink / spotlight
assets/               props used by specs (product photos, etc.)
playwright.config.ts  chromium, 1280x800, video: on
to-mp4.sh             webm -> mp4
test-results/         raw recordings — WIPED at the start of every run
*.mp4                 finished videos (git-ignored; regenerate from the specs)
```

## Running

The app runs in Docker on the dev machine. Two things are needed: the site URL
and a **session id** per actor, minted server-side so no password is handled.

```bash
CT=devcontainer-frappe-1     # the frappe container
BENCH=/workspace/development/frappe-bench

# a session id for whoever the video's actor is
SID=$(docker exec -u frappe $CT bash -lc \
  "cd $BENCH && bench --site development.localhost browse --user anakha@jd.in 2>&1" \
  | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2)

cd ~/ERPtest
BASE_URL=http://development.localhost:8000 ERP_SID=$SID \
  npx playwright test 17-new-design --project=chromium --timeout=300000 --reporter=list
```

`19-end-to-end` has **two** actors and needs a second id:

```bash
SHEEJA_SID=$(docker exec -u frappe $CT bash -lc \
  "cd $BENCH && bench --site development.localhost browse --user sheeja@jd.in 2>&1" \
  | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2)
BASE_URL=... ERP_SID=$A SHEEJA_SID=$S npx playwright test 19-end-to-end ...
```

### Making the mp4

**Convert in the same command as the run.** Playwright clears `test-results/`
when the next run starts, so a recording left there is lost the moment anything
else runs.

```bash
npx playwright test 20-order-desk --project=chromium --reporter=list
W=$(ls -t test-results/*/video.webm | head -1)
ffmpeg -y -i "$W" -c:v libx264 -pix_fmt yuv420p -movflags +faststart tutorial-20-order-desk.mp4
```

### The seeder

`20-order-desk` doubles as a way to fill a dev site with real cards:

```bash
SEED=1 BAGS=25 npx playwright test 20-order-desk --project=chromium   # no captions, fast
KEEP_IN_ORDERING=1 ...                                               # leave them in ORDERING
```

---

## Writing a spec

Import the harness and let it narrate:

```ts
import { test, expect, gotoHome, gotoApp, say, click, typeInto, pickLink,
         spotlight, spotOff, pause } from './helpers/tutorial';

await gotoApp(page, 'place-order');
await say(page, 'Start with the <b>party</b>.', 3400);   // caption, holds N ms
await pickLink(page, page.locator('.po-h-customer input'), 'AJ-KUR-TCR-KL', '');
await spotlight(page, page.locator('.po-grid'), 'One line per bag.', 3600);
await spotOff(page);
```

**Assert the thing actually happened.** A tutorial that films a broken flow is
worse than a failing test — check the record was created, the weight landed, the
dialog opened. Several real bugs were found exactly this way.

---

## Hard-won gotchas

Each of these cost real time. Read before debugging.

- **`--reporter=line` overwrites `console.log`.** Later lines vanish. Use
  `--reporter=list`.
- **`test-results/` is wiped at the start of every run** — convert videos
  immediately (see above).
- **Link fields store the record *name*, not the code you see.** `Design Bank` is
  a hash, not `A 13405 NP`; setting the visible text silently fails. Pick from the
  dropdown, or set the real name.
- **`page.evaluate(() => cur_dialog.set_value(...))` hangs.** The arrow returns
  Frappe's promise, which resolves late; `evaluate` waits for it and blocks until
  the test times out. Use a block body: `() => { d.set_value(...); }`.
- **`locator.getAttribute()` on a missing element waits the full timeout** and
  looks exactly like a page hang. Pass `{ timeout: 4000 }`.
- **Modals are `position: fixed`, so `offsetParent` is null.** Filtering visible
  modals that way matches nothing — use `.modal.show`.
- **Stacked dialogs:** `.modal.show .btn-primary` may hit the dialog *behind* the
  one you mean. Pick the modal that contains a field you know, then its button.
- **Frappe autocompletes render `.awesomplete li`; Link fields render
  `role=option`.** They are not interchangeable.
- **Read-only fields render as text, not `<input>`** — read them with
  `cur_dialog.get_value(...)`, not `inputValue()`.
- **The order grid keeps one blank spare row**, so after splitting into 6 there
  are 7 `<tr>`s. Count rows carrying a design.
- **Card names are `<order>.<line>.<qty>`** — a 5-piece bag is `E0002.1.5`, not
  `.1.1`.

## Data notes

- Specs write to the live dev site. Clean up what a run created (test cards,
  orders, variants) unless it is meant as a fixture.
- Resetting a naming series while an `Order No Reservation` still exists makes the
  next order fail with *Duplicate Name*. Clear reservations too.
- Videos are published from the app side as `Training Video` records; this repo
  only produces the mp4.
