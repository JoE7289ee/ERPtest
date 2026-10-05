def main():
    import frappe, json
    plan = json.load(open("/home/frappe/mutate_plan.json")); out = []
    for p in plan:
        dt = p["dt"]
        try:
            if p["kind"] == "single":
                cur = frappe.db.get_single_value(dt, p["field"]); p["now"] = cur
                p["verdict"] = "kept" if str(cur) == str(p["new"]) else ("REVERTED" if str(cur) == str(p["old"]) else "CHANGED")
            elif p["kind"] == "edit":
                if not frappe.db.exists(dt, p["name"]): p["verdict"] = "ROW GONE"
                else:
                    cur = frappe.db.get_value(dt, p["name"], p["field"]); p["now"] = cur
                    p["verdict"] = "kept" if str(cur) == str(p["new"]) else ("REVERTED" if str(cur) == str(p["old"]) else "CHANGED")
            elif p["kind"] == "childdel":
                n = frappe.db.count(p["child"], {"parent": p["name"], "parenttype": dt, "parentfield": p["table"]}); p["now"] = n
                p["verdict"] = "kept" if n == p["n_before"] - 1 else ("ROW CAME BACK" if n >= p["n_before"] else "CHANGED")
            elif p["kind"] == "delete":
                p["verdict"] = "CAME BACK" if frappe.db.exists(dt, p["name"]) else "kept"
            else: p["verdict"] = "error"
        except Exception as e:
            p["verdict"] = "verify-error " + str(e)[:80]
        out.append(p)
    json.dump(out, open("/home/frappe/mutate_result.json", "w"), default=str)
    from collections import Counter
    print("RES verdicts", Counter(p["verdict"] for p in out))
main()
