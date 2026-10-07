def main():
    import frappe, base64, io
    from PIL import Image
    frappe.set_user("Administrator")
    from jewelima.jewelima import api, design_bank_api as dba
    R = []
    def ok(n, c, x=""): R.append(bool(c)); print("RES", "PASS" if c else "FAIL", "|", n, "|", str(x)[:150])
    nm = frappe.get_all("Design Bank", filters={"status": "Approved", "photo": ["is", "set"], "pending_photo": ["is", "not set"]}, pluck="name", limit=1)[0]
    old = frappe.db.get_value("Design Bank", nm, ["photo", "product_photo_pending"], as_dict=True)
    frappe.db.set_value("Design Bank", nm, "product_photo_pending", 1, update_modified=False); frappe.db.commit()
    b = io.BytesIO(); Image.new("RGB", (700, 700), (200, 30, 30)).save(b, "PNG")
    api.add_product_photo(nm, "data:image/png;base64," + base64.b64encode(b.getvalue()).decode())
    d = frappe.db.get_value("Design Bank", nm, ["photo", "pending_photo", "product_photo_pending", "pending_photo_by"], as_dict=True)
    ok("the photo is parked, the card's own photo untouched", d.pending_photo and d.photo == old.photo, d)
    q = {r["name"]: r for r in api.get_product_photo_queue()["rows"]}
    ok("the card stays on Photo Queue, showing what was put up", nm in q and q[nm]["pending_photo"] == d.pending_photo)
    ok("and it is on Photo Approvals", nm in [r["name"] for r in dba.get_photo_approval_queue(start=0, limit=500)["rows"]])
    dba.reject_photo_update(nm)
    d = frappe.db.get_value("Design Bank", nm, ["photo", "pending_photo", "product_photo_pending"], as_dict=True)
    ok("rejected: nothing changes on the card and it is still waiting on Photo Queue", not d.pending_photo and d.photo == old.photo and d.product_photo_pending == 1, d)
    api.add_product_photo(nm, "data:image/png;base64," + base64.b64encode(b.getvalue()).decode())
    dba.approve_photo_update(nm)
    d = frappe.db.get_value("Design Bank", nm, ["photo", "pending_photo", "product_photo_pending"], as_dict=True)
    im = Image.open(frappe.get_site_path("public", d.photo.lstrip("/"))).convert("RGB")
    ok("approved: the new photo is on the card and the card leaves Photo Queue", not d.pending_photo and d.product_photo_pending == 0 and im.getpixel((350, 350))[0] > 150 and nm not in [r["name"] for r in api.get_product_photo_queue()["rows"]], (d, im.getpixel((350, 350))))
    print("RES", "ALL PASS" if all(R) else "SOME FAILED", sum(R), "of", len(R))
main()
