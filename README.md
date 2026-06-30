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
