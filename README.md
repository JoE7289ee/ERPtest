# ERPtest

Playwright end-to-end tests for ERPNext, runnable locally or in Docker.

## Run with Docker

Docker and Docker Compose are the only host requirements. On this machine Docker
lives in the `Ubuntu` WSL distro (not the default `Ubuntu-24.04`), so run from
that distro — e.g. from PowerShell:

```powershell
wsl -d Ubuntu -e bash -lc "cd /mnt/e/playwrterp && docker compose build"
wsl -d Ubuntu -e bash -lc "cd /mnt/e/playwrterp && docker compose run --rm playwright"
```

Defaults: `BASE_URL=https://erp.jdserveraccess.in`, `ERP_USER=Administrator`,
`ERP_PASSWORD=admin`. Override any of them per run:

```powershell
wsl -d Ubuntu -e bash -lc "cd /mnt/e/playwrterp && BASE_URL=https://other-erp.example.com docker compose run --rm playwright"
```

> **Note:** the Dockerfile copies `tests/` into the image, so after editing or
> adding a test you must `docker compose build` again before running.

The HTML report is written to `playwright-report/`. Failure artifacts
(screenshots, video, traces) are written to `test-results/`.

## Run locally (no Docker)

```sh
npm install
npx playwright install
npm test
```

## Tests

Test files live under `tests/`. The current suite logs in to ERPNext as
`Administrator` and asserts the Frappe desk loads (`/app` on newer versions,
`/desk` on older ones).

## Jewelima suite

The suite covers every custom feature (specs run serially — they share live masters):

| Spec | Covers |
| --- | --- |
| `01-smoke` | all 29 Jewelima desk pages render without JS errors |
| `02-setup-masters` | Design Types (sizes, green defaults, 🔒 guards), Types & Salesmen (add/retire/restore), Warehouse flags, Order Settings prefill |
| `03-purchase-melt` | Purchase (Gram/Carat split, auto-row, PR posts), Melting (tick-to-add, strict out, 18KPG blend, over-stock block) |
| `04-place-order` | design lines (type/size/defaults), Split, purity variants (red/black family logic), placing an order, due/customer dates |
| `05-cad` | CAD budgets dialog, routing + collect gates, finalize (CAD Jobs), post-finalize flow |
| `06-production` | Transfer batches + Cards picker, Assign/Collect at CAD, Job Work bench restriction |
| `07-design-bank` | Add Design (Check / Auto-number / tags), Retire Design guarded delete |

Auth happens once (`tests/auth.setup.ts` → `.auth/user.json`); each spec seeds and
cleans its own data through the app's whitelisted APIs, so the suite is safe to
re-run — but point it at a TEST site, not production (it posts real Purchase
Receipts / Stock Entries / Orders).

```sh
BASE_URL=http://development.localhost:8000 ERP_USER=Administrator ERP_PASSWORD=admin npm test
npx playwright test tests/05-cad.spec.ts   # one area only
```
