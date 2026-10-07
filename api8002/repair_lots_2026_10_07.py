def main():
    import frappe, json
    from frappe.utils import flt, cint
    from jewelima.jewelima import api, repair_api as rp, design_bank_api as dba
    from jewelima.jewelima.doctype.repair_bill.repair_bill import rate_for_karat
    q = frappe.db.sql; R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", str(extra)[:190])
    frappe.set_user("Administrator")
    dt = frappe.get_all("Design Type", pluck="name", limit=1)[0]
    for l in frappe.get_all("Stone Lot", filters=[["remarks", "=", "ZZT"]], pluck="name") + frappe.get_all("Stone Lot", filters={"name": ["in", ["LOT-JD-00019", "LOT-JD-00020", "LOT-JD-00021", "LOT-JD-00022", "LOT-JD-00023", "LOT-JD-00024"]]}, pluck="name"):
        for r in frappe.get_all("Stone Purchase Request", filters={"stone_lot": l}, pluck="name"): frappe.delete_doc("Stone Purchase Request", r, force=True, ignore_permissions=True)
        frappe.delete_doc("Stone Lot", l, force=True, ignore_permissions=True)
    for o in frappe.get_all("Repair Order", filters={"party": ["like", "ZZT PARTY %"]}, pluck="name"):
        for b in frappe.get_all("Repair Bill", filters={"repair_order": o}, pluck="name"): frappe.delete_doc("Repair Bill", b, force=True, ignore_permissions=True)
        frappe.delete_doc("Repair Order", o, force=True, ignore_permissions=True)
    for dtn, pat in (("Repair Work Type", "ZZT %"), ("Repair Work Type", "NEVER HEARD OF %"), ("Repair Party", "ZZT PARTY %")):
        for w in frappe.get_all(dtn, filters={"name": ["like", pat]}, pluck="name"): frappe.delete_doc(dtn, w, force=True, ignore_permissions=True)
    frappe.db.commit()
    tag = frappe.generate_hash(length=5).upper()
    # ---- a renamed type of work goes with the pieces that carry it
    old, new = "ZZT SOLDRING " + tag, "ZZT SOLDERING " + tag
    party = "ZZT PARTY " + tag
    o = rp.create_repair_order(json.dumps({"party": party, "items": [
        {"design_type": dt, "qty": 1, "weight": 10, "karat": "18", "work_types": [old]},
        {"design_type": dt, "qty": 1, "weight": 5, "karat": "18", "work_types": [old, "ZZT POLISH " + tag]},
        {"design_type": dt, "qty": 1, "weight": 4, "karat": "18", "work_types": []}]}))
    name = o["name"]; ids = [i["repair"] for i in o["items"]]
    rp.set_piece_work_types(name, ids[0], json.dumps([{"work_type": old, "qty": 2}]))
    rp.set_repair_work_type(old, work_name=new)
    doc = frappe.get_doc("Repair Order", name)
    ok("a rename is written onto the pieces", all(old not in (r.work_types or "") for r in doc.items) and new in (doc.items[0].work_types or "") and new in (doc.items[1].work_types or ""), [r.work_types for r in doc.items])
    ok("and onto the counted work lines", [l.work_type for l in doc.work_lines if l.repair == ids[0]] == [new], [(l.repair, l.work_type, l.qty) for l in doc.work_lines])
    try:
        r = rp.save_repair_weights(name, json.dumps([{"repair": ids[0], "weight_out": 10.5, "karat": "18"}]))
        ok("the batch can still be weighed out after the rename", r["saved"] >= 1, r["saved"])
    except Exception as e:
        frappe.db.rollback(); ok("the batch can still be weighed out after the rename", False, str(e))
    try:
        rp.set_repair_work_type(new, work_name="ZZT POLISH " + tag); ok("a rename onto a name that exists is refused", False, "went through")
    except Exception as e:
        frappe.db.rollback(); ok("a rename onto a name that exists is refused", "already" in str(e), str(e))
    # a name whose master has gone no longer locks the batch
    frappe.db.set_value("Repair Order Item", {"parent": name, "repair": ids[2]}, "work_types", "GONE WORK " + tag); frappe.db.commit()
    try:
        r = rp.save_repair_weights(name, json.dumps([{"repair": ids[1], "weight_out": 5.2, "karat": "18"}]))
        ok("a piece carrying a work name that no longer exists does not lock the batch", r["saved"] >= 1, r["saved"])
    except Exception as e:
        frappe.db.rollback(); ok("a piece carrying a work name that no longer exists does not lock the batch", False, str(e))
    try:
        rp.update_repair_order(name, json.dumps([{"repair": ids[2], "work_types": ["NEVER HEARD OF " + tag + " ???"]}])); x = frappe.db.get_value("Repair Order Item", {"parent": name, "repair": ids[2]}, "work_types")
        ok("a new name typed on the edit screen still becomes a real type of work", frappe.db.exists("Repair Work Type", x), x)
    except Exception as e:
        frappe.db.rollback(); ok("a new name typed on the edit screen still becomes a real type of work", False, str(e))
    # ---- a part-billed batch is still with us
    def status(state):
        return {r["name"]: r for r in rp.get_repair_status(party=party, state=state)["rows"]}
    b1 = rp.save_repair_bill(json.dumps({"repair_order": name, "gold_rate": 10300, "gst_percent": 3,
        "items": [{"repair": ids[0], "weight_out": 10.5, "karat": "22", "manual_amount": -200}],
        "charges": [{"work_type": new, "pieces": 2, "rate": 150}]}))
    it = [i for i in b1["items"] if i["repair"] == ids[0]][0]
    want = round(rate_for_karat(10300, "22"), 2)
    ok("the bill is priced with the purity on the screen, not the stored one", str(it.get("karat")) == "22" and abs(flt(it.get("gold_rate_used")) - want) < 0.01, f"karat {it.get('karat')} rate {it.get('gold_rate_used')} want {want}")
    ok("and the piece is stamped with that purity", frappe.db.get_value("Repair Order Item", {"parent": name, "repair": ids[0]}, "karat") == "22", frappe.db.get_value("Repair Order Item", {"parent": name, "repair": ids[0]}, "karat"))
    ok("the manual amount is on the bill", abs(flt(it.get("manual_amount")) + 200) < 0.01, it.get("manual_amount"))
    so, sb, sa = status("open"), status("billed"), status("all")
    ok("a batch with 1 of 3 pieces billed is still 'with us'", name in so and name not in sb and so[name]["bill"] is None and so[name]["open_rows"] == 2 and so[name]["billed_rows"] == 1, {k: so.get(name, {}).get(k) for k in ("bill", "open_rows", "billed_rows")})
    ok("and it says which bill it has so far", [b["name"] for b in sa[name]["bills"]] == [b1["name"]], sa[name]["bills"])
    b2 = rp.save_repair_bill(json.dumps({"repair_order": name, "gold_rate": 10300, "gst_percent": 3,
        "items": [{"repair": ids[1], "weight_out": 5.2, "karat": "18"}, {"repair": ids[2], "weight_out": 4, "karat": "18"}],
        "charges": [{"work_type": new, "pieces": 1, "rate": 150}]}))
    so, sb = status("open"), status("billed")
    tot = round(sum(flt(frappe.db.get_value("Repair Bill", b, "total_charges")) for b in (b1["name"], b2["name"])), 2)
    ok("once every piece is billed the batch is 'billed', with both bills added up", name in sb and name not in so and len(sb[name]["bills"]) == 2 and abs(sb[name]["charges"] - tot) < 0.01 and sb[name]["bill"] == b2["name"], f"bills {[b['name'] for b in sb.get(name, {}).get('bills', [])]} charges {sb.get(name, {}).get('charges')} want {tot}")
    # ---- quick check borrows only this party's rates
    c0 = rp.get_quick_check_context()
    ok("Quick Check with no party picked borrows nobody's rates", not c0["from_bill"] and not c0["work_rates"] and not flt(c0["gold_rate"]), {k: c0[k] for k in ("from_bill", "gold_rate", "work_rates")})
    c1 = rp.get_quick_check_context(party=party)
    ok("with a party it reads that party's last bill", c1["from_bill"] == b2["name"] and flt(c1["gold_rate"]) == 10300, {k: c1[k] for k in ("from_bill", "gold_rate")})
    # ---- stone lot: closing empties the tray
    sup = frappe.get_all("Supplier", pluck="name", limit=1)[0]
    sv = frappe.get_all("Diamond Sieve", pluck="sieve_size", limit=2)
    ql = sorted(api._stocked_diamond_qualities())[0]
    lot = api.create_stone_lot(sup, quality=ql, remarks="ZZT", claimed_cts=60)["name"]
    L = api.save_stone_lot_selection(lot, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 40}]))
    made = api.close_stone_lot_request(lot)
    api.decide_stone_purchase_request(made["purchase"], "Rejected")
    row = frappe.get_all("Stone Lot Sieve", filters={"parent": lot}, fields=["sieve", "actual_cts", "selected_cts", "returned_cts", "purchased_cts"])
    ok("(setup) the rejected purchase put its 40 ct back on the tray", flt(row[0].actual_cts) == 60 and flt(row[0].selected_cts) == 40, row)
    api.decide_stone_purchase_request(made["close"], "Approved")
    row = frappe.get_all("Stone Lot Sieve", filters={"parent": lot}, fields=["sieve", "actual_cts", "selected_cts", "returned_cts", "purchased_cts"])
    d = frappe.get_doc("Stone Lot", lot); req = frappe.get_doc("Stone Purchase Request", made["close"])
    ok("closing after a rejected purchase sends the whole tray back", d.status == "Closed" and flt(row[0].actual_cts) == 0 and flt(row[0].selected_cts) == 0 and flt(row[0].returned_cts) == 60 and flt(row[0].purchased_cts) == 0, f"{d.status} {dict(row[0])}")
    ok("and the close request records what went back", [(r.sieve, flt(r.cts)) for r in req.items] == [(sv[0], 60.0)] and flt(req.total_cts) == 60, [(r.sieve, flt(r.cts)) for r in req.items])
    ok("nothing of the parcel is left unaccounted", api._lot_unassorted(d) == 0 and flt(d.selected_cts) == 0, f"left {api._lot_unassorted(d)} selected {d.selected_cts}")
    # a lot with a part bought and the rest returned
    lot2 = api.create_stone_lot(sup, quality=ql, remarks="ZZT", claimed_cts=100)["name"]
    api.save_stone_lot_selection(lot2, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 40}, {"sieve": sv[1], "actual": 30, "selected": 0}]))
    made2 = api.close_stone_lot_request(lot2)
    api.decide_stone_purchase_request(made2["purchase"], "Approved", post=0)
    api.decide_stone_purchase_request(made2["close"], "Approved")
    rows2 = {r.sieve: r for r in frappe.get_all("Stone Lot Sieve", filters={"parent": lot2}, fields=["sieve", "actual_cts", "selected_cts", "returned_cts", "purchased_cts"])}
    d2 = frappe.get_doc("Stone Lot", lot2)
    ok("the ordinary close is unchanged: 40 bought, 20 + 30 returned, 10 un-assorted returned", flt(rows2[sv[0]].purchased_cts) == 40 and flt(rows2[sv[0]].returned_cts) == 20 and flt(rows2[sv[1]].returned_cts) == 30 and flt(d2.unassorted_returned_cts) == 10 and d2.status == "Closed" and all(flt(r.actual_cts) == 0 for r in rows2.values()), f"{d2.status} un {d2.unassorted_returned_cts} {[(k, flt(v.actual_cts), flt(v.purchased_cts), flt(v.returned_cts)) for k, v in rows2.items()]}")
    # ---- stone lot: a stale screen cannot overwrite the tray
    lot3 = api.create_stone_lot(sup, quality=ql, remarks="ZZT", claimed_cts=80)["name"]
    a = api.save_stone_lot_selection(lot3, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 40}]))
    seen = a["modified"]
    pr = api.create_stone_purchase_request(lot3, json.dumps([{"sieve": sv[0], "cts": 20}]))
    api.decide_stone_purchase_request(pr["name"], "Rejected")
    st = api.save_stone_lot_selection(lot3, rows=json.dumps([{"sieve": sv[0], "actual": 40, "selected": 20}, {"sieve": sv[1], "actual": 5, "selected": 0}]), modified="2020-01-01 00:00:00.000000")
    row = frappe.get_all("Stone Lot Sieve", filters={"parent": lot3}, fields=["sieve", "actual_cts", "selected_cts"])
    ok("a save from a screen that has not seen the latest tray stores nothing", st.get("stale") == 1 and len(row) == 1 and flt(row[0].actual_cts) == 60 and flt(row[0].selected_cts) == 40, f"stale {st.get('stale')} {[dict(r) for r in row]}")
    ok("and is answered with the lot as it stands", st["items"][0]["actual"] == 60 and st["modified"] != seen, st["items"])
    g = api.save_stone_lot_selection(lot3, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 40}, {"sieve": sv[1], "actual": 5, "selected": 0}]), modified=st["modified"])
    ok("a save carrying the current version goes through and hands back the next", not g.get("stale") and len(g["items"]) == 2 and g["modified"] != st["modified"], f"{len(g['items'])} rows")
    g2 = api.save_stone_lot_selection(lot3, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 41}, {"sieve": sv[1], "actual": 5, "selected": 0}]), modified=g["modified"])
    ok("so the next keystroke saves too", not g2.get("stale") and g2["items"][0]["selected"] == 41, g2["items"][0])
    # ---- an imported card with no sieve rows keeps its diamond weight
    c = q("""select b.name from `tabDesign Bank` b where b.status='Pending' and ifnull(b.diamond_weight,0)>0 and ifnull(b.design_type,'')!=''
        and not exists (select 1 from `tabDesign Bank Stone` s where s.parent=b.name) limit 1""")
    if c:
        b = frappe.get_doc("Design Bank", c[0][0]); was = flt(b.diamond_weight)
        dba.review_save(json.dumps({"name": b.name, "design_no": b.design_no, "design_type": b.design_type, "gross_weight": b.gross_weight, "diamond_weight": 0,
            "note": b.note or "", "extra_lines": b.extra_lines or "", "photo": b.photo, "stones": [], "photoupdate": b.photoupdate, "customer_image_needed": b.customer_image_needed, "customer_image_update": b.customer_image_update}))
        now = flt(frappe.db.get_value("Design Bank", b.name, "diamond_weight"))
        ok("a card with no sieve rows keeps its diamond weight when the page sends 0", abs(now - was) < 0.0005, f"{b.design_no}: {was} -> {now}")
    else: print("RES SKIP | no pending card with a weight and no sieve rows")
    # ---- tidy up
    for b in (b1["name"], b2["name"]): frappe.delete_doc("Repair Bill", b, force=True, ignore_permissions=True)
    frappe.delete_doc("Repair Order", name, force=True, ignore_permissions=True)
    for w in frappe.get_all("Repair Work Type", filters={"name": ["like", "%" + tag + "%"]}, pluck="name"): frappe.delete_doc("Repair Work Type", w, force=True, ignore_permissions=True)
    frappe.delete_doc("Repair Party", party, force=True, ignore_permissions=True)
    for l in (lot, lot2, lot3):
        for r in frappe.get_all("Stone Purchase Request", filters={"stone_lot": l}, pluck="name"): frappe.delete_doc("Stone Purchase Request", r, force=True, ignore_permissions=True)
        frappe.delete_doc("Stone Lot", l, force=True, ignore_permissions=True)
    frappe.db.commit()
    print("RES TOTAL", sum(R), "of", len(R), "passed")
main()
