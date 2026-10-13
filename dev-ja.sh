#!/bin/sh
# Runs a spec on the Mac dev bench with a minted Administrator session (never printed).
#   ./dev-ja.sh <spec> [shot dir]
cd "$(dirname "$0")"
export SMOKE_SID=$(docker exec -w /workspace/development/frappe-bench/sites devcontainer-frappe-1 /workspace/development/frappe-bench/env/bin/python -c "
import frappe
from frappe.auth import CookieManager, LoginManager
frappe.init(site='development.localhost'); frappe.connect()
frappe.utils.set_request(path='/')
frappe.local.cookie_manager = CookieManager(); frappe.local.login_manager = LoginManager()
frappe.local.login_manager.login_as('Administrator')
frappe.db.commit(); print('sid=' + frappe.session.sid)
" 2>/dev/null | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2)
[ -n "$SMOKE_SID" ] || { echo "no session"; exit 1; }
SHOT_DIR=${2:-shots} BASE_URL=http://development.localhost:8000 npx playwright test "$1" --project=chromium --no-deps 2>&1 | grep -v "DEP0205\|trace-deprecation"
