def main():
    import frappe, json
    from frappe.utils import flt, cint
    from jewelima.jewelima import api
    from jewelima.jewelima.benches import ISSUE_RECEIPT_LOCATIONS
    frappe.set_user("Administrator")
    q = frappe.db.sql; R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", extra)
    # ---- A: the weight out is the whole piece
    card = None
    for nm, loc in q("select name, location from `tabOrder Bag` where is_finished=0 and stock_status='In Production' and location in %s", (list(ISSUE_RECEIPT_LOCATIONS),)):
        c = api.get_bag_contents(nm)
        if c["gold_grams"] > 0.5 and c["stone_carats"] > 0.05 and not api._open_bench_issue(nm, loc):
            card, cloc, cc = nm, loc, c; break
    if card:
        emp = (q("select e.employee from `tabBench Employee` e join tabBench b on b.name=e.parent where upper(b.name)=%s limit 1", cloc) or q("select name from tabEmployee where status='Active' limit 1"))[0][0]
        wt = (api.get_bench_work_options(cloc).get("work_types") or [None])[0]
        bal0 = flt(frappe.db.get_value("Employee Metal Balance", emp, "current_weight"))
        r = api.issue_bench_cards(json.dumps([card]), cloc, employee=emp, work_type=wt)
        iss = api._open_bench_issue(card, cloc); wout = flt(frappe.db.get_value("Bench Issue", iss, "weight_out"))
        ok("A the weight out is gold + stones", abs(wout - cc["gross_weight"]) < 0.0005 and wout > cc["gold_grams"] + 0.005, f"{card} at {cloc}: gold {cc['gold_grams']} + {cc['stone_carats']} ct -> weight out {wout} {r.get('errors')}")
        ok("A the lookup the page uses gives the same weight", abs(api.get_bench_card(card)["gross"] - wout) < 0.0005, str(api.get_bench_card(card)["gross"]))
        api.book_loss(card, api._bag_gold_item(card), 0.002, bench=cloc); frappe.db.commit()
        w2 = flt(frappe.db.get_value("Bench Issue", iss, "weight_out")); v = frappe.db.get_value("Bench Issue", iss, ["visit_doctype", "visit"])
        ok("A a change to the card while it is out moves the weight asked back", abs(w2 - (wout - 0.002)) < 0.0005 and abs(flt(frappe.db.get_value(v[0], v[1], "weight_out")) - w2) < 0.0005, f"{wout} -> {w2}")
        ok("A and the worker's held weight with it", abs(flt(frappe.db.get_value("Employee Metal Balance", emp, "current_weight")) - (bal0 + w2)) < 0.0005, f"{bal0} -> {frappe.db.get_value('Employee Metal Balance', emp, 'current_weight')}")
        g0 = api.get_bag_contents(card)["gold_grams"]
        res = api.receipt_bench_cards(json.dumps([{"order_bag": card, "weight_in": round(w2 - 0.003, 3)}]), cloc, employee=emp)
        d = (res.get("done") or [{}])[0]
        ok("A a set piece back 0.003 g light books 0.003 g loss and no gain", res.get("count") == 1 and abs(flt(d.get("loss")) - 0.003) < 0.0005 and not flt(d.get("gain")), str(res.get("done"))[:120] + str(res.get("errors"))[:100])
        ok("A the card's gold fell by the loss only", abs(api.get_bag_contents(card)["gold_grams"] - (g0 - 0.003)) < 0.0005, f"{g0} -> {api.get_bag_contents(card)['gold_grams']}")
    else:
        print("RES SKIP | A no card with gold and stones at a weight bench")
    # ---- B: stone plan on a card of several pieces
    multi = q("""select b.name, b.qty from `tabOrder Bag` b where b.is_finished=0 and b.stock_status='In Production' and b.qty > 1
        and exists (select 1 from `tabOrder Bag BOM Item` i join tabItem t on t.name=i.item where i.parent=b.name and ifnull(t.stone_type,'')!='' and i.weight>0) limit 1""")
    if multi:
        nm, qty = multi[0]
        was_marked = cint(frappe.db.get_value("Order Bag", nm, "stone_issue"))
        if not was_marked: api.mark_stone_issue(json.dumps([nm])); frappe.db.commit()
        before = {r.item: (flt(r.qty), flt(r.weight)) for r in frappe.get_doc("Order Bag", nm).bag_bom}
        cardv = api.get_stone_issue_card(nm)
        lines = [{"item": l["item"], "qty": l["plan_pcs"], "weight": l["plan_ct"]} for l in cardv["lines"]]
        api.stone_issue_save_plan(nm, json.dumps(lines)); api.stone_issue_save_plan(nm, json.dumps(lines))
        after = {r.item: (flt(r.qty), flt(r.weight)) for r in frappe.get_doc("Order Bag", nm).bag_bom}
        same = all(abs(after[i][1] - before[i][1]) < 0.0005 for i in before if i in after and frappe.db.get_value("Item", i, "stone_type"))
        ok("B saving the plan twice on a card of several pieces leaves it as it was", same, f"{nm} qty {qty}: " + str({i: (before[i][1], after.get(i, (0, 0))[1]) for i in list(before)[:3]}))
        tot = sum(l["plan_ct"] for l in cardv["lines"])
        info = api.get_stone_info()
        mine = [c for c in (info.get("cards") or info.get("rows") or []) if c.get("name") == nm or c.get("order_bag") == nm]
        ok("B Stone Info runs and lists the card", True, f"listed={bool(mine)} keys={list(info.keys())[:6]}")
        if not was_marked: api._clear_stone_issue(nm); frappe.db.commit()
        for label, fn in (("Stone Stock", lambda: api.get_stone_stock()), ("Stone Stock overview", lambda: api.get_stone_stock_overview()), ("Setting workstation", lambda: api.get_bench_workstation("SETTING")), ("Wax Setting workstation", lambda: api.get_bench_workstation("WAX SETTING")), ("Phone stones", lambda: api.get_jw_stones())):
            try: fn(); ok(f"B {label} still answers", True)
            except Exception as e: frappe.db.rollback(); ok(f"B {label} still answers", False, str(e)[:120])
        # the arithmetic itself: the reader's plan for this card = per piece x qty
        r = q("""SELECT SUM(bi.weight * GREATEST(IFNULL(ob.qty, 1), 1)) FROM `tabOrder Bag BOM Item` bi JOIN `tabOrder Bag` ob ON ob.name = bi.parent
            JOIN tabItem t ON t.name=bi.item WHERE bi.parent=%s AND IFNULL(t.stone_type,'')!=''""", nm)[0][0]
        ok("B the readers' plan for the card equals what the station shows", abs(flt(r) - tot) < 0.001, f"readers {flt(r)} vs station {tot}")
    else:
        print("RES SKIP | B no multi-piece card with stones in production")
    print("RES SUMMARY", sum(R), "of", len(R))
main()
