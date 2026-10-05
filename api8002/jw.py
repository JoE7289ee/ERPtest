"""Tiny client for the :8002 TEST copy: act as a real user through the same
whitelisted calls the desk pages make. Sessions are minted on the server
(LoginManager.login_as) — no passwords anywhere."""
import json, os, re, subprocess, sys, time, urllib.parse, http.cookiejar, urllib.request

BASE = "http://localhost:8002"
API = "jewelima.jewelima.api."
CACHE = os.path.join(os.path.dirname(__file__), ".sessions.json")
MINT = '''docker exec -u frappe -w /home/frappe/frappe-bench/sites jewelima-test-queue-short-1 /home/frappe/frappe-bench/env/bin/python -c "
import frappe
from frappe.auth import CookieManager, LoginManager
frappe.init(site='development.localhost'); frappe.connect()
frappe.utils.set_request(path='/')
frappe.local.cookie_manager = CookieManager(); frappe.local.login_manager = LoginManager()
frappe.local.login_manager.login_as('%s')
frappe.db.commit(); print('sid=' + frappe.session.sid)
" 2>/dev/null'''


class Refused(Exception):
    def __init__(self, status, msg, raw=None):
        super().__init__(msg); self.status, self.msg, self.raw = status, msg, raw


class User:
    def __init__(self, email):
        self.email = email
        c = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
        self.sid = c.get(email)
        if not self.sid or not self._alive():
            out = subprocess.run(["ssh", "newbox", MINT % email], capture_output=True, text=True).stdout
            m = re.search(r"sid=([a-f0-9]+)", out)
            if not m: raise RuntimeError("could not mint a session for " + email)
            self.sid = m.group(1); c[email] = self.sid; json.dump(c, open(CACHE, "w"))
        self.csrf = None

    def _req(self, path, data=None, headers=None):
        h = {"Cookie": "sid=" + self.sid, "Accept": "application/json"}
        h.update(headers or {})
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        r = urllib.request.Request(BASE + path, data=body, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=180) as f: return f.status, f.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def _alive(self):
        s, b = self._req("/api/method/frappe.auth.get_logged_user")
        return s == 200 and self.email.lower() in b.decode().lower()

    def _token(self):
        if not self.csrf:
            s, b = self._req("/desk?desk=1", headers={"Accept": "text/html"})
            m = re.search(r'csrf_token\s*[=:]\s*"([a-f0-9]+)"', b.decode(errors="ignore"))
            self.csrf = m.group(1) if m else "x"
        return self.csrf

    def call(self, method, **args):
        """POST like frappe.call does. Returns message; raises Refused with the server's own words."""
        if "." not in method: method = API + method
        data = {k: (json.dumps(v) if isinstance(v, (dict, list, bool)) else v) for k, v in args.items() if v is not None}
        s, b = self._req("/api/method/" + method, data=data, headers={"X-Frappe-CSRF-Token": self._token()})
        try: j = json.loads(b.decode())
        except Exception: raise Refused(s, b.decode(errors="ignore")[:300])
        if s != 200 or j.get("exc_type") or j.get("exception"):
            msgs = []
            for m in json.loads(j.get("_server_messages") or "[]"):
                try: msgs.append(re.sub(r"<[^>]+>", "", json.loads(m).get("message", "")))
                except Exception: msgs.append(str(m))
            raise Refused(s, " | ".join(msgs) or j.get("exception") or j.get("exc_type") or str(s), j)
        return j.get("message")

    def get_list(self, doctype, filters=None, fields=None, limit=20, order_by=None):
        return self.call("frappe.client.get_list", doctype=doctype, filters=filters or {}, fields=fields or ["name"], limit_page_length=limit, order_by=order_by)


def bench(script):
    """Run python in the TEST bench (truth checks: stock, ledgers). Prints RES lines."""
    p = "/tmp/_jw_%d.py" % int(time.time() * 1000)
    open(p, "w").write("def main():\n    import frappe, json\n    from frappe.utils import flt\n" + "\n".join("    " + l for l in script.strip("\n").split("\n")) + "\nmain()\n")
    subprocess.run(["scp", "-q", p, "newbox:" + p]); b = os.path.basename(p)
    out = subprocess.run(["ssh", "newbox", f"docker cp {p} jewelima-test-backend-1:/home/frappe/{b} && docker exec -i jewelima-test-backend-1 bash -c 'cd /home/frappe/frappe-bench && bench --site development.localhost console < /home/frappe/{b}; rm -f /home/frappe/{b}'"], capture_output=True, text=True).stdout
    res = [re.sub(r"^.*?RES ?", "", l) for l in out.split("\n") if "RES" in l and "print(" not in l]
    err = [l for l in out.split("\n") if re.search(r"^[A-Za-z.]*(Error|Exception)\b", l.strip())]
    return res + (["ERR " + e for e in err[:3]])


LOG = []
def step(title, fn, expect_refuse=False):
    """Run one step, record pass/fail with the server's words."""
    try:
        r = fn()
        ok = not expect_refuse
        LOG.append({"step": title, "ok": ok, "note": "" if ok else "EXPECTED A REFUSAL, GOT THROUGH", "ret": str(r)[:300]})
        print(("  ok   " if ok else "  BUG  ") + title + ("" if ok else "  <- expected a refusal, got through") + "  -> " + str(r)[:140])
        return r
    except Refused as e:
        ok = expect_refuse
        LOG.append({"step": title, "ok": ok, "note": e.msg[:400], "status": e.status})
        print(("  ok   " if ok else "  FAIL ") + title + "  -> [" + str(e.status) + "] " + e.msg[:260])
        return None


GAPS = []
def guarded(title, low, right, method, **args):
    """Try the call as someone with no business doing it; if the server lets
    them, that is a permission gap (and the step is done). Otherwise do it as
    the rightful person."""
    try:
        r = low.call(method, **args)
        errs = (r or {}).get("errors") if isinstance(r, dict) else None
        if errs and not ((r or {}).get("done") or (r or {}).get("transferred") or (r or {}).get("count")):
            raise Refused(200, "per-row errors: " + str(errs)[:200])
        GAPS.append({"step": title, "method": method, "as": low.email})
        print("  GAP  " + title + "  <- " + low.email + " was allowed  -> " + str(r)[:120])
        LOG.append({"step": title, "ok": False, "note": "PERMISSION GAP: " + low.email + " allowed", "ret": str(r)[:200]})
        return r
    except Refused as e:
        print("       (" + low.email.split("@")[0] + " refused: " + e.msg[:70] + ")")
    return step(title + " [" + right.email.split("@")[0] + "]", lambda: right.call(method, **args))
