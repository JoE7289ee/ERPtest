import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"; CHART = "PCH-0067"; BUYER = "AJ-KUR-TCR-KL"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","is_finished"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
def payload(u, bag, fill=0):
    p = u.call("get_sale_piece", barcode=bag, price_chart=CHART, gold_rate=9000)
    comps = p.get("components") or {}
    for k, c in comps.items():
        if c.get("needs_price"): c["value"] = fill; c["manual"] = 1
    v = lambda keys: sum(float((comps.get(k) or {}).get("value") or 0) for k in keys)
    ck = [k for k in comps if k in ("hall", "cert") or k.startswith("cert:")]
    line = {"order_bag": p["order_bag"], "design": p["design"], "design_no": p.get("design_no"), "design_type": p["design_type"], "held_by": p["held_by"],
        "nett": p["nett"], "dmd_ct": p["dmd_ct"], "ostone_ct": p["ostone_ct"], "gold_value": v(["gold"]), "diamond_value": v(["dmd", "pdmd"]),
        "stone_value": v(["cs", "cz", "cvd", "sw", "ps", "poth"]), "labour_value": v(["making"]), "charges_value": v(ck), "components": comps}
    return {"customer": BUYER, "price_chart": CHART, "gold_rate": 9000, "remarks": "t8002 test", "lines": [line], "adjustments": [], "prep": None, "tax_percent": 3}
# another finished piece for the wrong-person attempts
others = bench('print("RES", json.dumps(frappe.get_all("Order Bag", filters={"is_finished":1,"stock_status":"In Stock","location":["in",["JISMY","SUMI"]],"name":["!=","E7617.19.1"]}, pluck="name", limit=3)))')[0]
B = json.loads(others)[0]; print("other piece:", B, card(B))
print(bins(("18KYG", "Finished Goods - JD")))
pb = payload(an, B)
step("design-bank-only user SELLS a piece (must refuse)", lambda: low.call("create_product_sale", payload=pb), expect_refuse=True)
print(card(B))
step("delivery desk SELLS (prepare-only - must refuse)", lambda: fe.call("create_product_sale", payload=payload(an, A)), expect_refuse=True)
pa = payload(an, A, fill=0)
bad = json.loads(json.dumps(pa)); bad["lines"][0]["gold_value"] = 1; bad["lines"][0]["components"]["gold"]["value"] = 1
r = step("manager sells with the gold value edited down to Rs 1 (does the server re-price?)", lambda: an.call("create_product_sale", payload=bad))
print(json.dumps(r, default=str)[:400]); print(card()); print(bins(("18KYG", "Finished Goods - JD")))
json.dump({"LOG": LOG, "GAPS": GAPS, "sale": r}, open("chain15.json", "w"), indent=1, default=str)
