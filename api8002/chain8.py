import sys, json; sys.path.insert(0,'.')
from jw import *
sh, jo, low, ni = User("sheeja@jd.in"), User("jojokk@jd.in"), User("lenusthomas@jd.in"), User("nimaks@jd.in")
A = "E7617.19.1"; EMP = "HR-EMP-00059"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","is_finished","qty","act_gross_weight","act_nett_weight","act_pure_weight","act_dmd_no","act_dmd_weight","bucket","held_by"],as_dict=True); print("RES", dict(b))')[0]
def soft(r):
    if isinstance(r, dict) and r.get("errors") and not (r.get("done") or r.get("transferred") or r.get("count")): raise Refused(200, str(r["errors"])[:250])
    return r
def recv(b, loss=0.005):
    wo = (sh.call("get_bench_card", order_bag=A).get("record") or {}).get("weight_out")
    return soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": round(wo - loss, 3)}], location=b, employee=EMP))
step("receipt at SETTING", lambda: recv("SETTING"))
for b in ("PRE POLISH", "FINAL POLISH"):
    soft(sh.call("transfer_order_bags", names=[A], to_location=b))
    step(f"issue at {b}", lambda: soft(sh.call("issue_bench_cards", names=[A], location=b, employee=EMP)))
    step(f"receipt at {b}", lambda: recv(b))
step("transfer FINAL POLISH -> BAG EXTRACTION", lambda: soft(sh.call("transfer_order_bags", names=[A], to_location="BAG EXTRACTION")))
print(card())
x = ni.call("get_extraction_cards"); row = [r for r in x.get("rows", []) if r["name"] == A]
print("extraction row:", json.dumps(row, default=str)[:600])
print("make-product card:", json.dumps(ni.call("get_make_product_card", order_bag=A), default=str)[:500])
print("buckets:", [b["name"] for b in ni.call("get_finished_buckets")])
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain8.json", "w"), indent=1)
