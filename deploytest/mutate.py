def main():
    import frappe, json
    frappe.set_user("Administrator")
    STD = {"name","creation","modified","modified_by","owner","docstatus","idx","parent","parentfield","parenttype","_user_tags","_comments","_assign","_liked_by"}
    plan = []
    dts = frappe.get_all("DocType", filters={"module": "Jewelima", "istable": 0}, fields=["name", "issingle", "is_submittable"])
    for d in dts:
        dt = d.name
        try:
            meta = frappe.get_meta(dt)
            if d.issingle:
                for f in meta.fields:
                    if f.fieldtype in ("Int", "Float", "Check", "Data", "Percent") and not f.read_only:
                        old = frappe.db.get_single_value(dt, f.fieldname)
                        new = (0 if old else 1) if f.fieldtype == "Check" else ((old or 0) + 1 if f.fieldtype in ("Int", "Float", "Percent") else (str(old or "") + "~T"))
                        frappe.db.set_single_value(dt, f.fieldname, new, update_modified=False)
                        plan.append({"dt": dt, "kind": "single", "field": f.fieldname, "old": old, "new": new})
                continue
            if d.is_submittable or not frappe.db.table_exists(dt): continue
            n = frappe.db.count(dt)
            if n < 1 or n > 400: continue
            names = frappe.get_all(dt, pluck="name", order_by="creation asc", limit=0)
            r1 = names[0]
            cols = set(frappe.db.get_table_columns(dt))
            done = 0
            for f in meta.fields:
                if done >= 3: break
                if f.fieldname not in cols or f.fieldname in STD: continue
                if meta.autoname and ("field:" + f.fieldname) == meta.autoname: continue
                if f.fieldtype in ("Data", "Small Text", "Int", "Float", "Check", "Percent", "Currency"):
                    old = frappe.db.get_value(dt, r1, f.fieldname)
                    new = (0 if old else 1) if f.fieldtype == "Check" else ((old or 0) + 1 if f.fieldtype in ("Int", "Float", "Percent", "Currency") else (str(old or "") + "~T"))
                    try:
                        frappe.db.sql("update `tab{0}` set `{1}`=%s where name=%s".format(dt, f.fieldname), (new, r1))
                        plan.append({"dt": dt, "kind": "edit", "name": r1, "field": f.fieldname, "old": old, "new": new}); done += 1
                    except Exception as e:
                        pass
            # child rows of r1: drop the last row of each table, edit the first
            for tf in meta.get_table_fields():
                rows = frappe.db.sql("select name, idx from `tab{0}` where parent=%s and parenttype=%s and parentfield=%s order by idx".format(tf.options), (r1, dt, tf.fieldname), as_dict=True)
                if len(rows) >= 2:
                    last = frappe.db.sql("select * from `tab{0}` where name=%s".format(tf.options), rows[-1].name, as_dict=True)[0]
                    frappe.db.sql("delete from `tab{0}` where name=%s".format(tf.options), rows[-1].name)
                    plan.append({"dt": dt, "kind": "childdel", "name": r1, "table": tf.fieldname, "child": tf.options, "n_before": len(rows),
                        "row": {k: str(v) for k, v in last.items() if k not in STD and v not in (None, "", 0)}})
            # delete the newest row outright
            if n >= 3:
                r2 = names[-1]
                row = frappe.db.sql("select * from `tab{0}` where name=%s".format(dt), r2, as_dict=True)[0]
                for tf in meta.get_table_fields():
                    frappe.db.sql("delete from `tab{0}` where parent=%s and parenttype=%s".format(tf.options), (r2, dt))
                frappe.db.sql("delete from `tab{0}` where name=%s".format(dt), r2)
                plan.append({"dt": dt, "kind": "delete", "name": r2, "row": {k: str(v) for k, v in row.items() if k not in STD and v not in (None, "", 0)}})
        except Exception as e:
            plan.append({"dt": dt, "kind": "error", "err": str(e)[:200]})
    frappe.db.commit()
    json.dump(plan, open("/home/frappe/mutate_plan.json", "w"), default=str)
    from collections import Counter
    print("RES plan", len(plan), Counter(p["kind"] for p in plan), len({p["dt"] for p in plan}), [p for p in plan if p["kind"] == "error"][:5])
main()
