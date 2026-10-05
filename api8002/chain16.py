import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh, ni = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in"), User("nimaks@jd.in")
A = "E7617.19.1"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","is_finished","qty","act_nett_weight"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:260])) if isinstance(r, dict) and (r.get("errors") or r.get("failed") or r.get("rejected")) and not (r.get("done") or r.get("count") or r.get("moved")) else r
print("== after the sale")
step("sell the sold piece again (must refuse)", lambda: an.call("get_sale_piece", barcode=A, price_chart="PCH-0067"), expect_refuse=True)
step("rework a sold piece (must refuse)", lambda: soft(an.call("rework_pieces", order_bags=[A], to_location="REWORK")), expect_refuse=True)
step("hallmark a sold piece (must refuse)", lambda: soft(fe.call("hall_draft_scan", barcode=A, existing=[])), expect_refuse=True)
step("move a sold piece to another bucket (must refuse)", lambda: soft(fe.call("transfer_bucket", bags=[A], to_bucket="FEMI")), expect_refuse=True)
step("change the hold of a sold piece (must refuse)", lambda: soft(fe.call("transfer_holder", bags=[A], to_customer="JD Stock", reason="x")), expect_refuse=True)
print(card())
print("sales history:", json.dumps(an.call("get_sales_history"), default=str)[:500])
print("== rework")
C = json.loads(bench('print("RES", json.dumps(frappe.get_all("Order Bag", filters={"is_finished":1,"stock_status":"In Stock","location":"SUMI"}, pluck="name", limit=2)))')[0])[0]
print("piece:", C, card(C)); print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "In Bags - JD"), ("18KWG", "Finished Goods - JD"), ("18KWG", "In Bags - JD")))
print("rework piece:", json.dumps(fe.call("get_rework_piece", barcode=C), default=str)[:400])
guarded("send the finished piece back to REWORK", low, fe, "rework_pieces", order_bags=[C], to_location="REWORK", remarks="t8002 test")
print(card(C)); print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "In Bags - JD"), ("18KWG", "Finished Goods - JD"), ("18KWG", "In Bags - JD")))
print("bench card:", json.dumps(sh.call("get_bench_card", order_bag=C), default=str)[:300])
json.dump({"LOG": LOG, "GAPS": GAPS, "C": C}, open("chain16.json", "w"), indent=1, default=str)
