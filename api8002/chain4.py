import sys, json; sys.path.insert(0,'.')
from jw import *
sh, ba, sm, low = User("sheeja@jd.in"), User("balans@jd.in"), User("smitha@jd.in"), User("lenusthomas@jd.in")
A = "E7617.19.1"
def stock():
    return bench(f'''
q = lambda it, wh: flt(frappe.db.get_value("Bin", {{"item_code": it, "warehouse": wh}}, "actual_qty"))
led = frappe.db.sql("select item, entry_type, sum(pcs), round(sum(qty),4) from `tabBag Material Ledger` where order_bag=%s group by 1,2", "{A}") if frappe.db.exists("DocType","Bag Material Ledger") else None
print("RES", "SI 2-2.5", q("VVS-EF 2-2.5","Stone Issue - JD"), "SI 3-3.5", q("VVS-EF 3-3.5","Stone Issue - JD"), "InBags 2-2.5", q("VVS-EF 2-2.5","In Bags - JD"), "InBags 3-3.5", q("VVS-EF 3-3.5","In Bags - JD"), "| ledger", led)
''')
print(stock())
L = lambda p1, c1, p2=0, c2=0: [{"item": "VVS-EF 2-2.5", "pcs": p1, "ct": c1}] + ([{"item": "VVS-EF 3-3.5", "pcs": p2, "ct": c2}] if p2 or c2 else [])
step("outsider issues stones (must refuse)", lambda: low.call("stone_issue_apply", order_bag=A, lines=L(1, 0.01)), expect_refuse=True)
print("weight check 12pcs/0.108:", ba.call("stone_issue_weight_check", order_bag=A, lines=L(12, 0.108)) if True else None)
try: print("weight check 12pcs/0.300:", ba.call("stone_issue_weight_check", order_bag=A, lines=L(12, 0.300)))
except Refused as e: print("weight check refused:", e.msg[:200])
step("issue 12 pcs at 3x the sieve weight (stop % should refuse)", lambda: ba.call("stone_issue_apply", order_bag=A, lines=L(12, 0.324)), expect_refuse=True)
step("issue more pieces than the plan (40 of 12)", lambda: ba.call("stone_issue_apply", order_bag=A, lines=L(40, 0.36)), expect_refuse=True)
step("issue an item not on the card", lambda: ba.call("stone_issue_apply", order_bag=A, lines=[{"item": "VVS-EF 1-1.5", "pcs": 2, "ct": 0.01}]), expect_refuse=True)
step("issue negative carats", lambda: ba.call("stone_issue_apply", order_bag=A, lines=[{"item": "VVS-EF 2-2.5", "pcs": -3, "ct": -0.03}]), expect_refuse=True)
step("Balan issues half the plan", lambda: ba.call("stone_issue_apply", order_bag=A, lines=L(6, 0.054, 3, 0.033)))
print(stock())
step("Smitha issues the rest", lambda: sm.call("stone_issue_apply", order_bag=A, lines=L(6, 0.054, 3, 0.033)))
print(stock())
c = ba.call("get_stone_issue_card", barcode=A); print([(l["item"], l["issued_pcs"], l["issued_ct"]) for l in c.get("lines", [])], c.get("error"), c.get("message"))
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain4.json", "w"), indent=1)
