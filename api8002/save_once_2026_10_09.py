# B0038 B0041 B0043 B0097 B0115: an order or a sheet of stock is saved whole or not at all,
# and the same page sent again is answered with what was made, never made twice. Rolls back.
import frappe
def main():
	import json
	from frappe.utils import flt
	from jewelima.jewelima import api
	frappe.set_user("Administrator")
	real = frappe.db.commit
	n = {"c": 0}
	def fake(*a, **k):
		n["c"] += 1
	frappe.db.commit = fake
	def count(dt, f=None):
		return frappe.db.count(dt, f or {})
	try:
		designs = frappe.get_all("Design", filters={"status": "Active"}, pluck="name", limit=3)
		cust = "JD Stock" if frappe.db.exists("Customer", "JD Stock") else frappe.get_all("Customer", pluck="name", limit=1)[0]
		ot = frappe.get_all("Order Type", pluck="name", limit=1)[0]
		head = {"order_date": frappe.utils.today(), "due_date": frappe.utils.add_days(frappe.utils.today(), 10), "customer": cust, "order_type": ot}
		lines = [{"design": d, "qty": 1 + i} for i, d in enumerate(designs)]
		# ---- Place Order: fails part-way -> nothing saved
		jo0, bag0 = count("Job Order"), count("Order Bag")
		n["c"] = 0
		try:
			api.place_order(json.dumps(dict(head, token="TESTTOKEN-FAIL-0001", lines=lines + [{"design": "NO-SUCH-DESIGN", "qty": 1}])))
			raise AssertionError("bad line accepted")
		except AssertionError:
			raise
		except Exception as e:
			print("RES order with a bad 4th line refused; saves before the failure:", n["c"])
		assert n["c"] == 0
		frappe.db.rollback()
		assert count("Job Order") == jo0 and count("Order Bag") == bag0
		# ---- Place Order: once, then pressed again
		n["c"] = 0
		r1 = api.place_order(json.dumps(dict(head, token="TESTTOKEN-GOOD-0001", lines=lines)))
		print("RES placed", r1["name"], r1["bags"], "saves:", n["c"])
		assert n["c"] == 1 and len(r1["bags"]) == 3 and r1["repeat"] == 0
		r2 = api.place_order(json.dumps(dict(head, token="TESTTOKEN-GOOD-0001", lines=lines)))
		print("RES pressed again ->", r2["name"], "repeat", r2["repeat"], "orders made", count("Job Order") - jo0, "cards made", count("Order Bag") - bag0)
		assert r2["name"] == r1["name"] and r2["bags"] == r1["bags"] and r2["repeat"] == 1
		assert count("Job Order") - jo0 == 1 and count("Order Bag") - bag0 == 3
		try:
			api.place_order(json.dumps(dict(head, token="TESTTOKEN-GOOD-0001", lines=lines[:2])))
			raise AssertionError("changed order under a used number accepted")
		except AssertionError:
			raise
		except Exception as e:
			print("RES same number, different lines ->", str(e)[:90])
		# ---- photos: sent twice, attached once
		px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
		a1 = api.attach_order_bag_photos(r1["bags"][0], json.dumps([px]))
		a2 = api.attach_order_bag_photos(r1["bags"][0], json.dumps([px]))
		print("RES photo first send", a1, "second send", a2)
		assert a1["attached"] == 1 and a2["attached"] == 0
		# ---- Import Stock
		gold = "18KYG"
		bucket = frappe.get_all("Finished Bucket", filters={"active": 1}, pluck="name", limit=1)[0]
		sup = frappe.get_all("Supplier", pluck="name", limit=1)[0]
		pieces = [{"design": designs[0], "karat": gold, "gold": 3.1, "gross": 3.2, "huid": "TSTHUID01"},
			{"design": designs[1], "karat": gold, "gold": 2.0, "gross": 2.0, "huid": "TSTHUID02"},
			{"design": designs[2], "karat": gold, "gold": 4.4, "gross": 4.5}]
		sheet = {"mode": "purchase", "customer": cust, "bucket": bucket, "supplier": sup, "pieces": pieces}
		jo1, bag1, pr1 = count("Job Order"), count("Order Bag"), count("Purchase Receipt")
		fg = api._wh("Finished Goods")
		q1 = flt(frappe.db.get_value("Bin", {"item_code": gold, "warehouse": fg}, "actual_qty"))
		orig = api.convert_to_ornament
		calls = {"k": 0}
		def boom(*a, **k):
			calls["k"] += 1
			if calls["k"] == 2:
				raise frappe.ValidationError("link dropped at piece 2")
			return orig(*a, **k)
		api.convert_to_ornament = boom
		n["c"] = 0
		frappe.db.savepoint("imp")
		try:
			api.import_finished_stock(json.dumps(dict(sheet, token="TESTTOKEN-IMP-00001")))
			raise AssertionError("failing import went through")
		except AssertionError:
			raise
		except Exception as e:
			print("RES import that dies at piece 2; saves before the failure:", n["c"])
		finally:
			api.convert_to_ornament = orig
		assert n["c"] == 0
		frappe.db.rollback(save_point="imp")
		assert count("Job Order") == jo1 and count("Order Bag") == bag1 and count("Purchase Receipt") == pr1
		n["c"] = 0
		i1 = api.import_finished_stock(json.dumps(dict(sheet, token="TESTTOKEN-IMP-00001")))
		print("RES imported", i1["job_order"], i1["bags"], "stock", i1["stock_doc"], "saves:", n["c"])
		assert n["c"] == 1 and len(i1["bags"]) == 3
		q2 = flt(frappe.db.get_value("Bin", {"item_code": gold, "warehouse": fg}, "actual_qty"))
		i2 = api.import_finished_stock(json.dumps(dict(sheet, token="TESTTOKEN-IMP-00001")))
		q3 = flt(frappe.db.get_value("Bin", {"item_code": gold, "warehouse": fg}, "actual_qty"))
		print("RES sent again ->", i2["job_order"], "repeat", i2["repeat"], "| gold into Finished Goods", round(q2 - q1, 3), "then", round(q3 - q2, 3), "| receipts", count("Purchase Receipt") - pr1)
		assert i2["job_order"] == i1["job_order"] and i2["bags"] == i1["bags"] and i2["repeat"] == 1 and i2["stock_doc"] == i1["stock_doc"]
		assert round(q2 - q1, 3) == 9.5 and round(q3 - q2, 3) == 0 and count("Purchase Receipt") - pr1 == 1 and count("Order Bag") - bag1 == 3
		try:
			api.import_finished_stock(json.dumps(dict(sheet, token="TESTTOKEN-IMP-00002")))
			raise AssertionError("same HUIDs under a new number accepted")
		except AssertionError:
			raise
		except Exception as e:
			print("RES same sheet from a fresh page ->", str(e)[:90])
		st = frappe.db.get_value("Order Bag", i1["bags"][0], ["stock_status", "is_finished", "bucket", "act_gross_weight"], as_dict=True)
		assert st.stock_status == "In Stock" and st.is_finished == 1 and flt(st.act_gross_weight) == 3.2
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
