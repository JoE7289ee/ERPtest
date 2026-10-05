import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, re_, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("reena@jd.in"), User("sheeja@jd.in")
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:220])) if isinstance(r, dict) and (r.get("errors") or r.get("error") or r.get("rejected")) and not (r.get("done") or r.get("count")) else r
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
print("== cancellation")
X = "E7619.1.2"   # split piece holding 2.5 g gold + stones, at BAG EXTRACTION
who = [u for u in (re_, an) ]
g = None
for u in (re_, an):
    try: g = u.call("get_cancel_bag", order_bag=X); print(u.email, "can open the cancel desk:", json.dumps(g, default=str)[:500]); break
    except Refused as e: print(u.email, "refused:", e.msg[:80])
print(bins(("18KYG", "In Bags - JD"), ("18KYG", "Gold Issue - JD"), ("18KYG", "Casting - JD"), ("VVS-EF 2-2.5", "In Bags - JD"), ("VVS-EF 2-2.5", "Stone Issue - JD")))
step("cancel a card that holds gold WITHOUT saying where it goes back (must refuse)", lambda: soft(u.call("cancel_order_bag", order_bag=X)), expect_refuse=True)
ret = {m["item"]: m.get("default_warehouse") or m.get("warehouse") for m in (g.get("materials") or g.get("lines") or [])} if g else {}
print("returns:", ret)
r = step("cancel the card, materials back to their shelves", lambda: soft(u.call("cancel_order_bag", order_bag=X, returns=ret)))
print(json.dumps(r, default=str)[:300])
print(bench(f'print("RES", frappe.db.get_value("Order Bag","{X}",["stock_status","location"]), frappe.db.sql("select item, round(sum(case when direction=\'In\' then qty else -qty end),4) from `tabBag Material Ledger` where order_bag=%s group by 1", "{X}"))'))
print(bins(("18KYG", "In Bags - JD"), ("18KYG", "Gold Issue - JD"), ("18KYG", "Casting - JD"), ("VVS-EF 2-2.5", "In Bags - JD"), ("VVS-EF 2-2.5", "Stone Issue - JD")))
step("transfer a cancelled card (must refuse)", lambda: soft(sh.call("transfer_order_bags", names=[X], to_location="SETTING")), expect_refuse=True)
step("make a product from a cancelled card (must refuse)", lambda: soft(User("nimaks@jd.in").call("make_products", bags=[X], bucket="FEMI")), expect_refuse=True)
print("== taking a certificate / hallmark off a piece")
Y = json.loads(bench('print("RES", json.dumps(frappe.db.sql("select name, certifications, huid from `tabOrder Bag` where is_finished=1 and stock_status=\'In Stock\' and ifnull(certifications,\'\')!=\'\' limit 3")))')[0])
print("pieces with tags:", Y)
if Y:
    y, tags, huid = Y[0]; tag = tags.split(",")[0].strip()
    guarded(f"remove the {tag} tag from {y}", low, fe, "remove_certification", barcode=y, tag=tag, reason="t8002 test")
    print(bench(f'print("RES", frappe.db.get_value("Order Bag","{y}",["certifications","huid","stock_status"]))'))
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain20.json", "w"), indent=1, default=str)
