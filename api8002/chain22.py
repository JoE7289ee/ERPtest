"""Access fixes of 7 Oct 2026 on :8002, through real requests: the role map is
applied on /api/v1/ too, and on a Jewelima function handed to one of Frappe's own
dispatchers. An outsider is refused; the rightful user still gets through."""
import sys, json; sys.path.insert(0, '.')
from jw import *
low, sh = User("lenusthomas@jd.in"), User("sheeja@jd.in")
def raw(u, path, **data):
    s, b = u._req(path, data={k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in data.items()}, headers={"X-Frappe-CSRF-Token": u._token()})
    t = b.decode(errors="ignore")
    return s, ("not part of your desk" in t), t[:160].replace("\n", " ")
def check(title, got, want_refused):
    s, guard_said_no, t = got
    refused = guard_said_no or s == 403
    ok = refused == want_refused
    LOG.append({"step": title, "ok": ok, "status": s}); print(("  ok   " if ok else "  BUG  ") + title + f"  -> [{s}] " + ("refused by the role check" if guard_said_no else t[:90]))
M = "jewelima.jewelima.api."
check("outsider, ordinary address: move cards", raw(low, "/api/method/" + M + "transfer_order_bags", names=[], to_location="FILING"), True)
check("outsider, /api/v1/ address: move cards", raw(low, "/api/v1/method/" + M + "transfer_order_bags", names=[], to_location="FILING"), True)
check("outsider, /api/v2/ address: move cards", raw(low, "/api/v2/method/" + M + "transfer_order_bags", names=[], to_location="FILING"), True)
check("outsider, through Frappe's mapper: collect a certification batch", raw(low, "/api/method/frappe.model.mapper.make_mapped_doc", method=M + "collect_certification", source_name="NOPE"), True)
check("outsider, through Frappe's search: the bench employee list", raw(low, "/api/method/frappe.desk.search.search_link", doctype="Employee", txt="", query=M + "bench_employee_query", filters={"location": "FILING"}), True)
check("floor user, ordinary address: bench work options", raw(sh, "/api/method/" + M + "get_bench_work_options", location="FILING"), False)
check("floor user, /api/v1/ address: bench work options", raw(sh, "/api/v1/method/" + M + "get_bench_work_options", location="FILING"), False)
check("floor user, through Frappe's search: the bench employee list", raw(sh, "/api/method/frappe.desk.search.search_link", doctype="Employee", txt="", query=M + "bench_employee_query", filters={"location": "FILING"}), False)
check("outsider, his own desk still works: design gallery", raw(low, "/api/method/jewelima.jewelima.design_bank_api.get_designs", start=0, limit=5), False)
json.dump({"LOG": LOG}, open("chain22.json", "w"), indent=1)
print("SUMMARY", sum(1 for l in LOG if l["ok"]), "of", len(LOG))
