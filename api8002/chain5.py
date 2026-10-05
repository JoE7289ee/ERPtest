import sys, json; sys.path.insert(0,'.')
from jw import *
sh, ba, sm, jo, low = User("sheeja@jd.in"), User("balans@jd.in"), User("smitha@jd.in"), User("jojokk@jd.in"), User("lenusthomas@jd.in")
A = "E7617.19.1"
def card(): return bench(f'b=frappe.db.get_value("Order Bag","{A}",["location","stock_status","stone_issue","tree","act_gross_weight","act_nett_weight","act_dmd_no","act_dmd_weight"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
L = lambda p1, c1, p2=0, c2=0: [{"item": "VVS-EF 2-2.5", "pcs": p1, "ct": c1}] + ([{"item": "VVS-EF 3-3.5", "pcs": p2, "ct": c2}] if p2 or c2 else [])
step("Smitha issues the rest, naming herself", lambda: (sm.call("stone_issue_apply", order_bag=A, lines=L(6, 0.054, 3, 0.033), issued_by="HR-EMP-00099") or {}).get("order_bag"))
step("issue again when the plan is full (must refuse)", lambda: sm.call("stone_issue_apply", order_bag=A, lines=L(1, 0.009), issued_by="HR-EMP-00099"), expect_refuse=True)
print(card())
# stone return: take 2 pcs back
print("return card:", json.dumps(sm.call("get_stone_return_card", barcode=A), default=str)[:500])
step("outsider returns stones (must refuse)", lambda: low.call("stone_return_apply", order_bag=A, lines=L(2, 0.018)), expect_refuse=True)
step("return more than was issued (must refuse)", lambda: sm.call("stone_return_apply", order_bag=A, lines=L(20, 0.18), returned_by="HR-EMP-00099"), expect_refuse=True)
step("Smitha takes 2 stones back", lambda: (sm.call("stone_return_apply", order_bag=A, lines=L(2, 0.018), returned_by="HR-EMP-00099") or {}) and "ok")
c = sm.call("get_stone_issue_card", barcode=A); print("after return:", [(l["item"], l["issued_pcs"], l["issued_ct"]) for l in c.get("lines", [])] if c.get("lines") else c)
print(bins(("VVS-EF 2-2.5", "Stone Issue - JD"), ("VVS-EF 2-2.5", "In Bags - JD")))
step("re-issue the 2 stones", lambda: (sm.call("mark_stone_issue", bags=[A]), sm.call("stone_issue_apply", order_bag=A, lines=L(2, 0.018), issued_by="HR-EMP-00099"))[1].get("order_bag"))
print(card())
# tree
guarded("transfer WAX SETTING -> TREE MAKING", low, sh, "transfer_order_bags", names=[A], to_location="TREE MAKING")
print("tree queues:", json.dumps(sh.call("get_tree_queues"), default=str)[:300])
guarded("make a tree", low, sh, "make_tree", karat="18KYG", names=[A], employee="HR-EMP-00107", wax_weight=3.4)
print(card())
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain5.json", "w"), indent=1)
