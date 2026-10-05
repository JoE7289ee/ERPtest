import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","certifications"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
ctx = fe.call("get_cert_prep_context"); print("types:", [(t["name"]) for t in ctx["types"]], "| keys", list(ctx.keys()))
print(json.dumps(ctx, default=str)[:900])
r = step("draft-scan the piece for IGI", lambda: fe.call("cert_draft_scan", cert_type="IGI", quality="VVS-EF", barcode=A, existing=[]))
print(json.dumps(r, default=str)[:500])
step("draft-scan a card still on the floor (must refuse)", lambda: fe.call("cert_draft_scan", cert_type="IGI", quality="VVS-EF", barcode="E7617.2.1", existing=[]), expect_refuse=True)
centers = [c for c in ctx.get("centers", []) if c.get("certification_type") == "IGI"] or ctx.get("centers", [])
print("centers:", centers[:3])
json.dump({"ctx": ctx}, open("certctx.json", "w"), default=str, indent=1)
