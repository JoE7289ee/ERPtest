import sys, json; sys.path.insert(0,'.')
from jw import *
sh, low, ni, fe, an = User("sheeja@jd.in"), User("lenusthomas@jd.in"), User("nimaks@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in")
A = "E7617.19.1"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","is_finished","act_gross_weight","act_nett_weight","act_dmd_weight","bucket","held_by","huid","certifications","in_stock_on"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
print(bins(("18KYG", "In Bags - JD"), ("18KYG", "Finished Goods - JD"), ("VVS-EF 2-2.5", "In Bags - JD"), ("VVS-EF 2-2.5", "Finished Goods - JD")))
step("make product without a bucket (must refuse)", lambda: ni.call("make_products", bags=[A]), expect_refuse=True)
guarded("make the product into bucket FEMI", low, ni, "make_products", bags=[A], bucket="FEMI")
print(card()); print(bins(("18KYG", "In Bags - JD"), ("18KYG", "Finished Goods - JD"), ("VVS-EF 2-2.5", "In Bags - JD"), ("VVS-EF 2-2.5", "Finished Goods - JD")))
step("make the same product twice (must refuse)", lambda: ni.call("make_products", bags=[A], bucket="FEMI"), expect_refuse=True)
step("issue stones to a finished piece (must refuse)", lambda: User("smitha@jd.in").call("stone_issue_apply", order_bag=A, lines=[{"item": "VVS-EF 2-2.5", "pcs": 1, "ct": 0.009}], issued_by="HR-EMP-00099"), expect_refuse=True)
step("transfer a finished piece on the floor page (must refuse)", lambda: (lambda r: (_ for _ in ()).throw(Refused(200, str(r["errors"]))) if r.get("errors") else r)(sh.call("transfer_order_bags", names=[A], to_location="SETTING")), expect_refuse=True)
print("my bucket (femi):", json.dumps(fe.call("get_my_bucket"), default=str)[:300])
guarded("move the piece to bucket SUMI", low, fe, "transfer_bucket", bags=[A], to_bucket="SUMI")
guarded("move the hold to JD Stock", low, fe, "transfer_holder", bags=[A], to_customer="JD Stock", reason="test")
print(card())
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain9.json", "w"), indent=1)
