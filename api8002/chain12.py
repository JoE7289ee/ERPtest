import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"; CB = "IGI-0005"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","certifications"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
r = guarded("CONFIRM the certificate", low, fe, "confirm_cert_batch", changes=[{"bag": A, "mode": "accept"}])
print(json.dumps(r, default=str)[:400]); print(card())
# hallmark
hc = fe.call("get_hall_prep_context"); print("hall ctx:", json.dumps(hc, default=str)[:300])
r = step("hallmark draft-scan", lambda: fe.call("hall_draft_scan", barcode=A, existing=[])); print(json.dumps(r, default=str)[:300])
hb = guarded("PREP the hallmark batch", low, fe, "hall_prep_create", center=None, bags=[A]); hname = (hb or {}).get("name") if isinstance(hb, dict) else hb
print("hall batch:", hname)
step("SEND without a centre (must refuse)", lambda: fe.call("send_hall_prep", name=hname), expect_refuse=True)
guarded("SEND the hallmark batch to GOLD MARK", low, fe, "send_hall_prep", name=hname, center="GOLD MARK")
print(card()); print(bins(("18KYG", "Finished Goods - JD"), ("18KYG", "At Hallmarking - JD")))
guarded("COLLECT the hallmark batch", low, fe, "collect_hallmarking", name=hname)
step("confirm with a 5-letter HUID (must refuse)", lambda: (lambda x: (_ for _ in ()).throw(Refused(200, json.dumps(x)[:200])) if (x.get("refused") or not x.get("saved")) else x)(fe.call("huid_confirm_batch", changes=[{"bag": A, "huid": "ABC12", "mode": "accept"}])), expect_refuse=True)
r = guarded("confirm HUID AB12CD", low, fe, "huid_confirm_batch", changes=[{"bag": A, "huid": "AB12CD", "mode": "accept"}]); print(json.dumps(r, default=str)[:300])
print(card())
json.dump({"LOG": LOG, "GAPS": GAPS, "hall": hname}, open("chain12.json", "w"), indent=1)
