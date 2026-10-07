import sys, json; sys.path.insert(0,'.')
from jw import *
an, sh, sm, fe, ni = User("antonysebastian@jd.in"), User("sheeja@jd.in"), User("smitha@jd.in"), User("femipaul@jd.in"), User("nimaks@jd.in")
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:200])) if isinstance(r, dict) and (r.get("errors") or r.get("error")) and not (r.get("done") or r.get("count")) else r
print("== diamond pricing: a piece whose stones differ from its plan")
# E7617.3.1 holds its full plan (18 / 0.174). Take 3 stones back, then make it a product and price it.
C = "E7617.3.1"
pass
pass
T = bench(f"print(\"RES\", frappe.db.get_value(\"Order Bag\", \"{C}\", \"tree\"))")[0].strip()
jo = sh; jo.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=7.3, prod_wt=2.6, dust_wt=0.05); jo.call("complete_casting_report", tree=T)
sh.call("cast_weigh", tree=T, entries=[{"order_bag": C, "gross": 2.6}]); soft(sh.call("transfer_order_bags", names=[C], to_location="BAG EXTRACTION"))
step("make the product", lambda: soft(ni.call("make_products", bags=[C], bucket="FEMI")))
p = an.call("get_sale_piece", barcode=C, price_chart="PCH-0067", gold_rate=9000)
print("   header dmd_ct:", p["dmd_ct"], "| lines:", [(d["pcs"], d["ct"], d["rate"]) for d in p["dmd_detail"]], "| diamond value:", p["diamond_value"], "| expected", round((0.081 + 0.066) * 58000, 2))
print("== cancelled card must not move")
step("transfer the cancelled card E7619.1.2 (must refuse)", lambda: soft(sh.call("transfer_order_bags", names=["E7619.1.2"], to_location="FILING")), expect_refuse=True)
print("== stone issue on a card that is not marked")
step("issue one more stone onto the full, unmarked card E7619.1.3 (must refuse)", lambda: User("balans@jd.in").call("stone_issue_apply", order_bag="E7619.1.3", lines=[{"item": "VVS-EF 2-2.5", "pcs": 1, "ct": 0.009}]), expect_refuse=True)
print("== rework clears the bucket")
r = fe.call("rework_pieces", order_bags=[C], to_location="REWORK", remarks="recheck"); print("  ", str(r)[:120])
print(bench(f'print("RES", frappe.db.get_value("Order Bag","{C}",["location","bucket","held_by","stock_status"]))'))
print("== manager on Server Usage:", end=" ")
try: an.call("jewelima.jewelima.server_usage.get_server_usage"); print("allowed")
except Refused as e: print("answer:", e.msg[:90])
