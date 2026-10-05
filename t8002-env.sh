# source me:  . ./t8002-env.sh   — sessions for the :8002 TEST copy, through the ssh tunnel
export BASE_URL=http://localhost:8002
SID() { ssh newbox "docker exec -u frappe -w /home/frappe/frappe-bench/sites jewelima-test-queue-short-1 /home/frappe/frappe-bench/env/bin/python -c \"
import frappe
from frappe.auth import CookieManager, LoginManager
frappe.init(site='development.localhost'); frappe.connect()
frappe.utils.set_request(path='/')
frappe.local.cookie_manager = CookieManager(); frappe.local.login_manager = LoginManager()
frappe.local.login_manager.login_as('$1')
frappe.db.commit(); print('sid=' + frappe.session.sid)
\" 2>/dev/null" | grep -oE 'sid=[a-f0-9]+' | head -1 | cut -d= -f2; }
