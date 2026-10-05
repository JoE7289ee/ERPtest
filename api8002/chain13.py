import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","certifications"],as_dict=True); print("RES", dict(b))')[0]
chk = lambda x: (_ for _ in ()).throw(Refused(200, json.dumps(x)[:200])) if not x.get("saved") else x
step("confirm with a 3-letter HUID (must refuse)", lambda: chk(fe.call("huid_confirm_batch", changes=[{"order_bag": A, "huid": "AB1", "mode": "accept"}])), expect_refuse=True)
step("confirm with a card number as the HUID (must refuse)", lambda: chk(fe.call("huid_confirm_batch", changes=[{"order_bag": A, "huid": "E7617.2.1", "mode": "accept"}])), expect_refuse=True)
step("confirm with a HUID another piece already carries (MKJHUY) (should refuse?)", lambda: chk(fe.call("huid_confirm_batch", changes=[{"order_bag": A, "huid": "MKJHUY", "mode": "accept"}])), expect_refuse=True)
print(card())
r = step("confirm HUID AB12CD", lambda: chk(fe.call("huid_confirm_batch", changes=[{"order_bag": A, "huid": "AB12CD", "mode": "accept"}]))); print(json.dumps(r, default=str)[:300])
print(card())
print(bench('print("RES dup huid", frappe.db.sql("select huid, count(*), group_concat(name) from `tabOrder Bag` where ifnull(huid,\\"\\")!=\\"\\" group by huid having count(*)>1"))'))
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain13.json", "w"), indent=1)
