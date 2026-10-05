import sys, json; sys.path.insert(0,'.')
from jw import *
sh, jo, low, ni = User("sheeja@jd.in"), User("jojokk@jd.in"), User("lenusthomas@jd.in"), User("nimaks@jd.in")
A, T = "E7617.19.1", "T-18Y-003"
def card(): return bench(f'b=frappe.db.get_value("Order Bag","{A}",["location","stock_status","tree","act_gross_weight","act_nett_weight","act_pure_weight","act_purity","act_dmd_no","act_dmd_weight"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
t = sh.call("get_tree_edit", tree=T); print("tree:", json.dumps(t, default=str)[:700])
print(bins(("18KYG", "Casting - JD"), ("18KYG", "In Bags - JD"), ("18KYG", "Casting -LOSS - JD")))
step("weigh before the casting report (must refuse)", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": A, "gross": 2.55}]), expect_refuse=True)
step("Sheeja saves the casting report (not her role - must refuse)", lambda: sh.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=7.2, prod_wt=2.6, dust_wt=0.05), expect_refuse=True)
step("report with a GAIN (more out than in - must refuse)", lambda: jo.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=8.0, prod_wt=2.6, dust_wt=0.05), expect_refuse=True)
step("Jojo saves the casting report", lambda: json.dumps(jo.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=7.2, prod_wt=2.6, dust_wt=0.05), default=str)[:200])
guarded("complete the casting report", low, jo, "complete_casting_report", tree=T)
print(bins(("18KYG", "Casting - JD"), ("18KYG", "In Bags - JD"), ("18KYG", "Casting -LOSS - JD")))
step("weigh a card that is not on this tree (must refuse)", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": "E7617.2.1", "gross": 2.5}]), expect_refuse=True)
step("weigh lighter than the stones it holds (must refuse)", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": A, "gross": 0.01}]), expect_refuse=True)
guarded("book the cast weight 2.550 g", low, sh, "cast_weigh", tree=T, entries=[{"order_bag": A, "gross": 2.55}])
print(card()); print(bins(("18KYG", "Casting - JD"), ("18KYG", "In Bags - JD")))
step("weigh the same card twice (must refuse)", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": A, "gross": 2.55}]), expect_refuse=True)
print("tree after:", {k: v for k, v in (sh.call("get_tree_edit", tree=T) or {}).items() if k in ("status", "report_done", "casting_date", "loss", "karat")})
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain6.json", "w"), indent=1)
