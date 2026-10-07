def main():
    import frappe, json
    from frappe.utils import flt
    from jewelima.jewelima import api
    import jewelima.setup as setup
    q = frappe.db.sql; R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", str(extra)[:170])
    frappe.set_user("Administrator")
    old = frappe.db.get_single_value("Stone Issue Settings", "tol_dmd")
    frappe.db.set_single_value("Stone Issue Settings", "tol_dmd", 7.5); frappe.db.commit()
    setup.seed_desk_defaults(); frappe.db.commit()
    ok("a deploy leaves the manager's stone-issue limit alone", flt(frappe.db.get_single_value("Stone Issue Settings", "tol_dmd")) == 7.5, frappe.db.get_single_value("Stone Issue Settings", "tol_dmd"))
    frappe.db.set_single_value("Stone Issue Settings", "tol_dmd", old); frappe.db.commit()
    def who(role, without=("System Manager", "JW Manager")):
        r = q("""select h.parent from `tabHas Role` h join tabUser u on u.name=h.parent where h.role=%s and h.parenttype='User' and u.enabled=1
            and h.parent not in (select parent from `tabHas Role` where role in %s and parenttype='User') limit 1""", (role, without))
        return r[0][0] if r else None
    u = who("JW Selection")
    if u:
        frappe.set_user(u)
        try: r = api.get_selection_review(); ok("Selection staff can open Selection Review", True, f"{u}: {list(r.keys())[:4]}")
        except Exception as e: frappe.db.rollback(); ok("Selection staff can open Selection Review", False, str(e))
    else: print("RES SKIP | no JW Selection user")
    u = who("JW Delivery", ("System Manager", "JW Manager", "Stock Manager", "JW Stock Admin", "Jewelima Stock", "JW Info"))
    if u:
        frappe.set_user(u)
        try: r = api.get_finished_goods(); ok("the Delivery desk gets Finished Goods data", True, f"{u}")
        except Exception as e: frappe.db.rollback(); ok("the Delivery desk gets Finished Goods data", False, str(e))
    else: print("RES SKIP | no JW Delivery-only user")
    frappe.set_user("Administrator")
    sc = q("select l.employee, e.employee_name from `tabBag Material Ledger` l join tabEmployee e on e.name=l.employee where l.entry_type='Scrub' limit 1")
    if sc:
        r = api.get_scrub_history(employee=sc[0][1]); r0 = api.get_scrub_history(employee="NOBODY AT ALL")
        ok("Scrub History finds a person's rows by name", len(r["rows"]) > 0, f"{sc[0][1]}: {len(r['rows'])} rows")
        ok("and an empty answer keeps the pickers filled", len(r0["rows"]) == 0 and len(r0["people"]) > 0, f"people {len(r0['people'])}")
    else: print("RES SKIP | no scrub rows")
    # a design card save keeps what the screen cannot show
    d = q("""select parent from `tabDesign Bank Stone` where ifnull(sieve,'')!='' group by parent having count(*)>=1 limit 1""")
    if d:
        doc = frappe.get_doc("Design Bank", d[0][0])
        doc.append("stones", {"stone": "RUBY TEST", "sieve": "", "pcs": 2, "ct": 0.5}); doc.stones[0].ct = flt(doc.stones[0].ct) or 0.123
        doc.flags.ignore_validate = True; doc.save(ignore_permissions=True); frappe.db.commit()
        before = sorted(((r.stone or ""), (r.sieve or ""), int(r.pcs or 0), flt(r.ct)) for r in frappe.get_doc("Design Bank", doc.name).stones)
        payload = {"name": doc.name, "design_no": doc.design_no, "design_type": doc.design_type, "gross_weight": doc.gross_weight, "diamond_weight": doc.diamond_weight,
            "note": doc.note, "extra_lines": doc.extra_lines, "photo": doc.photo, "provider": doc.get("provider") or "", "provider_piece_code": doc.get("provider_piece_code") or "",
            "stones": [{"sieve": r.sieve, "pcs": r.pcs} for r in doc.stones if r.sieve]}
        try:
            api.save_design_card(json.dumps(payload))
            after = sorted(((r.stone or ""), (r.sieve or ""), int(r.pcs or 0), flt(r.ct)) for r in frappe.get_doc("Design Bank", doc.name).stones)
            ok("saving a card from the editor keeps its named stone and the carats", after == before, f"{doc.design_no}: {len(before)} rows before, {len(after)} after; ruby kept={any(a[0]=='RUBY TEST' for a in after)}")
        except Exception as e:
            frappe.db.rollback(); ok("saving a card from the editor keeps its named stone and the carats", False, str(e))
        doc = frappe.get_doc("Design Bank", doc.name); doc.set("stones", [r for r in doc.stones if r.stone != "RUBY TEST"]); doc.flags.ignore_validate = True; doc.save(ignore_permissions=True); frappe.db.commit()
    import re
    def parse(date):
        m = re.match(r"^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$", date) if isinstance(date, str) else None
        if m: date = "{2}-{1:0>2}-{0:0>2}".format(m.group(1), m.group(2), m.group(3))
        return str(frappe.utils.getdate(date))
    ok("a text date 05-10-2026 is 5 October", parse("05-10-2026") == "2026-10-05" and parse("5/10/2026") == "2026-10-05" and parse("2026-10-05") == "2026-10-05", parse("05-10-2026"))
    print("RES SUMMARY", sum(R), "of", len(R))
main()
