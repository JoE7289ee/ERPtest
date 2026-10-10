# UI walk: a lot's Rejected does not count carats waiting in a purchase request. Rolls back.
import frappe
def main():
	from frappe.utils import flt
	from jewelima.jewelima import api
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		rows = frappe.db.sql("""select l.name, l.actual_cts, l.selected_cts, l.rejected_cts, ifnull(l.unassorted_returned_cts,0) ub,
			(select sum(i.rejected_cts) from `tabStone Lot Sieve` i where i.parent = l.name) tray_rej
			from `tabStone Lot` l where exists (select 1 from `tabStone Purchase Request` r where r.stone_lot = l.name and r.request_type='Purchase' and r.status='Pending')""", as_dict=True)
		for r in rows:
			d = frappe.get_doc("Stone Lot", r.name)
			print("RES", r.name, "rejected shown", flt(r.rejected_cts), "| tray rejection", flt(r.tray_rej), "| waiting in a request", d._pending_purchase_cts(), "| after fix", api._lot_set_rejected(r.name))
			assert abs(api._lot_set_rejected(r.name) - (flt(r.tray_rej) + flt(r.ub))) < 0.0006, r.name
			d.reload(); d.save(ignore_permissions=True)
			assert abs(flt(d.rejected_cts) - (flt(r.tray_rej) + flt(r.ub))) < 0.0006
		print("RES lots with a request waiting:", len(rows), "- Rejected equals the tray's rejection on each, and stays so on save")
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
