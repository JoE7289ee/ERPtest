def main():
    import frappe, json
    frappe.set_user("Administrator")
    from jewelima.jewelima import api
    R = []
    def ok(n, c, x=""): R.append(bool(c)); print("RES", "PASS" if c else "FAIL", "|", n, "|", str(x)[:200])
    before = frappe.db.sql("select name, item, bom, design_bank from tabDesign", as_dict=True)
    bags0 = dict(frappe.db.sql("select name, design from `tabOrder Bag` where ifnull(design,'')!=''"))
    exp = {d.name: api._variant_new_name(d.name) for d in before}
    print("RES before", len(before), "to rename", sum(1 for v in exp.values() if v), "cards", len(bags0), list(exp.items())[:3])
    from jewelima.patches import variant_names_v2
    variant_names_v2.execute(); frappe.db.commit()
    after = {d.name: d for d in frappe.db.sql("select name, design_name, item, bom from tabDesign", as_dict=True)}
    ok("same number of designs", len(after) == len(before), (len(before), len(after)))
    ok("none left in the old form", not [n for n in after if api._variant_new_name(n)], [n for n in after if api._variant_new_name(n)][:5])
    ok("each design, its item and its BOM carry the new name", all(d.design_name == n and (not d.item or d.item == n or not api._variant_parts(n)) and (not d.bom or n in d.bom or not api._variant_parts(n)) for n, d in after.items()), [(n, d.item, d.bom) for n, d in after.items() if d.item and d.item != n][:3])
    ok("items and BOMs exist under the new names", all(frappe.db.exists("Item", d.item) for d in after.values() if d.item) and all(frappe.db.exists("BOM", d.bom) for d in after.values() if d.bom))
    bags1 = dict(frappe.db.sql("select name, design from `tabOrder Bag` where ifnull(design,'')!=''"))
    ok("every card follows its variant to the new name", all(bags1.get(b) == (exp.get(d) or d) for b, d in bags0.items()), [(b, d, bags1.get(b)) for b, d in bags0.items() if bags1.get(b) != (exp.get(d) or d)][:3])
    ok("no card points at a design that is not there", frappe.db.sql("select count(*) from `tabOrder Bag` b where ifnull(b.design,'')!='' and not exists (select 1 from tabDesign d where d.name=b.design)")[0][0] == 0)
    for dt in ("Hallmarking Item", "Certification Item", "Sale Preparation Item", "Product Sale Item", "Order Request Item", "CAD Sheet Record", "Design Bank Design Link"):
        n = frappe.db.sql("select count(*) from `tab{0}` x where ifnull(x.design,'')!='' and not exists (select 1 from tabDesign d where d.name=x.design)".format(dt))[0][0]
        ok("no orphan in " + dt, n == 0, n)
    variant_names_v2.execute()
    ok("running it again changes nothing", {d.name for d in frappe.db.sql("select name from tabDesign", as_dict=True)} == set(after))
    card = frappe.db.sql("select b.name, b.design_no from `tabDesign Bank` b where b.status='Approved' and b.design_no not like '%%-%%' limit 1", as_dict=True)[0]
    ok("new names are built in the new form", api.design_variant_name(card.design_no, "18K", "GH", "PG").endswith("-18P-GH") and api.design_variant_name(card.design_no, "22K", "CZ").endswith("-22Y-CZ") and api.design_variant_name(card.design_no, "18K", "", "YG").endswith("-18Y"), api.design_variant_name(card.design_no, "22K"))
    ok("both forms read the same", api._variant_parts("A1-18GH-P") == api._variant_parts("A1-18P-GH") == ("18K", "PG", "GH") and api._variant_tokens("A1-22CZ") == {"stone_family": "CZ", "gold_color": "YG"} and api._variant_parts("JS-18") is None, (api._variant_parts("A1-18GH-P"), api._variant_tokens("A1-22CZ")))
    v = [n for n in after if api._variant_parts(n)][:1]
    if v:
        bank = frappe.db.get_value("Design", v[0], "design_bank"); c = frappe.get_doc("Design Bank", bank) if bank else None
        ok("a card still recognises its own variant", c and api._variant_identity(c, v[0]), (v[0], c and api._variant_identity(c, v[0])))
        r = api.resolve_design_variant(bank, *[api._variant_identity(c, v[0])[i] for i in (0, 1, 2)])
        ok("asking for the same variant finds it, makes no second one", (r.get("name") or r.get("design")) == v[0] if isinstance(r, dict) else r == v[0], str(r)[:150])
    print("RES", "ALL PASS" if all(R) else "SOME FAILED", sum(R), "of", len(R))
main()
