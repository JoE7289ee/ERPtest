def main():
    import frappe, json, traceback
    from frappe.utils import flt, cint
    from jewelima.jewelima import api, repair_api
    import jewelima.guard as guard
    frappe.set_user("Administrator")
    q = frappe.db.sql
    R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", extra)
    def binq(item, wh):
        return flt((q("select sum(actual_qty) from tabBin where item_code=%s and warehouse=%s", (item, wh)) or [[0]])[0][0])
    nled = lambda bag, et=None: q("select count(*) from `tabBag Material Ledger` where order_bag=%s" + (" and entry_type=%s" if et else ""), (bag, et) if et else (bag,))[0][0]
    def step(label, fn):
        try:
            return fn()
        except Exception as e:
            frappe.db.rollback(); print("RES ERROR |", label, "|", frappe.utils.strip_html(str(e))[:260]); R.append(False)
            return None
    IN_BAGS, STONE_WH = api._wh("In Bags"), api._wh("Stone Issue")
    # ---------- T1: a ledger row is not kept when its stock move fails ----------
    def t1():
        cards = [r[0] for r in q("""select name from `tabOrder Bag` where is_finished=0 and stock_status='In Production'
            and location in ('FILING','GRINDING','SETTING','PRE POLISH','FINAL POLISH','BAG EXTRACTION')""")]
        bag = next((c for c in cards if flt(api.get_bag_contents(c)["gold_grams"]) > 0.5), None)
        if not bag: print("RES SKIP | T1 no card holding gold"); return
        loc = frappe.db.get_value("Order Bag", bag, "location"); item = api._bag_gold_item(bag)
        n0 = nled(bag); real = api._stock_move
        def boom(*a, **k): raise Exception("stock move refused (test)")
        api._stock_move = boom; failed = False
        try: api.book_loss(bag, item, 0.010, bench=loc)
        except Exception: failed = True
        finally: api._stock_move = real
        frappe.db.rollback()          # what the request does on an error
        ok("T1 loss row is dropped when its stock move fails", failed and nled(bag) == n0, f"{bag}: rows {n0} -> {nled(bag)}")
        b0 = binq(item, IN_BAGS); api.book_loss(bag, item, 0.001, bench=loc); frappe.db.commit()
        ok("T1 a normal loss writes the row AND moves the stock", nled(bag) == n0 + 1 and abs(binq(item, IN_BAGS) - (b0 - 0.001)) < 0.0005, f"In Bags {b0} -> {binq(item, IN_BAGS)}")
    step("T1", t1)
    # ---------- T2: stone issue on a line with a blank plan ----------
    def t2():
        emp = None
        for e in frappe.get_all("Employee", filters={"status": "Active"}, pluck="name", limit=60):
            try:
                if "CZ" in api._effective_buckets(e): emp = e; break
            except Exception: pass
        cz = q("""select b.item_code, b.actual_qty from tabBin b join tabItem i on i.name=b.item_code
            where b.warehouse=%s and b.actual_qty>2 and i.stone_type='Cubic Zirconia' order by b.actual_qty desc""", STONE_WH)
        cards = [r[0] for r in q("""select name from `tabOrder Bag` where is_finished=0 and stock_status='In Production'
            and ifnull(stone_issue,0)=0 and location in ('SETTING','WAX SETTING','FILING','GRINDING') order by creation desc limit 30""")]
        cards = [c for c in cards if not frappe.db.exists("Pre Bag Record", c)]
        if not (emp and cz and cards): print("RES SKIP | T2", bool(emp), len(cz), len(cards)); return
        bag = cards[0]; bom = {r.item for r in frappe.get_doc("Order Bag", bag).bag_bom}
        item = next((r[0] for r in cz if r[0] not in bom), None)
        sieve = " ".join(item.split(" ")[1:]); avg = flt(frappe.db.get_value("Diamond Sieve", {"sieve_size": sieve}, "cz_avg_cts")) or 0.05
        pcs, ct = 2, round(avg * 2, 3)
        api.mark_stone_issue(json.dumps([bag])); frappe.db.commit()
        doc = frappe.get_doc("Order Bag", bag)
        lines = [{"item": r.item, "qty": flt(r.qty), "weight": flt(r.weight)} for r in doc.bag_bom if frappe.db.get_value("Item", r.item, "stone_type")]
        api.stone_issue_save_plan(bag, json.dumps(lines + [{"item": item, "qty": 0, "weight": 0}]))
        s0 = binq(item, STONE_WH); n0 = q("select count(*) from `tabBag Material Ledger` where order_bag=%s and item=%s", (bag, item))[0][0]
        err = None
        try: api.stone_issue_apply(bag, json.dumps([{"item": item, "ct": ct, "pcs": pcs}]), issued_by=emp)
        except Exception as e: err = frappe.utils.strip_html(str(e))[:200]; frappe.db.rollback()
        n1 = q("select count(*) from `tabBag Material Ledger` where order_bag=%s and item=%s", (bag, item))[0][0]
        row = frappe.db.get_value("Order Bag BOM Item", {"parent": bag, "item": item}, ["qty", "weight"], as_dict=True)
        ok("T2 blank-plan stone line issues without the 'modified' error", err is None, f"{bag} {item} {pcs}pc/{ct}ct err={err}")
        ok("T2 one ledger row, and the stone stock moved by the same carats", n1 == n0 + 1 and abs(binq(item, STONE_WH) - (s0 - ct)) < 0.0005, f"rows {n0}->{n1}, Stone Issue {s0}->{binq(item, STONE_WH)}")
        ok("T2 the blank plan was filled from what was issued", row and abs(flt(row.weight) * (doc.qty or 1) - ct) < 0.0005 and flt(row.qty) > 0, str(row))
        act = frappe.db.get_value("Order Bag", bag, "act_cz_weight")
        ok("T2 the card's actual CZ weight includes the issue (not overwritten by the save)", flt(act) >= ct - 0.0005, f"act_cz_weight={act}")
        err2 = None
        try: api.stone_issue_apply(bag, json.dumps([{"item": item, "ct": ct, "pcs": pcs}]), issued_by=emp)
        except Exception as e: err2 = frappe.utils.strip_html(str(e))[:160]; frappe.db.rollback()
        n2 = q("select count(*) from `tabBag Material Ledger` where order_bag=%s and item=%s", (bag, item))[0][0]
        ok("T2 a second press is refused and adds nothing", err2 is not None and n2 == n1, f"err={err2}")
    step("T2", t2)
    # ---------- T3: rework, finish again -> one set of materials ----------
    def t3():
        p = None
        for nm in [r[0] for r in q("select name from `tabOrder Bag` where is_finished=1 and stock_status='In Stock' and qty=1 order by creation desc limit 40")]:
            g = api.get_rework_piece(nm)
            if g.get("found") and g.get("can_rework") and not frappe.db.exists("Bag Material Ledger", {"order_bag": nm, "entry_type": "Rework"}):
                p = nm; break
        if not p: print("RES SKIP | T3 no piece that can be reworked"); return
        bucket = frappe.db.get_value("Order Bag", p, "bucket") or frappe.db.get_value("Finished Bucket", {"active": 1}, "name")
        m1 = api._bag_convert_materials([p])[p]; fg = api._wh("Finished Goods")
        gold = next(it for it in m1 if not frappe.db.get_value("Item", it, "stone_type"))
        fg0 = binq(gold, fg)
        api.rework_piece(p, to_location="REWORK")
        ok("T3 after rework the piece has no live conversion", api._bag_convert_materials([p])[p] == {}, "")
        c = api.get_bag_contents(p)
        ok("T3 the card holds its materials again, once", abs(sum(m1.values()) - sum(i["qty"] for i in c["items"])) < 0.002, f"frozen {round(sum(m1.values()),3)} vs held {round(sum(i['qty'] for i in c['items']),3)}")
        res = api.make_products(json.dumps([p]), bucket=bucket)
        ok("T3 the reworked card can be made a product again", p in (res.get("done") or []), str(res.get("errors"))[:160])
        m2 = api._bag_convert_materials([p])[p]
        raw = flt(q("select sum(qty) from `tabBag Material Ledger` where order_bag=%s and entry_type='Convert' and direction='Out'", p)[0][0])
        ok("T3 the piece reads ONE set of materials, not two", all(abs(flt(m2.get(k)) - v) < 0.002 for k, v in m1.items()) and len(m2) == len(m1), f"first {round(sum(m1.values()),3)} | now {round(sum(m2.values()),3)} | every Convert row ever {round(raw,3)}")
        ok("T3 Finished Goods holds the gold once", abs(binq(gold, fg) - fg0) < 0.002, f"{gold}: FG {fg0} -> {binq(gold, fg)}")
        g2 = api.get_rework_piece(p)
        ok("T3 a second rework would move the piece's weight once", abs(flt(g2.get("gold")) - flt(m1[gold])) < 0.002 if "gold" in g2 else True, f"rework screen gold={g2.get('gold')} piece gold={m1[gold]}")
    step("T3", t3)
    # ---------- T4: stone lot, whole sieve asked for ----------
    def t4():
        sup = frappe.db.get_value("Supplier", {}, "name"); qual = (api._stocked_diamond_qualities() or [""])[0]
        sv = frappe.get_all("Diamond Sieve", pluck="sieve_size", limit=2)
        def lot():
            nm = api.create_stone_lot(sup, quality=qual, claimed_cts=100)["name"]
            api.save_stone_lot_selection(nm, actual_cts=100, rows=json.dumps([{"sieve": sv[0], "actual": 60, "selected": 60}, {"sieve": sv[1], "actual": 40, "selected": 0}]))
            return nm
        rows = lambda nm: {r.sieve: (flt(r.actual_cts), flt(r.selected_cts), flt(r.purchased_cts)) for r in frappe.get_all("Stone Lot Sieve", filters={"parent": nm}, fields=["sieve", "actual_cts", "selected_cts", "purchased_cts"])}
        a = lot(); ra = api.create_stone_purchase_request(a, json.dumps([{"sieve": sv[0], "cts": 60}]))["name"]
        ok("T4 a sieve asked for in full stays on the lot", sv[0] in rows(a), str(rows(a)))
        api.save_stone_lot_selection(a, actual_cts=100, rows=json.dumps([{"sieve": sv[1], "actual": 40, "selected": 0}]))
        ok("T4 the desk cannot take that sieve off while the request waits", sv[0] in rows(a), str(rows(a)))
        api.decide_stone_purchase_request(ra, "Approved", post=0)
        ok("T4 approval records the purchase on the lot", rows(a).get(sv[0], (0, 0, 0))[2] == 60, str(rows(a)))
        ok("T4 nothing of that lot reads as never assorted", api._lot_unassorted(frappe.get_doc("Stone Lot", a)) < 0.001, str(api._lot_unassorted(frappe.get_doc("Stone Lot", a))))
        b = lot(); rb = api.create_stone_purchase_request(b, json.dumps([{"sieve": sv[0], "cts": 60}]))["name"]
        api.decide_stone_purchase_request(rb, "Rejected")
        ok("T4 a rejection puts the stones back on the tray", rows(b).get(sv[0], (0, 0, 0))[:2] == (60, 60), str(rows(b)))
        for nm in (a, b):
            frappe.db.set_value("Stone Lot", nm, "remarks", "TEST 2026-10-07 — critical fixes")
        frappe.db.commit()
    step("T4", t4)
    # ---------- T5: repair stones keep their bucket ----------
    def t5():
        o = q("select parent from `tabRepair Order Item` where ifnull(bill,'')='' group by parent having count(*)>=2 order by max(creation) desc limit 1")
        if not o: print("RES SKIP | T5 no repair batch with two unbilled pieces"); return
        o = o[0][0]; its = [r.repair for r in frappe.get_doc("Repair Order", o).items if not r.bill][:2]
        repair_api.set_piece_stones(o, its[0], json.dumps([{"bucket": "CZ", "stone": "test cz", "sieve": "", "pcs": 4, "ct": 0.4}]))
        repair_api.set_piece_stones(o, its[1], json.dumps([{"bucket": "CVD", "stone": "test cvd", "sieve": "", "pcs": 3, "ct": 0.3}]))
        repair_api.set_piece_stones(o, its[0], json.dumps([{"bucket": "CZ", "stone": "test cz", "sieve": "", "pcs": 5, "ct": 0.5}]))
        got = {(s.repair, s.bucket) for s in frappe.get_doc("Repair Order", o).stones if s.repair in its}
        ok("T5 saving one repair piece leaves the other piece's stone type alone", got == {(its[0], "CZ"), (its[1], "CVD")}, f"{o}: {sorted(got)}")
    step("T5", t5)
    # ---------- T6: the automatic retry ----------
    def t6():
        import frappe.handler as handler
        calls = {"n": 0}
        def fake_saved_then_clash(cmd, from_async=False):
            calls["n"] += 1; frappe.db.commit(); raise Exception("(1020, 'Record has changed since last read in table x')")
        handler._jw_clash = None; handler._jw_original = None; handler.execute_cmd = fake_saved_then_clash
        guard._install_clash_handler(); msg = ""
        try: handler.execute_cmd("jewelima.jewelima.api.x")
        except Exception as e: msg = frappe.utils.strip_html(str(e))
        frappe.clear_messages()
        ok("T6 a call that already saved part of its work is NOT run again", calls["n"] == 1 and "did not all go through" in msg, f"runs={calls['n']} msg={msg[:70]}")
        calls["n"] = 0
        def fake_clash_then_ok(cmd, from_async=False):
            calls["n"] += 1
            if calls["n"] == 1: raise Exception("(1213, 'Deadlock found when trying to get lock')")
            return "ok"
        handler._jw_clash = None; handler._jw_original = None; handler.execute_cmd = fake_clash_then_ok
        guard._install_clash_handler()
        r = handler.execute_cmd("jewelima.jewelima.api.x")
        ok("T6 a call that saved nothing is run once more, as before", r == "ok" and calls["n"] == 2, f"runs={calls['n']}")
        ok("T6 the database's own commit is restored afterwards", "commit" not in frappe.db.__dict__, "")
    step("T6", t6)
    print("RES SUMMARY", sum(R), "of", len(R), "passed")
main()
