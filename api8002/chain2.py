import sys, json; sys.path.insert(0,'.')
from jw import *
sh, re_, jo, ba, low = User("sheeja@jd.in"), User("reena@jd.in"), User("jojokk@jd.in"), User("balan@jd.in"), User("lenusthomas@jd.in")
A = "E7617.19.1"
def where(c): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","is_finished","stone_issue","tree","act_gross_weight"],as_dict=True); print("RES", dict(b))')[0]
print(where(A))
emp = sh.call("bench_employee_query", doctype="Employee", txt="", searchfield="name", start=0, page_len=5, filters={"location": "CAD"}) if False else None
ro = bench('print("RES", json.dumps({b.name: [e.employee for e in frappe.get_doc("Bench", b.name).employees][:2] for b in frappe.get_all("Bench")}))')[0]
ROSTER = json.loads(ro); print({k: v for k, v in ROSTER.items() if v})
E = lambda b: (ROSTER.get(b) or ROSTER.get("SETTING") or [None])[0]
guarded("assign at CAD", low, sh, "assign_bench_cards", names=[A], location="CAD", employee=E("CAD"))
print(sh.call("get_bench_work_options", location="CAD"))
guarded("collect at CAD", low, sh, "collect_bench_cards", names=[A], location="CAD", employee=E("CAD"))
guarded("transfer CAD -> WAXING", low, sh, "transfer_order_bags", names=[A], to_location="WAXING")
guarded("assign at WAXING", low, sh, "assign_bench_cards", names=[A], location="WAXING", employee=E("WAXING"))
step("transfer while still out with a worker (must refuse)", lambda: (lambda r: (_ for _ in ()).throw(Refused(200, str(r["errors"]))) if r.get("errors") else r)(sh.call("transfer_order_bags", names=[A], to_location="WAX SETTING")), expect_refuse=True)
guarded("collect at WAXING", low, sh, "collect_bench_cards", names=[A], location="WAXING", employee=E("WAXING"))
guarded("transfer WAXING -> WAX SETTING", low, sh, "transfer_order_bags", names=[A], to_location="WAX SETTING")
print(where(A))
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain2.json", "w"), indent=1)
