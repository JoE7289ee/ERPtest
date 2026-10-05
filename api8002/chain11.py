import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","certifications"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
r = step("draft-scan the piece for IGI", lambda: fe.call("cert_draft_scan", cert_type="IGI", quality="VVS-EF", barcode=A, existing=[]))
print(json.dumps(r, default=str)[:400])
step("draft-scan the same piece twice (must refuse)", lambda: (lambda x: (_ for _ in ()).throw(Refused(200, str(x))) if (x or {}).get("rejected") else x)(fe.call("cert_draft_scan", cert_type="IGI", quality="VVS-EF", barcode=A, existing=[A])), expect_refuse=True)
step("draft-scan with the wrong quality GH (piece is EF) (must refuse)", lambda: (lambda x: (_ for _ in ()).throw(Refused(200, str(x))) if (x or {}).get("rejected") else x)(fe.call("cert_draft_scan", cert_type="IGI", quality="VS-GH", barcode=A, existing=[])), expect_refuse=True)
b = guarded("PREP the IGI batch", low, fe, "cert_prep_create_full", cert_type="IGI", center="IGI-IGI Thrissur", quality="VVS-EF", bags=[A])
print(json.dumps(b, default=str)[:300]); name = (b or {}).get("name") if isinstance(b, dict) else b
print("batch:", name, card())
print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "At Certification - JD")))
guarded("SEND the batch", low, fe, "send_cert_prep", name=name)
print(card()); print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "At Certification - JD")))
step("sell-scan a piece that is away at certification (must refuse)", lambda: an.call("get_sale_piece", barcode=A, price_chart="PCH-0067"), expect_refuse=True)
guarded("COLLECT the batch", low, fe, "collect_certification", name=name)
print(card()); print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "At Certification - JD")))
pool = fe.call("get_confirm_pool"); mine = [x for x in pool.get("batches", []) if x["name"] == name]
print("confirm pool:", json.dumps(mine, default=str)[:600])
json.dump({"LOG": LOG, "GAPS": GAPS, "batch": name}, open("chain11.json", "w"), indent=1)
