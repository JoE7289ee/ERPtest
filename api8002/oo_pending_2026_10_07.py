def main():
    import frappe, json, os
    from frappe.utils import add_days, nowdate, flt
    from jewelima.jewelima import outside_orders as oo
    R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", str(extra)[:220])
    frappe.set_user("Administrator")
    frappe.cache.delete("oo_rate|pending-pdf|Administrator")
    def clear():
        for t in frappe.get_all("Outside Order Batch", filters={"title": ["like", "ZZT%"]}, pluck="name"):
            for n in frappe.get_all("Outside Order", filters={"batch": t}, pluck="name"): frappe.delete_doc("Outside Order", n, ignore_permissions=True, force=True)
            frappe.delete_doc("Outside Order Batch", t, ignore_permissions=True, force=True)
        frappe.db.commit()
    clear()
    ph = [p for p in frappe.db.sql("select name, image from `tabSelection Photo` where ifnull(image,'')!='' order by name limit 200", as_dict=True) if os.path.isfile(frappe.get_site_path("public", p.image.lstrip("/")))]
    if len(ph) < 46: print("RES SKIP | the copy has fewer than 46 Selection photos with a file"); return
    made = {}
    for title, off, photos in (("ZZT Rings late", -6, ph[0:14]), ("ZZT Pendants soon", 4, ph[14:26]), ("ZZT Bracelets far", 30, ph[26:34]), ("ZZT No date", None, ph[34:46])):
        b = oo.save_batch(json.dumps({"title": title, "vendor": "ZZT VENDOR" if off is not None else "ZZT OTHER VENDOR", "order_date": add_days(nowdate(), -20), "expected_date": add_days(nowdate(), off) if off is not None else None}))["name"]
        oo.add_from_selection(b, " ".join(p.name for p in photos)); oo.place_order(b, add_days(nowdate(), -20)); made[title] = b
    rows = frappe.get_all("Outside Order", filters={"batch": ["in", list(made.values())]}, fields=["name", "batch"], order_by="creation")
    quals, cols, kar = ["VVS-EF", "VVS-EF", "VVS-EF", "VVS-GH", "VS-GH", "VVS-EF", "SI-IJ"], ["Yellow Gold", "Pink Gold", "Pink Gold", "White Gold", "Yellow Gold", "NA"], ["18K", "18K", "18K", "22K", "14K", "18K"]
    for i, r in enumerate(rows):
        frappe.db.set_value("Outside Order", r.name, {"ordered_clarity": quals[i % 7], "metal_color": cols[i % 6], "karat": kar[i % 6], "size": ["12", "13", "NA", "14"][i % 4]}, update_modified=False)
    first = made["ZZT Rings late"]; d0 = frappe.get_doc("Outside Order", rows[0].name)
    for col, size in (("Pink Gold", "14"), ("Pink Gold", "16")):
        c = frappe.copy_doc(d0); c.metal_color = col; c.size = size; c.flags.ignore_permissions = True; c.insert()
    frappe.db.set_value("Outside Order", rows[1].name, {"remarks": "Make the shank 1.6 mm <b>heavy</b>", "esmith_job_order_no": "JO-5512"})
    frappe.db.set_value("Outside Order", rows[2].name, "expected_date", add_days(nowdate(), -15))
    frappe.db.commit()
    oo.receive_lines(first, json.dumps([{"name": rows[3].name, "gross": 2.1, "net": 1.9, "stone": 0.2, "received_date": nowdate()}]))
    d = frappe.get_doc("Outside Order", rows[4].name)
    oo.add_delivery(rows[4].name, nowdate(), gross_weight=d.ordered_gross, net_weight=d.ordered_net, stone_weight=d.ordered_stone)
    d = frappe.get_doc("Outside Order", rows[5].name); part_left = round(d.ordered_gross - round(d.ordered_gross * 0.4, 3), 3)
    oo.add_delivery(rows[5].name, nowdate(), gross_weight=round(d.ordered_gross * 0.4, 3), net_weight=round(d.ordered_net * 0.4, 3), stone_weight=0)
    oo.set_status(rows[6].name, "Cancelled", "test"); frappe.db.commit()
    # ---- a line falls due with its order when it has no date of its own
    far = made["ZZT Bracelets far"]; ln = frappe.get_all("Outside Order", filters={"batch": far}, pluck="name")[0]
    frappe.db.set_value("Outside Order", ln, "expected_date", None, update_modified=False); frappe.db.commit()
    g = {r["name"]: r for r in oo.get_orders(batch=far)["rows"]}
    ok("a line with no date of its own shows its order's date as due", g[ln]["due_date"] == str(add_days(nowdate(), 30)) and g[ln]["expected_date"] == "", (g[ln]["due_date"], g[ln]["expected_date"]))
    frappe.db.set_value("Outside Order Batch", far, "expected_date", add_days(nowdate(), -3)); frappe.db.commit()
    g = {r["name"]: r for r in oo.get_orders(batch=far)["rows"]}
    ok("and is overdue the day the order's date passes", g[ln]["overdue"] and g[ln]["overdue_by"] == 3, (g[ln]["overdue"], g[ln]["overdue_by"]))
    other = [n for n in g if n != ln][0]
    ok("a line with its own date keeps it", g[other]["due_date"] == str(add_days(nowdate(), 30)) and not g[other]["overdue"], g[other]["due_date"])
    one = oo.get_order(ln)
    ok("the line's own card shows the same due date", one["due_date"] == str(add_days(nowdate(), -3)) and one["expected_date"] == "", (one["due_date"], one["expected_date"]))
    frappe.db.set_value("Outside Order Batch", far, "expected_date", add_days(nowdate(), 30)); frappe.db.set_value("Outside Order", ln, "expected_date", add_days(nowdate(), 30), update_modified=False); frappe.db.commit()
    # ---- the pending list
    seen = {}
    import pdfkit
    real = pdfkit.from_string
    def spy(html, out, options=None, **kw):
        seen["html"], seen["options"] = html, options
        return real(html, out, options=options, **kw)
    pdfkit.from_string = spy
    try:
        oo.pending_pdf(); pdf = frappe.local.response.filecontent; h = seen["html"]
        ok("the list is a PDF, shown in the browser", pdf[:5] == b"%PDF-" and frappe.local.response.content_type == "application/pdf" and frappe.local.response.display_content_as == "inline", (len(pdf), frappe.local.response.filename))
        import re
        nos = re.findall(r"<div class='dn'>([^<]+)</div>", h)
        ok("received, delivered and cancelled lines are not on it", len(nos) == 43 and "45</div><div class='u'>pieces · 43 designs" in h.replace("\n", ""), (len(nos), re.findall(r"class='v'>([^<]+)<", h)))
        ok("and the heading says what was left out", "1 received" in h and "1 delivered" in h and "1 cancelled" in h, re.findall(r"left out: ([^<]+)<", h))
        dues = re.findall(r"<td><div class='due'>([^<]+)</div>|<td>(<div class='mute'>No due date)", h)
        seq = ["none" if b else frappe.utils.getdate(frappe.utils.data.parse_date(a) if hasattr(frappe.utils.data, "parse_date") else frappe.utils.getdate("-".join(reversed(a.split("-"))))) for a, b in dues]
        dated = [x for x in seq if x != "none"]
        ok("rows run from the longest overdue to the furthest off, undated last", dated == sorted(dated) and seq[len(dated):] == ["none"] * (len(seq) - len(dated)) and len(dated) == 31 and len(seq) == 43, (len(dated), len(seq), str(dated[0]), str(dated[-1])))
        ok("the row past its date says how many days late", "15 days late" in h and "6 days late" in h and "in 4 days" in h and "in 30 days" in h, "")
        ok("the same design on one order is one row with its pieces", "3 pcs</span>" in h and "Pink Gold × 2" in h and "Size 12 · 14 · 16" in h, re.findall(r"class='pcs'>([^<]+)<", h)[:4])
        ok("a part delivery counts only what is still to come", "{0:.3f}".format(part_left) in h and "came so far" in h, part_left)
        ok("what a person typed is written as text, never as markup", "&lt;b&gt;heavy&lt;/b&gt;" in h and "<b>heavy</b>" not in h, "")
        ok("every row has its picture from the temp folder, and the engine may read only that folder", h.count("background-image:url('file:///tmp/jw-oo-thumbs/") == 43 and "<img" not in h and seen["options"].get("allow") == "/tmp/jw-oo-thumbs" and "enable-local-file-access" not in seen["options"], (h.count("background-image:url("), seen["options"].get("allow")))
        tabs = re.findall(r"<table class='rows'( style='page-break-after:always;')?>(.*?)</table>", h, flags=re.S)
        per = [len(re.findall(r"<div class='dn'>", t[1])) for t in tabs]
        ok("the summary page takes the rows it has room for, every page after seven, each a table with its own heading", per == [4, 7, 7, 7, 7, 7, 4] and [bool(t[0]) for t in tabs] == [True] * 6 + [False] and h.count("<thead>") == 7, per)
        ok("the quality pie and the purity and colour bars are drawn", h.count("<svg") == 3 and h.count("<path") == 4 and "Diamond quality" in h and "Purity" in h and "Metal colour" in h, (h.count("<svg"), h.count("<path"), h.count("<rect")))
        g45 = [r for r in oo.get_orders()["rows"] if r["status"] not in oo.PENDING_OUT]
        gross = sum(flt(r["ordered_gross"]) - (flt(r["delivered_gross"]) if r["status"] == "Partially Delivered" else 0) for r in g45)
        ok("estimated gross is the sum of what is pending", "{0:,.3f}".format(gross) in h, round(gross, 3))
        col = lambda name: (re.findall(r"background:(#[0-9a-f]{6});[^>]*></span></td><td><b>" + re.escape(name), h) or re.findall(r"background:(#[0-9a-f]{6});[^>]*></span> <b>" + re.escape(name), h) or [None])[0]
        c_all = {k: col(k) for k in ("VVS-EF", "18K", "Yellow Gold", "Pink Gold", "NA")}
        sel = [rows[0].name, rows[1].name, rows[3].name, rows[15].name]
        oo.pending_pdf(names=json.dumps(sel)); h2 = seen["html"]
        ok("with lines ticked, only those are listed", len(re.findall(r"<div class='dn'>", h2)) == 3 and "Selected lines" in h2 and "left out: 1 received" in h2, re.findall(r"<div class='dn'>([^<]+)<", h2))
        c_sel = {k: col2 for k in c_all for col2 in [(re.findall(r"background:(#[0-9a-f]{6});[^>]*></span></td><td><b>" + re.escape(k), h2) or re.findall(r"background:(#[0-9a-f]{6});[^>]*></span> <b>" + re.escape(k), h2) or [None])[0]] if col2}
        ok("a name keeps its colour from one list to the next", c_sel and all(c_all[k] == v for k, v in c_sel.items()), (c_all, c_sel))
        ok("yellow gold is yellow, pink gold pink, NA grey", c_all["Yellow Gold"] == "#eda100" and c_all["Pink Gold"] == "#e87ba4" and c_all["NA"] == "#9a9a94", c_all)
        same = [r.name for i, r in enumerate(rows) if i % 6 in (1, 2) and i > 6][:6]          # six lines of one purity and one colour: one line of key under each bar
        oo.pending_pdf(names=json.dumps(same)); hb = seen["html"]
        per5 = [len(re.findall(r"<div class='dn'>", t[1])) for t in re.findall(r"<table class='rows'( style='page-break-after:always;')?>(.*?)</table>", hb, flags=re.S)]
        ok("a shorter summary leaves room for a fifth row", per5 == [5, 1], per5)
        oo.pending_pdf(batch=made["ZZT No date"]); h3 = seen["html"]
        ok("with nothing ticked the table's filters decide", len(re.findall(r"<div class='dn'>", h3)) == 12 and "ZZT No date" in h3 and "ZZT OTHER VENDOR" in h3 and "12 with no due date" in h3, len(re.findall(r"<div class='dn'>", h3)))
        try: oo.pending_pdf(names=json.dumps([rows[3].name, rows[6].name])); ok("a list of nothing pending is refused", False, "went through")
        except frappe.ValidationError as e: ok("a list of nothing pending is refused", "Nothing is pending" in str(e), str(e)[:80])
        frappe.set_user("Guest")
        try: oo.pending_pdf(); ok("an account without the outside-orders roles cannot make it", False, "went through")
        except frappe.PermissionError: ok("an account without the outside-orders roles cannot make it", True)
        frappe.set_user("Administrator")
        frappe.cache.delete("oo_rate|pending-pdf|Administrator"); hit = 0
        pdfkit.from_string = lambda *a, **k: b"%PDF-stub"
        frappe.cache.delete("oo_rate|pending-pdf|Administrator")
        for i in range(12):
            try: oo.pending_pdf(batch=made["ZZT No date"])
            except frappe.TooManyRequestsError: hit += 1
        ok("ten lists in five minutes, then it asks to wait", hit == 2, hit)
        ttl = frappe.cache.ttl("oo_rate|pending-pdf|Administrator")
        ok("and the count clears by itself", 0 < ttl <= 300, ttl)
        frappe.cache.delete("oo_rate|pending-pdf|Administrator")
    finally:
        pdfkit.from_string = real
    frappe.db.rollback()
    print("RES", "ALL PASS" if all(R) else "SOME FAILED", sum(R), "of", len(R), "| test orders kept for the browser spec:", made)
main()
