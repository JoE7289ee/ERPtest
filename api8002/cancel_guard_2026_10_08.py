# B0031: a card cancels only when it is with nobody and holds nothing. Rolls back.
import frappe
from frappe.utils import flt
def main():
	frappe.set_user("Administrator")
	from jewelima.jewelima import api
	live = {"stock_status": ["not in", ["Cancelled", "Sold", "In Stock", "At Hallmarking", "At Certification"]], "is_finished": 0}
	issued = frappe.db.sql("""select bi.order_bag from `tabBench Issue` bi join `tabOrder Bag` b on b.name = bi.order_bag
		where bi.status in ('Issued','Ongoing') and b.is_finished = 0 and b.stock_status not in ('Cancelled','Sold','In Stock') limit 1""")
	if issued:
		bag = frappe.get_doc("Order Bag", issued[0][0])
		why = api._cancel_guard(bag)
		print("RES issued card", bag.name, "->", why)
		assert why and "receipt" in why
		try:
			api.cancel_order_bag(bag.name); print("RES FAIL issued card cancelled")
		except Exception as e:
			print("RES issued refused OK")
		frappe.db.rollback()
	else:
		print("RES no issued card on this copy")
	loaded = empty = None
	for n in frappe.get_all("Order Bag", filters=live, pluck="name", order_by="creation desc", limit=400):
		if api._any_open_bench_issue(n):
			continue
		mats, _w = api._cancel_materials(n)
		if mats and not loaded:
			loaded = n
		if not mats and not empty:
			empty = n
		if loaded and empty:
			break
	print("RES picked loaded", loaded, "empty", empty)
	bag = frappe.get_doc("Order Bag", loaded)
	why = api._cancel_guard(bag)
	print("RES loaded card ->", why)
	assert why and "take all materials out" in why
	se0 = frappe.db.count("Stock Entry")
	try:
		api.cancel_order_bag(loaded); print("RES FAIL loaded card cancelled")
	except Exception as e:
		print("RES loaded refused OK")
	frappe.db.rollback()
	assert frappe.db.get_value("Order Bag", loaded, "stock_status") != "Cancelled"
	assert frappe.db.count("Stock Entry") == se0
	assert api._cancel_guard(frappe.get_doc("Order Bag", empty)) is None
	jo = frappe.db.get_value("Order Bag", loaded, "job_order")
	st = api.get_cancel_job_order(jo)
	print("RES job order of loaded card can_cancel", st["can_cancel"], "blocked", len(st["blocked"]))
	assert not st["can_cancel"]
	orig = frappe.get_all("Order Bag", fields=["name"], limit=1)
	import json
	real = api._cancel_one_bag.__globals__["frappe"].db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		r = api.cancel_order_bag(empty)
		print("RES empty card cancelled", r, frappe.db.get_value("Order Bag", empty, "stock_status"))
		assert frappe.db.get_value("Order Bag", empty, "stock_status") == "Cancelled"
		d = api.get_jw_day()
		print("RES day screen ok", type(d).__name__)
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
	print("RES after rollback", frappe.db.get_value("Order Bag", empty, "stock_status"))
	print("RES ALL PASS")
main()
