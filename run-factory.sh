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
# a container mid-restart answers nothing for a few seconds — try again rather than
# calling a user missing who is only momentarily unreachable
MINT() { local s; for i in 1 2 3 4 5 6; do s=$(SID "$1" 2>/dev/null); [ -n "$s" ] && { echo "$s"; return; }; sleep 5; done; }
export ERP_SID=$(MINT Administrator)
export REENA_SID=$(MINT reena@jd.in) JOJO_SID=$(MINT jojokk@jd.in) SHEEJA_SID=$(MINT sheeja@jd.in) BALAN_SID=$(MINT balan@jd.in)
for v in ERP_SID REENA_SID JOJO_SID SHEEJA_SID BALAN_SID; do
  [ -n "${!v}" ] || { echo "could not mint $v — does the user exist on $TARGET? run factory_setup.py first"; exit 1; }
done
echo "ok — $BASE"
npx playwright test 30-factory --project=chromium --reporter=list --timeout=1800000 "$@"
