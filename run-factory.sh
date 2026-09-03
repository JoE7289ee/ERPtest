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
        # NEVER exec bench inside the live backend container: on 2026-09-03 every
        # `bench browse` there killed gunicorn ("Worker failed to boot") — one restart
        # per mint, 18 in four minutes, during a customer demo. Sessions for prod are
        # minted in a queue-worker container, which has the bench but serves no HTTP.
        [ "$PROD_MINT_OK" = "1" ] || { echo "prod minting is gated: set PROD_MINT_OK=1 once you have read the note above"; exit 1; }
        # `bench browse --user` refuses anyone but Administrator unless developer_mode
        # is on — which prod must never have — and it spawns xdg-open browser fallbacks
        # besides. So prod mints the way browse does underneath: LoginManager.login_as,
        # through the bench's own python. No password, no gate, no browser.
        SID() { ssh newbox "docker exec -u frappe -w /home/frappe/frappe-bench/sites jewelima-prod-queue-short-1 /home/frappe/frappe-bench/env/bin/python -c \"
import frappe
from frappe.auth import CookieManager, LoginManager
frappe.init(site='development.localhost'); frappe.connect()
frappe.utils.set_request(path='/')
frappe.local.cookie_manager = CookieManager(); frappe.local.login_manager = LoginManager()
frappe.local.login_manager.login_as('$1')
frappe.db.commit(); print('sid=' + frappe.session.sid)
\" 2>/dev/null" | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2; } ;;
  *) echo "target must be dev or prod"; exit 1 ;;
esac
echo "minting sessions on $TARGET…"
export BASE_URL="$BASE"
# a container mid-restart answers nothing for a few seconds — try again rather than
# calling a user missing who is only momentarily unreachable
# ONE attempt each. The retry loop that used to live here turned one bad mint into
# six, and on prod that meant six backend restarts per user.
MINT() { SID "$1" 2>/dev/null; }
export ERP_SID=$(MINT Administrator)
export REENA_SID=$(MINT reena@jd.in) JOJO_SID=$(MINT jojokk@jd.in) SHEEJA_SID=$(MINT sheeja@jd.in) BALAN_SID=$(MINT balan@jd.in)
for v in ERP_SID REENA_SID JOJO_SID SHEEJA_SID BALAN_SID; do
  [ -n "${!v}" ] || { echo "could not mint $v on $TARGET — the user is missing, or the minting path failed (see the comments above)"; exit 1; }
done
echo "ok — $BASE"
npx playwright test 30-factory --project=chromium --reporter=list --timeout=1800000 "$@"
