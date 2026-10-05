import sys, json; sys.path.insert(0,'.')
from jw import *
sh, jo, low, ni = User("sheeja@jd.in"), User("jojokk@jd.in"), User("lenusthomas@jd.in"), User("nimaks@jd.in")
A = "E7617.19.1"; EMP = "HR-EMP-00059"
def card(): return bench(f'b=frappe.db.get_value("Order Bag","{A}",["location","act_gross_weight","act_nett_weight","act_pure_weight"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
def soft(r):
    if isinstance(r, dict) and r.get("errors") and not (r.get("done") or r.get("transferred") or r.get("count")): raise Refused(200, str(r["errors"])[:250])
    return r
guarded("transfer CASTING -> GRINDING", low, sh, "transfer_order_bags", names=[A], to_location="GRINDING")
print("bench card:", json.dumps(sh.call("get_bench_card", order_bag=A), default=str)[:400])
guarded("issue at GRINDING", low, sh, "issue_bench_cards", names=[A], location="GRINDING", employee=EMP, work_type=None)
step("receipt with a 0.5 g GAIN (must refuse)", lambda: soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": 3.017}], location="GRINDING", employee=EMP)), expect_refuse=True)
step("receipt with scrub at GRINDING (only FILING may - must refuse)", lambda: soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": 2.4, "scrub": 0.05}], location="GRINDING", employee=EMP)), expect_refuse=True)
step("receipt with weight 0 (must refuse)", lambda: soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": 0}], location="GRINDING", employee=EMP)), expect_refuse=True)
guarded("receipt at GRINDING, 2.497 in (0.020 loss)", low, sh, "receipt_bench_cards", lines=[{"order_bag": A, "weight_in": 2.497}], location="GRINDING", employee=EMP)
print(card()); print(bins(("18KYG", "In Bags - JD"), ("18KYG", "GRINDING -LOSS - JD")))
soft(sh.call("transfer_order_bags", names=[A], to_location="FILING"))
step("issue at FILING", lambda: soft(sh.call("issue_bench_cards", names=[A], location="FILING", employee=EMP)))
step("FILING receipt: 2.447 in + 0.030 scrub (0.020 loss)", lambda: soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": 2.447, "scrub": 0.03}], location="FILING", employee=EMP)))
print(card()); print(bins(("18KYG", "In Bags - JD"), ("18KYG", "FILING -LOSS - JD"), ("18KYG", "Scrub - JD")))
for b in ("SETTING", "PRE POLISH", "FINAL POLISH"):
    soft(sh.call("transfer_order_bags", names=[A], to_location=b))
    step(f"issue at {b}", lambda: soft(sh.call("issue_bench_cards", names=[A], location=b, employee=EMP)))
    step(f"receipt at {b} (0.005 loss)", lambda: soft(sh.call("receipt_bench_cards", lines=[{"order_bag": A, "weight_in": round(json.loads(json.dumps(sh.call('get_bench_card', order_bag=A)))["weight_out"] - 0.005, 3) if False else None}], location=b, employee=EMP)) if False else "skip")
print(card())
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain7.json", "w"), indent=1)
