def main():
    import frappe, os
    from frappe.utils.password import set_encrypted_password, get_decrypted_password
    frappe.set_user("Administrator")
    from jewelima.jewelima import agent_api as aa
    aa.ensure_role(); frappe.db.commit()
    email = "zzt.reader@jd.in"
    if frappe.db.exists("User", email): frappe.delete_doc("User", email, ignore_permissions=True, force=True)
    u = frappe.get_doc({"doctype": "User", "email": email, "first_name": "ZZT reader", "send_welcome_email": 0, "user_type": "Website User", "enabled": 1})
    u.flags.ignore_permissions = True; u.insert()
    u.add_roles(aa.READER_ROLE)
    key, secret = frappe.generate_hash(length=15), frappe.generate_hash(length=32)
    frappe.db.set_value("User", email, "api_key", key)
    set_encrypted_password("User", email, secret, "api_secret")
    frappe.db.commit()
    ok = get_decrypted_password("User", email, "api_secret") == secret
    fd = os.open("/tmp/zzt_reader.env", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.write(fd, "T_KEY={0}\nT_SECRET={1}\n".format(key, secret).encode()); os.close(fd)
    # a tag of three approved designs with photos, one pending, one retired-looking
    if not frappe.db.exists("Design Tag", "ZZT Reader Tag"): frappe.get_doc({"doctype": "Design Tag", "tag_name": "ZZT Reader Tag", "color": "#888888"}).insert(ignore_permissions=True)
    frappe.db.delete("Design Bank Tag", {"tag": "ZZT Reader Tag"})
    ap = frappe.get_all("Design Bank", filters={"status": "Approved", "photo": ["is", "set"]}, pluck="name", limit=3)
    pe = frappe.get_all("Design Bank", filters={"status": "Pending"}, pluck="name", limit=1)
    for n in ap + pe:
        frappe.get_doc({"doctype": "Design Bank Tag", "parent": n, "parenttype": "Design Bank", "parentfield": "tags", "tag": "ZZT Reader Tag", "idx": 99}).db_insert()
    frappe.db.commit()
    frappe.cache.delete("agent_rate|gallery|" + email)
    print("RES made", email, "roles", frappe.get_roles(email), "secret round-trips", ok, "approved", len(ap), "pending", len(pe), "user_type", frappe.db.get_value("User", email, "user_type"), "has password", bool(frappe.db.sql("select 1 from `__Auth` where doctype='User' and name=%s and fieldname='password'", email)))
main()
