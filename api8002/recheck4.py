import sys, json, threading; sys.path.insert(0,'.')
from jw import *
re_, sh, ba, sm, ni, an, jo = User("reena@jd.in"), User("sheeja@jd.in"), User("balans@jd.in"), User("smitha@jd.in"), User("nimaks@jd.in"), User("antonysebastian@jd.in"), User("jojokk@jd.in")
for u in (sh, ba, sm, ni, an): u._token()
EMP = "HR-EMP-00059"
q = lambda it, wh: float(bench(f"print('RES', flt(frappe.db.get_value('Bin', {{'item_code': '{it}', 'warehouse': '{wh}'}}, 'actual_qty')))")[0])
def newcard(qty=1):
    o = re_.call("create_job_order", payload={"customer": "AJ-KUR-TCR-KL", "order_type": "CUSTOMER", "due_date": "2026-10-30"})
    return re_.call("create_order_bag", payload={"job_order": o, "design": "A13010NP-18EF-Y", "qty": qty, "size": "NA"})
def cast(c, gross=2.6):
    sh.call("transfer_order_bags", names=[c], to_location="TREE MAKING")
    T = sh.call("make_tree", karat="18KYG", names=[c], employee="HR-EMP-00107", wax_weight=3.3)["tree"]
    sh.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=7.3, prod_wt=2.6, dust_wt=0.05); sh.call("complete_casting_report", tree=T)
    sh.call("cast_weigh", tree=T, entries=[{"order_bag": c, "gross": gross}])
print("== gain at a bench")
c = newcard(); cast(c)
sh.call("transfer_order_bags", names=[c], to_location="GRINDING"); sh.call("issue_bench_cards", names=[c], location="GRINDING", employee=EMP)
print("   Production holds", q("18KYG", "Production - JD"), "g of 18KYG; card went out at 2.600")
r = sh.call("receipt_bench_cards", lines=[{"order_bag": c, "weight_in": 2.9}], location="GRINDING", employee=EMP)
print("   receipt 0.300 g heavier ->", "done" if r["done"] else "REFUSED:", (r["errors"] or [{}])[0].get("error", "")[:200])
# put 1 g into Production as the stock desk would, then try again
tw = jo.call("get_transfer_warehouses") if False else None
print(bench('''
from jewelima.jewelima.api import _stock_move, _wh
_stock_move("18KYG", 1.5, _wh("Casting"), _wh("Production")); frappe.db.commit(); print("RES moved 1.5 g Casting -> Production")
'''))
print("   Production now holds", q("18KYG", "Production - JD"))
r = sh.call("receipt_bench_cards", lines=[{"order_bag": c, "weight_in": 2.9}], location="GRINDING", employee=EMP)
print("   receipt 0.300 g heavier ->", "done, gain", r["total_gain"] if r["done"] else "REFUSED: " + r["errors"][0]["error"][:160], "| Production after:", q("18KYG", "Production - JD"))
print("== two people, one card, same moment")
res = {}
def go(key, u, m, **a):
    try: res[key] = ("ok", json.dumps(u.call(m, **a), default=str)[:150])
    except Refused as e: res[key] = ("answer", e.msg[:200])
d = newcard(); sh.call("transfer_order_bags", names=[d], to_location="WAX SETTING"); sh.call("mark_stone_issue", bags=[d])
L = [{"item": "VVS-EF 2-2.5", "pcs": 12, "ct": 0.108}, {"item": "VVS-EF 3-3.5", "pcs": 6, "ct": 0.066}]
ts = [threading.Thread(target=go, args=("Balan", ba, "stone_issue_apply"), kwargs=dict(order_bag=d, lines=L)), threading.Thread(target=go, args=("Smitha", sm, "stone_issue_apply"), kwargs=dict(order_bag=d, lines=L, issued_by="HR-EMP-00099"))]
[t.start() for t in ts]; [t.join() for t in ts]
print(" stone issue:"); [print("    ", k, "->", v[0], "|", v[1][:170]) for k, v in sorted(res.items())]
res.clear(); sh.call("transfer_order_bags", names=[c], to_location="BAG EXTRACTION")
ts = [threading.Thread(target=go, args=("Nima", ni, "make_products"), kwargs=dict(bags=[c], bucket="FEMI")), threading.Thread(target=go, args=("Antony", an, "make_products"), kwargs=dict(bags=[c], bucket="SUMI"))]
[t.start() for t in ts]; [t.join() for t in ts]
print(" make product:"); [print("    ", k, "->", v[1][:190]) for k, v in sorted(res.items())]
res.clear(); e = newcard()
ts = [threading.Thread(target=go, args=("Sheeja", sh, "transfer_order_bags"), kwargs=dict(names=[e], to_location="CAD")), threading.Thread(target=go, args=("Antony", an, "transfer_order_bags"), kwargs=dict(names=[e], to_location="WAXING"))]
[t.start() for t in ts]; [t.join() for t in ts]
print(" transfer:"); [print("    ", k, "->", v[1][:190]) for k, v in sorted(res.items())]
print(bench(f'print("RES", "{e} is at", frappe.db.get_value("Order Bag","{e}","location"), "| transfers recorded:", frappe.db.count("Order Bag Transfer", {{"order_bag": "{e}"}}))'))
