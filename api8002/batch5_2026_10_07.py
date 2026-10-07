def main():
    import frappe, json
    from frappe.utils import flt, cint
    from jewelima.jewelima import api, design_bank_api as dba
    from jewelima.jewelima.benches import ISSUE_RECEIPT_LOCATIONS, ASSIGN_COLLECT_LOCATIONS
    from jewelima.jewelima import benches
    q = frappe.db.sql; R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", str(extra)[:200])
    frappe.set_user("Administrator")
    # ---- made on: the day a piece was made does not move when it comes back from a lab
    ok("every finished piece has a made-on date", q("select count(*) from `tabOrder Bag` where is_finished=1 and made_on is null")[0][0] == 0, q("select count(*), min(made_on), max(made_on) from `tabOrder Bag` where is_finished=1"))
    pc = q("select name, made_on, in_stock_on from `tabOrder Bag` where is_finished=1 and stock_status='In Stock' and date(made_on) < curdate() limit 1")
    if pc:
        nm, mo, iso = pc[0]
        made0 = cint(q("select count(*) from `tabOrder Bag` where is_finished=1 and date(made_on)=curdate()")[0][0])
        frappe.db.set_value("Order Bag", nm, "in_stock_on", frappe.utils.now_datetime(), update_modified=False); frappe.db.commit()
        recs = api._m_records_all("made_products", frappe.utils.today(), frappe.utils.today(), None, 5000)
        rows = recs.get("rows") if isinstance(recs, dict) else recs
        ok("a piece back in stock today is not in today's Made Product Records", nm not in [r.get("card") for r in (rows or [])], f"{nm} made {mo}, today's book has {len(rows or [])}")
        old = api._m_records_all("made_products", str(mo)[:10], str(mo)[:10], None, 5000); orow = old.get("rows") if isinstance(old, dict) else old
        ok("and it is still in the book for the day it was made", nm in [r.get("card") for r in (orow or [])], f"{str(mo)[:10]}: {len(orow or [])} rows")
        ok("the count of pieces made today did not move", cint(q("select count(*) from `tabOrder Bag` where is_finished=1 and date(made_on)=curdate()")[0][0]) == made0, made0)
        frappe.db.set_value("Order Bag", nm, "in_stock_on", iso, update_modified=False); frappe.db.commit()
    else: print("RES SKIP | no finished piece made before today")
    # ---- stones are served by the piece
    L = api._stone_left
    ok("ten of ten stones a little light is a full card", L(10, 0.250, 10, 0.243) == (0, 0.0), L(10, 0.250, 10, 0.243))
    ok("eight of ten is two short", L(10, 0.250, 8, 0.200) == (2, 0.05), L(10, 0.250, 8, 0.200))
    ok("a line planned by weight alone is judged on carats", L(0, 0.5, 0, 0.2) == (0, 0.3) and L(0, 0.5, 0, 0.5) == (0, 0.0), (L(0, 0.5, 0, 0.2), L(0, 0.5, 0, 0.5)))
    # ---- pre-bag: a card with all its stones is not offered again
    full = q("""select b.name, i.stone_type from `tabOrder Bag` b join `tabOrder Bag BOM Item` bi on bi.parent=b.name join tabItem i on i.name=bi.item
        where b.is_finished=0 and b.stock_status='In Production' and ifnull(b.stone_issue,0)=0 and ifnull(i.stone_type,'')!='' and bi.qty>0
        group by b.name having count(*)=1 and min((select ifnull(sum(if(l.direction='Out',-l.pcs,l.pcs)),0) from `tabBag Material Ledger` l
            where l.order_bag=b.name and l.item=bi.item and l.entry_type in ('Stone Issue','Stone Return','Split In','Split Out')) >= bi.qty*greatest(ifnull(b.qty,1),1)) = 1 limit 1""")
    if full:
        nm, st = full[0]; bk = (api._BUCKET_OF_STONE_TYPE.get(st) or "poth").upper()
        c = api.get_prebag_candidates(bk)
        ok("Pre-Bag does not list a card that already has all its stones", nm not in [x["order_bag"] for x in c], f"{nm} ({bk}); {len(c)} cards listed")
        try: api.set_prebag(nm, bk); frappe.db.rollback(); ok("and refuses to set it", False, "went through")
        except Exception as e: frappe.db.rollback(); ok("and refuses to set it", "already has all" in str(e), str(e))
    else: print("RES SKIP | no fully stoned card on the floor")
    short = q("""select b.name, i.stone_type from `tabOrder Bag` b join `tabOrder Bag BOM Item` bi on bi.parent=b.name join tabItem i on i.name=bi.item
        where b.is_finished=0 and b.stock_status='In Production' and ifnull(b.stone_issue,0)=0 and ifnull(i.stone_type,'')!='' and bi.qty>0
        and not exists (select 1 from `tabBag Material Ledger` l where l.order_bag=b.name and l.item=bi.item) limit 1""")
    if short:
        nm, st = short[0]; bk = (api._BUCKET_OF_STONE_TYPE.get(st) or "poth").upper()
        c = {x["order_bag"]: x for x in api.get_prebag_candidates(bk)}
        ok("a card still waiting for its stones is listed as before", nm in c and c[nm]["need_pcs"] > 0, f"{nm} ({bk}) need {c.get(nm, {}).get('need_pcs')}")
        ok("the bucket picker counts the same cards as the list", {b["bucket"]: b["count"] for b in api.get_prebag_buckets()}.get(bk) == len(c), f"{bk}: picker {dict((b['bucket'], b['count']) for b in api.get_prebag_buckets()).get(bk)} list {len(c)}")
    else: print("RES SKIP | no card waiting for stones")
    # ---- a split piece is counted with the stones it carries
    sp = q("""select l.order_bag, l.item, sum(l.pcs) from `tabBag Material Ledger` l join tabItem i on i.name=l.item
        where l.entry_type='Split In' and ifnull(i.stone_type,'')!='' and l.pcs>0 group by l.order_bag, l.item limit 1""")
    if sp:
        nm, item, pcs = sp[0]; got = api._card_issued_map(nm).get(item, {})
        only = cint(q("select ifnull(sum(if(direction='Out',-pcs,pcs)),0) from `tabBag Material Ledger` where order_bag=%s and item=%s and entry_type in ('Stone Issue','Stone Return')", (nm, item))[0][0])
        ok("the Stone Issue station counts the stones a split piece came with", cint(got.get("pcs")) == only + cint(pcs) - cint(q("select ifnull(sum(pcs),0) from `tabBag Material Ledger` where order_bag=%s and item=%s and entry_type='Split Out'", (nm, item))[0][0]), f"{nm} {item}: split in {pcs}, counted {got.get('pcs')} (was {only})")
    else: print("RES SKIP | no split piece carrying stones")
    # ---- filing: scrub that exactly explains the difference
    card = None
    for nm, in q("select name from `tabOrder Bag` where is_finished=0 and stock_status='In Production' and location='FILING' and ifnull(is_cad,0)=0"):
        c = api.get_bag_contents(nm)
        if c["gold_grams"] > 1 and not api._open_bench_issue(nm, "FILING"):
            card = nm; break
    if not card:
        # the copy has nothing free at FILING: walk a free card over from another weight bench
        for nm, loc in q("select name, location from `tabOrder Bag` where is_finished=0 and stock_status='In Production' and ifnull(is_cad,0)=0 and location in %s", (list(ISSUE_RECEIPT_LOCATIONS),)):
            if api.get_bag_contents(nm)["gold_grams"] > 1 and not api._open_bench_issue(nm, loc):
                frappe.db.set_value("Order Bag", nm, "location", "FILING", update_modified=False); benches.on_bag_arrival(nm, "FILING"); frappe.db.commit(); card = nm; break
    if card:
        emp = (q("select e.employee from `tabBench Employee` e join tabBench b on b.name=e.parent where upper(b.name)='FILING' limit 1") or q("select name from tabEmployee where status='Active' limit 1"))[0][0]
        wt = (api.get_bench_work_options("FILING").get("work_types") or [None])[0]
        api.issue_bench_cards(json.dumps([card]), "FILING", employee=emp, work_type=wt)
        iss = api._open_bench_issue(card, "FILING"); wout = flt(frappe.db.get_value("Bench Issue", iss, "weight_out"))
        tried = None
        for sc in (0.149, 0.127, 0.113, 0.101, 0.087, 0.071, 0.053):
            win = round(wout - sc, 3)
            if (wout - win - sc) != 0 or (win + sc - wout) != 0: tried = (win, sc); break
        win, sc = tried or (round(wout - 0.149, 3), 0.149)
        g0 = api.get_bag_contents(card)["gold_grams"]
        res = api.receipt_bench_cards(json.dumps([{"order_bag": card, "weight_in": win, "scrub": sc}]), "FILING", employee=emp)
        d = (res.get("done") or [{}])[0]
        ok("a filing receipt whose scrub exactly explains the difference goes through", res.get("count") == 1 and not res.get("errors") and flt(d.get("loss")) == 0 and flt(d.get("gain")) == 0 and abs(flt(d.get("scrub")) - sc) < 0.0005, f"{card}: out {wout} in {win} scrub {sc} (float residue {wout - win - sc:.2e}) -> {res.get('done')} {str(res.get('errors'))[:120]}")
        ok("and the scrub came off the card", abs(g0 - api.get_bag_contents(card)["gold_grams"] - sc) < 0.0005, f"{g0} -> {api.get_bag_contents(card)['gold_grams']}")
    else: print("RES SKIP | no free card at FILING")
    # ---- a card assigned with nobody named can be collected once a worker is named
    aloc = None
    for loc in sorted(x for x in ASSIGN_COLLECT_LOCATIONS if x != "CAD"):
        r = q("select name from `tabOrder Bag` where is_finished=0 and stock_status='In Production' and location=%s and ifnull(is_cad,0)=0", loc)
        for (nm,) in r:
            if not api._open_bench_issue(nm, loc): aloc, acard = loc, nm; break
        if aloc: break
    if aloc:
        r = api.assign_bench_cards(json.dumps([acard]), aloc)
        iss = api._open_bench_issue(acard, aloc)
        if iss and not frappe.db.get_value("Bench Issue", iss, "employee"):
            emp = q("select name from tabEmployee where status='Active' limit 1")[0][0]
            try:
                res = api.ws_collect_card(aloc, acard, employee=emp)
                ok("a card assigned with no worker is collected once one is named", res.get("count") == 1 and frappe.db.get_value("Bench Issue", iss, "employee") == emp, f"{acard} at {aloc}: {res.get('done')}")
            except Exception as e:
                frappe.db.rollback(); ok("a card assigned with no worker is collected once one is named", False, str(e))
        else: print("RES SKIP | could not assign without a worker:", str(r)[:150])
    else: print("RES SKIP | no free card at an assign/collect bench")
    # ---- a save that does not send the extra lines leaves them alone
    d = q("select name from `tabDesign Bank` where status in ('Pending','Approved') and ifnull(design_type,'')!='' order by modified desc limit 1")[0][0]
    doc = frappe.get_doc("Design Bank", d); was = doc.extra_lines
    frappe.db.set_value("Design Bank", d, "extra_lines", "CS 4 pcs\nBACK CHAIN 16in", update_modified=False); frappe.db.commit()
    doc = frappe.get_doc("Design Bank", d)
    api.save_design_card(json.dumps({"name": doc.name, "design_no": doc.design_no, "design_type": doc.design_type, "gross_weight": flt(doc.gross_weight), "diamond_weight": flt(doc.diamond_weight),
        "note": doc.note or "", "photo": doc.photo, "stones": [{"stone": r.stone, "sieve": r.sieve, "pcs": r.pcs, "ct": r.ct} for r in doc.stones]}))
    ok("a card save that sends no 'More notes' keeps them", frappe.db.get_value("Design Bank", d, "extra_lines") == "CS 4 pcs\nBACK CHAIN 16in", repr(frappe.db.get_value("Design Bank", d, "extra_lines")))
    frappe.db.set_value("Design Bank", d, "extra_lines", was, update_modified=False); frappe.db.commit()
    # the copy may carry no tags at all: put one on a design and on a late photo, and take them off after
    made_tags = []
    def tag_one(dt, child, name):
        tf = [x for x in frappe.get_meta(child).fields if x.fieldname == "tag"][0]
        tg = (frappe.get_all(tf.options, pluck="name", limit=1) or [None])[0] if tf.fieldtype == "Link" else "ZZT TAG"
        if not tg:
            m = frappe.get_doc({"doctype": tf.options, "tag_name": "ZZT TAG"}).insert(ignore_permissions=True); tg = m.name; made_tags.append((tf.options, m.name))
        row = frappe.get_doc({"doctype": child, "parent": name, "parenttype": dt, "parentfield": "tags", "tag": tg, "idx": 99}); row.db_insert(); made_tags.append((child, row.name))
    if not q("select 1 from `tabDesign Bank Tag` t join `tabDesign Bank` b on b.name=t.parent where b.status='Approved' and ifnull(b.design_type,'')!='' limit 1"):
        for (nm,) in q("select name from `tabDesign Bank` where status='Approved' and ifnull(design_type,'')!='' and gross_weight>=1 limit 3"): tag_one("Design Bank", "Design Bank Tag", nm)
    if True:
        for (nm,) in q("select name from `tabSelection Photo` where active=1 and reviewed=1 order by code desc limit 3"): tag_one("Selection Photo", "Selection Photo Tag", nm)
    frappe.db.commit()
    # ---- gallery: a tag together with a design type
    pair = q("""select b.design_type, t.tag, count(distinct b.name) from `tabDesign Bank` b join `tabDesign Bank Tag` t on t.parent=b.name
        where b.status='Approved' and ifnull(b.design_type,'')!='' group by b.design_type, t.tag order by 3 desc limit 1""")
    if pair:
        dt, tg, n = pair[0]
        g = dba.get_designs(tags=json.dumps([tg]), design_type=dt, limit=5)
        ok("Gallery: a tag with a design type finds the designs that have both", g["total"] == n and n > 0, f"{dt} + {tg}: {g['total']} (database says {n})")
        n2 = q("""select count(distinct b.name) from `tabDesign Bank` b join `tabDesign Bank Tag` t on t.parent=b.name
            where b.status='Approved' and b.design_type=%s and t.tag=%s and b.gross_weight>=1""", (dt, tg))[0][0]
        g2 = dba.get_designs(tags=json.dumps([tg]), design_type=dt, gw_min=1, match="all", limit=5)
        ok("and with a weight limit and 'all tags' as well", g2["total"] == n2, f"{g2['total']} (database says {n2})")
    else: print("RES SKIP | no approved design with a tag")
    # ---- Selection: filters look through the whole catalogue
    allp = api.get_selection_photos()
    n_all = q("select count(*) from `tabSelection Photo` where active=1 and reviewed=1")[0][0]
    ok("Selection says how many photos there are, not how many it loaded", allp["total"] == n_all and len(allp["photos"]) == min(n_all, 500) and bool(allp["has_more"]) == (n_all > 500), f"total {allp['total']} loaded {len(allp['photos'])} has_more {allp['has_more']}")
    late = q("""select t.tag, count(*) from `tabSelection Photo Tag` t join `tabSelection Photo` p on p.name=t.parent
        where p.active=1 and p.reviewed=1 and t.parenttype='Selection Photo' and p.code > %s group by t.tag order by 2 desc limit 1""", (allp["photos"][-1]["code"] if n_all > 500 else "",))
    if late:
        tg = late[0][0]
        n = q("""select count(*) from `tabSelection Photo` p where p.active=1 and p.reviewed=1 and exists (select 1 from `tabSelection Photo Tag` t where t.parent=p.name and t.tag=%s and t.parenttype='Selection Photo')""", tg)[0][0]
        r = api.get_selection_photos(tag=tg)
        ok("a tag finds its photos wherever they are in the catalogue", r["total"] == n and all(tg in p["tags"] for p in r["photos"]), f"{tg}: {r['total']} (database says {n}), {late[0][1]} of them past the first 500")
    else: print("RES SKIP | no tagged photo")
    gmin, gmax = 5, 8
    n = q("select count(*) from `tabSelection Photo` where active=1 and reviewed=1 and gold_18k>=%s and gold_18k<=%s and gold_18k>0", (gmin, gmax))[0][0]
    r = api.get_selection_photos(gold_min=gmin, gold_max=gmax)
    ok("a gold range is counted over the whole catalogue", r["total"] == n, f"5-8 g: {r['total']} (database says {n})")
    if n_all > 500:
        p2 = api.get_selection_photos(start=500)
        ok("the next page carries on where the first stopped", p2["photos"] and p2["photos"][0]["code"] > allp["photos"][-1]["code"] and p2["start"] == 500, f"{allp['photos'][-1]['code']} -> {p2['photos'][0]['code'] if p2['photos'] else None}")
    for child, nm in made_tags: frappe.db.delete(child, {"name": nm})
    frappe.db.commit()
    print("RES TOTAL", sum(R), "of", len(R), "passed")
main()
