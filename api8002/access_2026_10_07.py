def main():
    import frappe, json, os
    from jewelima.jewelima import api
    R = []
    def ok(name, cond, extra=""):
        R.append(bool(cond)); print("RES", "PASS" if cond else "FAIL", "|", name, "|", extra)
    def refused(fn):
        try:
            fn(); frappe.db.rollback(); return False, "went through"
        except Exception as e:
            frappe.db.rollback(); frappe.clear_messages(); return True, frappe.utils.strip_html(str(e))[:110]
    mgr = frappe.db.sql("""select h.parent from `tabHas Role` h join tabUser u on u.name=h.parent where h.role='JW Manager' and h.parenttype='User' and u.enabled=1
        and h.parent not in (select parent from `tabHas Role` where role='System Manager' and parenttype='User') and h.parent!='Administrator' limit 1""")
    if not mgr:
        print("RES SKIP | no floor manager who is not a system manager"); return
    mgr = mgr[0][0]
    other = frappe.db.sql("""select u.name from tabUser u where u.enabled=1 and u.user_type='System User' and u.name not in ('Administrator','Guest',%s)
        and u.name not in (select parent from `tabHas Role` where role in ('System Manager','JW Manager') and parenttype='User') limit 1""", mgr)[0][0]
    sysm = frappe.db.sql("select parent from `tabHas Role` where role='System Manager' and parenttype='User' and parent not in ('Administrator') limit 1")
    frappe.set_user(mgr)
    r, why = refused(lambda: api.admin_reset_password("Administrator", "not-a-real-one")); ok("a floor manager cannot set Administrator's password", r, why)
    if sysm:
        r, why = refused(lambda: api.admin_reset_password(sysm[0][0], "not-a-real-one")); ok("nor a System Manager's", r, why)
    r, why = refused(lambda: api.end_user_sessions("Administrator")); ok("nor end Administrator's sessions", r, why)
    mine = [x.role for x in frappe.get_doc("User", mgr).roles]
    r, why = refused(lambda: api.set_user_roles(mgr, json.dumps(mine + ["System Manager"]))); ok("a floor manager cannot make himself System Manager", r, why)
    r, why = refused(lambda: api.set_user_roles(other, json.dumps(["JW Costing"]))); ok("nor hand out the costing role", r, why)
    r, why = refused(lambda: api.create_employee_users(json.dumps({"rows": [{"employee": "x", "username": "x"}], "roles": ["System Manager"]}))); ok("nor create a login with System Manager", r, why)
    ed = api.get_user_role_editor(other)
    ok("the role editor offers him no protected role", not (set(ed["jewelima"]) | set(ed["others"])) & api.SYSADMIN_ONLY_ROLES and ed["others"] == [], f"{len(ed['jewelima'])} roles offered")
    before = sorted(x.role for x in frappe.get_doc("User", other).roles)
    grant = next(x for x in ed["jewelima"] if x not in before and x != "JW Manager")
    api.set_user_roles(other, json.dumps([x for x in before if x in ed["jewelima"]] + [grant]))
    after = sorted(x.role for x in frappe.get_doc("User", other).roles)
    ok("he can still give an ordinary floor role, and the roles he cannot touch stay", set(after) == set(before) | {grant}, f"{other}: +{grant}; kept {len(before)} others")
    frappe.set_user("Administrator")
    api.set_user_roles(other, json.dumps(before)); frappe.db.commit()
    ok("a System Manager still manages every role", sorted(x.role for x in frappe.get_doc("User", other).roles) == before, "restored")
    d = frappe.get_doc("Design", frappe.db.get_value("Design", {}, "name")); img0 = d.image
    n0 = len(os.listdir(frappe.get_site_path("public", "files")))
    for bad in ("/files/../../site_config.json", "/files/../../../../../etc/hostname", "/files/..%2F..%2Fsite_config.json"):
        d.image = bad; d._copy_bank_image()
    frappe.db.rollback()
    ok("a design image path cannot reach outside the files folder", len(os.listdir(frappe.get_site_path("public", "files"))) == n0 and frappe.db.get_value("Design", d.name, "image") == img0, "no file copied")
    print("RES SUMMARY", sum(R), "of", len(R), "| floor manager used:", mgr)
main()
