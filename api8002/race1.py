import sys, json, threading; sys.path.insert(0,'.')
from jw import *
sh, ba, sm, ni, an, fe = User("sheeja@jd.in"), User("balans@jd.in"), User("smitha@jd.in"), User("nimaks@jd.in"), User("antonysebastian@jd.in"), User("femipaul@jd.in")
for u in (sh, ba, sm, ni, an, fe): u._token()
C = "E7617.3.1"
sh.call("transfer_order_bags", names=[C], to_location="WAX SETTING"); sh.call("mark_stone_issue", bags=[C])
res = {}
def go(key, u, m, **a):
    try: res[key] = ("ok", str(u.call(m, **a))[:90])
    except Refused as e: res[key] = ("refused", e.msg[:110])
L = [{"item": "VVS-EF 2-2.5", "pcs": 12, "ct": 0.108}, {"item": "VVS-EF 3-3.5", "pcs": 6, "ct": 0.066}]
ts = [threading.Thread(target=go, args=("balan", ba, "stone_issue_apply"), kwargs=dict(order_bag=C, lines=L)),
      threading.Thread(target=go, args=("smitha", sm, "stone_issue_apply"), kwargs=dict(order_bag=C, lines=L, issued_by="HR-EMP-00099"))]
[t.start() for t in ts]; [t.join() for t in ts]
print("two people issue the full plan to one card at the same moment:"); [print("  ", k, v) for k, v in res.items()]
print(bench(f'print("RES held", frappe.db.sql("select item, sum(case when direction=\'In\' then pcs else -pcs end), round(sum(case when direction=\'In\' then qty else -qty end),4) from `tabBag Material Ledger` where order_bag=%s group by 1", "{C}"))'))
# two people make the same product at once
D = "E7619.1.1"; res.clear()
ts = [threading.Thread(target=go, args=("nima", ni, "make_products"), kwargs=dict(bags=[D], bucket="FEMI")),
      threading.Thread(target=go, args=("antony", an, "make_products"), kwargs=dict(bags=[D], bucket="SUMI"))]
[t.start() for t in ts]; [t.join() for t in ts]
print("two people make the same product at the same moment:"); [print("  ", k, v) for k, v in res.items()]
print(bench(f'''
q = lambda it, wh: flt(frappe.db.get_value("Bin", {{"item_code": it, "warehouse": wh}}, "actual_qty"))
print("RES", frappe.db.get_value("Order Bag","{D}",["is_finished","bucket","stock_status"]), "| FG moves for this card:", frappe.db.sql("select count(*) from `tabBag Material Ledger` where order_bag=%s and direction='Out'", "{D}"), "InBags 18KYG", q("18KYG","In Bags - JD"))
'''))
