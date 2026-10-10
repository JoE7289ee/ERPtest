# UI walk, second round: a cancelled card is not Ordering Desk backlog; a piece away at
# certification or hallmarking is not "In stock" on Track. Read-only except one rolled-back flip.
import frappe
def main():
	from jewelima.jewelima import api
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		away = frappe.db.count("Order Bag", {"stock_status": ["in", ["At Certification", "At Hallmarking"]]})
		t = api.get_order_tracker(limit=500)
		k = t.get("kpi") or {}
		print("RES tracker kpis", {x: k[x] for x in k if "cert" in x or "stock" in x}, "| away in the books", away)
		assert k.get("at_cert") == away, (k, away)
		rows = api.get_order_tracker(limit=500, stage="At Certification").get("rows") or []
		print("RES tracker filter At Certification rows", len(rows))
		assert all((r.get("stage") in ("At Certification", "At Hallmarking")) for r in rows)
		instock = api.get_order_tracker(limit=500, stage="In Stock").get("rows") or []
		assert not any(r.get("status") in ("At Certification", "At Hallmarking") for r in instock)
		d0 = api.get_ordering_workstation()
		k0 = d0["kpis"]
		card = frappe.db.sql("select name from `tabOrder Bag` where location='ORDERING' and is_finished=0 and ifnull(stock_status,'')!='Cancelled' limit 1")
		if card:
			frappe.db.set_value("Order Bag", card[0][0], "stock_status", "Cancelled")
			d1 = api.get_ordering_workstation(q=card[0][0])
			k1 = api.get_ordering_workstation()["kpis"]
			still = [x for x in k0 if isinstance(k0[x], int) and k0[x] - k1[x] == 1]
			print("RES cancelled", card[0][0], "| listed after cancel:", len(d1.get("rows") or d1.get("cards") or []), "| counts that dropped by one:", still)
			assert not (d1.get("rows") or d1.get("cards") or []) and still
		else:
			print("RES no card at ORDERING on this copy")
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
