import sys, json; sys.path.insert(0,'.')
from jw import *
low, sh, ni, jo, re_, ba = User("lenusthomas@jd.in"), User("sheeja@jd.in"), User("nimaks@jd.in"), User("jojokk@jd.in"), User("reena@jd.in"), User("balans@jd.in")
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:260])) if isinstance(r, dict) and r.get("errors") and not (r.get("done") or r.get("count") or r.get("transferred")) else r
def card(c): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","qty","split_of","piece_no","act_gross_weight","act_nett_weight","act_dmd_no","act_dmd_weight"],as_dict=True); print("RES", dict(b) if b else None)')[0]
jo_no = step("Reena places an order header", lambda: re_.call("create_job_order", payload={"customer": "AJ-KUR-TCR-KL", "order_type": "CUSTOMER", "due_date": "2026-10-25"}))
print("order:", jo_no)
bag = step("Reena adds a 3-piece card", lambda: re_.call("create_order_bag", payload={"job_order": jo_no, "design": "A13010NP-18EF-Y", "qty": 3, "size": "NA"}))
print("bag:", json.dumps(bag, default=str)[:300])
M = bag if isinstance(bag, str) else (bag or {}).get("name")
print(M, card(M))
soft(sh.call("transfer_order_bags", names=[M], to_location="WAX SETTING"))
sh.call("mark_stone_issue", bags=[M])
c = ba.call("get_stone_issue_card", barcode=M); print("plan:", [(l["item"], l["plan_pcs"], l["plan_ct"]) for l in c["lines"]])
step("issue the full plan for 3 pieces", lambda: ba.call("stone_issue_apply", order_bag=M, lines=[{"item": l["item"], "pcs": l["plan_pcs"], "ct": l["plan_ct"]} for l in c["lines"]]).get("fully_issued"))
soft(sh.call("transfer_order_bags", names=[M], to_location="TREE MAKING"))
t = step("make a tree", lambda: sh.call("make_tree", karat="18KYG", names=[M], employee="HR-EMP-00107", wax_weight=5.2)); T = t["tree"]
jo.call("save_casting_report", tree=T, casting_wt=12, casted_tree_wt=11.9, cutting_bal=4.0, prod_wt=7.9, dust_wt=0.05); jo.call("complete_casting_report", tree=T)
step("book the cast weight 7.800 g for the 3-piece card", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": M, "gross": 7.8}]).get("total_gold"))
soft(sh.call("transfer_order_bags", names=[M], to_location="BAG EXTRACTION"))
print(card(M))
step("make a product out of a 3-piece card (must refuse - split first)", lambda: soft(ni.call("make_products", bags=[M], bucket="FEMI")), expect_refuse=True)
g = ni.call("get_bag_for_split", order_bag=M); print("split view:", json.dumps(g, default=str)[:900])
json.dump({"M": M, "T": T, "split": g, "LOG": LOG, "GAPS": GAPS}, open("chain17.json", "w"), indent=1, default=str)
