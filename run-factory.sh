#!/bin/bash
# Seed a floor through the real desk, as the real people.
#   ./run-factory.sh dev  [BAGS=1000] [PER_BENCH=20] [--grep "REENA"] ...
#   ./run-factory.sh prod ...
# Mints one session per actor on the target's bench, then runs 30-factory.
# Before the first run on a site: python factory_setup.py   (see README)
set -e
TARGET="${1:-dev}"; shift || true
case "$TARGET" in
  dev)  BASE=http://development.localhost:8000
        SID() { docker exec -u frappe devcontainer-frappe-1 bash -lc "cd /workspace/development/frappe-bench && bench --site development.localhost browse --user $1 2>&1" | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2; } ;;
  prod) BASE=https://erp.jdserveraccess.in
        SID() { ssh newbox "docker exec -u frappe jewelima-prod-backend-1 bash -lc 'cd /home/frappe/frappe-bench && bench --site development.localhost browse --user $1 2>&1'" | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2; } ;;
  *) echo "target must be dev or prod"; exit 1 ;;
esac
echo "minting sessions on $TARGET…"
export BASE_URL="$BASE"
export ERP_SID=$(SID Administrator)
export REENA_SID=$(SID reena@jd.in) JOJO_SID=$(SID jojokk@jd.in) SHEEJA_SID=$(SID sheeja@jd.in) BALAN_SID=$(SID balan@jd.in)
for v in ERP_SID REENA_SID JOJO_SID SHEEJA_SID BALAN_SID; do
  [ -n "${!v}" ] || { echo "could not mint $v — does the user exist on $TARGET? run factory_setup.py first"; exit 1; }
done
echo "ok — $BASE"
npx playwright test 30-factory --project=chromium --reporter=list --timeout=1800000 "$@"
