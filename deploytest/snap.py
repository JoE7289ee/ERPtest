def main():
    import frappe, json, hashlib, os
    TAG = open("/home/frappe/snap_tag").read().strip()
    SKIP = {"modified", "modified_by", "creation", "owner", "_user_tags", "_comments", "_assign", "_liked_by"}
    core = ["Warehouse", "Item Group", "Role", "Custom Field", "Property Setter", "Has Role", "Custom DocPerm", "DocPerm", "Workspace",
        "Workspace Sidebar", "Workspace Sidebar Item", "UOM", "Item", "Customer Group", "Supplier Group", "Territory", "Price List", "Company",
        "Mode of Payment", "Account", "Cost Center", "Naming Series", "Print Format", "Letter Head", "User", "Employee", "Customer", "Supplier",
        "Page", "Report", "Stock Entry Type", "Item Attribute", "Item Attribute Value", "Brand", "Number Card", "Dashboard Chart", "Scheduled Job Type"]
    dts = frappe.get_all("DocType", filters={"module": ["in", ["Jewelima"]]}, fields=["name", "issingle", "istable"])
    names = [(d.name, d.issingle) for d in dts] + [(c, 0) for c in core if frappe.db.exists("DocType", c)]
    out = {}
    for dt, single in names:
        try:
            if single:
                rows = frappe.db.sql("select field, value from tabSingles where doctype=%s", dt)
                out[dt] = {"__single__": {f: v for f, v in rows if f not in SKIP}}
                continue
            if not frappe.db.table_exists(dt): continue
            cols = [c for c in frappe.db.get_table_columns(dt) if c not in SKIP]
            n = frappe.db.count(dt)
            if n > 60000: out[dt] = {"__count__": n}; continue
            rows = frappe.db.sql("select `{0}` from `tab{1}`".format("`,`".join(cols), dt), as_dict=True)
            keyf = (lambda r: r["name"]) if not frappe.get_meta(dt).istable else (lambda r: "{0}|{1}|{2}|{3}".format(r.get("parenttype"), r.get("parent"), r.get("parentfield"), r.get("idx")))
            d = {}
            for r in rows:
                v = {k: (str(x) if x is not None else None) for k, x in r.items() if k != "name" or not frappe.get_meta(dt).istable}
                d[keyf(r)] = v
            out[dt] = d
        except Exception as e:
            out[dt] = {"__error__": str(e)[:200]}
    json.dump(out, open("/home/frappe/snap_%s.json" % TAG, "w"))
    print("RES snap", TAG, len(out), sum(len(v) for v in out.values()), os.path.getsize("/home/frappe/snap_%s.json" % TAG) // 1024, "KB", [k for k, v in out.items() if "__error__" in v][:5])
main()
