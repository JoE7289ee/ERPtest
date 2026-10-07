import sys, json; sys.path.insert(0,'.')
from jw import *
re_, sh, ba, ni, fe, an, jo = User("reena@jd.in"), User("sheeja@jd.in"), User("balans@jd.in"), User("nimaks@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("jojokk@jd.in")
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:200])) if isinstance(r, dict) and (r.get("errors") or r.get("error") or r.get("rejected")) and not (r.get("done") or r.get("count") or r.get("transferred") or r.get("marked")) else r
EMP = "HR-EMP-00059"
o = step("Reena: order", lambda: re_.call("create_job_order", payload={"customer": "AJ-KUR-TCR-KL", "order_type": "CUSTOMER", "due_date": "2026-10-30"}))
c = step("Reena: card", lambda: re_.call("create_order_bag", payload={"job_order": o, "design": "A13010NP-18EF-Y", "qty": 1, "size": "NA"}))
step("Jojo: buy gold", lambda: jo.call("post_raw_material_purchase", supplier="JD Stock", warehouse="Gold Issue - JD", voucher_type="SIN", items=[{"item": "Standard Gold 999", "weight": 5, "count": 0}]).get("name"))
step("Sheeja: ORDERING -> WAXING", lambda: soft(sh.call("transfer_order_bags", names=[c], to_location="WAXING")))
step("Sheeja: assign", lambda: soft(sh.call("assign_bench_cards", names=[c], location="WAXING", employee="HR-EMP-00094")))
step("Sheeja: collect", lambda: soft(sh.call("collect_bench_cards", names=[c], location="WAXING", employee="HR-EMP-00094")))
step("Sheeja: -> WAX SETTING + request stones", lambda: (soft(sh.call("transfer_order_bags", names=[c], to_location="WAX SETTING")), soft(sh.call("mark_stone_issue", bags=[c])))[1])
k = ba.call("get_stone_issue_card", barcode=c)
step("Balan: issue stones", lambda: ba.call("stone_issue_apply", order_bag=c, lines=[{"item": l["item"], "pcs": l["plan_pcs"], "ct": l["plan_ct"]} for l in k["lines"]]).get("fully_issued"))
step("Sheeja: -> TREE MAKING, tree", lambda: (soft(sh.call("transfer_order_bags", names=[c], to_location="TREE MAKING")), sh.call("make_tree", karat="18KYG", names=[c], employee="HR-EMP-00107", wax_weight=3.3))[1]["tree"])
T = bench(f'print("RES", frappe.db.get_value("Order Bag", "{c}", "tree"))')[0].strip()
step("Sheeja: casting report", lambda: (sh.call("save_casting_report", tree=T, casting_wt=10, casted_tree_wt=9.9, cutting_bal=7.3, prod_wt=2.6, dust_wt=0.05), sh.call("complete_casting_report", tree=T))[1].get("report_done"))
step("Sheeja: weigh", lambda: sh.call("cast_weigh", tree=T, entries=[{"order_bag": c, "gross": 2.6}]).get("total_gold"))
step("Sheeja: -> GRINDING, issue, receipt", lambda: (soft(sh.call("transfer_order_bags", names=[c], to_location="GRINDING")), soft(sh.call("issue_bench_cards", names=[c], location="GRINDING", employee=EMP)), soft(sh.call("receipt_bench_cards", lines=[{"order_bag": c, "weight_in": 2.55}], location="GRINDING", employee=EMP)))[2].get("total_loss"))
step("Sheeja: -> BAG EXTRACTION", lambda: soft(sh.call("transfer_order_bags", names=[c], to_location="BAG EXTRACTION")))
step("Nima: make product", lambda: soft(ni.call("make_products", bags=[c], bucket="FEMI")))
step("Femi: bucket + holder", lambda: (soft(fe.call("transfer_bucket", bags=[c], to_bucket="SUMI")), fe.call("transfer_holder", bags=[c], to_customer="JD Stock", reason="t"))[1].get("count"))
b = step("Femi: cert prep/send/collect/confirm", lambda: (lambda n: (fe.call("send_cert_prep", name=n), fe.call("collect_certification", name=n), fe.call("confirm_cert_batch", changes=[{"bag": c, "mode": "accept"}]))[2].get("saved"))(fe.call("cert_prep_create_full", cert_type="IGI", center="IGI-IGI Thrissur", quality="VVS-EF", bags=[c])["name"]))
step("Femi: hallmark prep/send/collect/HUID", lambda: (lambda n: (fe.call("send_hall_prep", name=n, center="GOLD MARK"), fe.call("collect_hallmarking", name=n), fe.call("huid_confirm_batch", changes=[{"order_bag": c, "huid": "ZX98YW", "mode": "accept"}]))[2].get("saved"))(fe.call("hall_prep_create", bags=[c])["name"]))
step("Femi: price the piece on Sell (prepare)", lambda: fe.call("get_sale_piece", barcode=c, price_chart="PCH-0067", gold_rate=9000).get("diamond_value"))
step("Femi: complete the sale (must refuse)", lambda: fe.call("create_product_sale", payload={"customer": "AJ-KUR-TCR-KL", "lines": []}), expect_refuse=True)
p = an.call("get_sale_piece", barcode=c, price_chart="PCH-0067", gold_rate=9000); comps = p["components"]
for kk, cc in comps.items():
    if cc.get("needs_price"): cc["value"] = 0
v = lambda keys: sum(float((comps.get(x) or {}).get("value") or 0) for x in keys)
line = {"order_bag": c, "design": p["design"], "design_type": p["design_type"], "held_by": p["held_by"], "nett": p["nett"], "dmd_ct": p["dmd_ct"], "ostone_ct": p["ostone_ct"], "gold_value": v(["gold"]), "diamond_value": v(["dmd"]), "stone_value": 0, "labour_value": v(["making"]), "charges_value": 0, "components": comps}
step("Antony: sell", lambda: an.call("create_product_sale", payload={"customer": "AJ-KUR-TCR-KL", "price_chart": "PCH-0067", "gold_rate": 9000, "lines": [line], "adjustments": [], "tax_percent": 3}).get("name"))
fails = [l for l in LOG if not l["ok"]]; print("FAILED STEPS:", len(fails), [f["step"] + " :: " + f["note"][:90] for f in fails])
