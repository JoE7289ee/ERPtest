# B0122: a stone count writes off the DIFFERENCE the counter saw, on top of whatever the books
# say at approval, so an issue made in between is not erased. Rolls back.
import frappe
def main():
	import json
	from frappe.utils import flt
	from jewelima.jewelima import api
	from jewelima.setup import IN_PRODUCTION_WAREHOUSE
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		wh = api._stone_adjust_wh()
		rows = [r for r in api.get_stone_adjust_stock()["rows"] if r["stock"] >= 2]
		it, it2 = rows[0]["item"], rows[1]["item"]
		bin_ = lambda i: round(flt(frappe.db.get_value("Bin", {"item_code": i, "warehouse": wh}, "actual_qty")), 3)
		b0 = bin_(it)
		assert api.get_stone_book(it)["stock"] == b0
		# 10:00 the tray is weighed 0.200 light against the book of that moment
		# 10:20 the stone desk issues 0.500 ct of it
		api._stock_move(it, 0.5, wh, api._wh(IN_PRODUCTION_WAREHOUSE))
		assert bin_(it) == round(b0 - 0.5, 3)
		# 10:40 the count is submitted with the figures the counter saw
		r = api.create_stone_adjustment(json.dumps([{"item": it, "counted": round(b0 - 0.2, 3), "book": b0, "pcs": 0}]), reason="test count")
		doc = frappe.get_doc("Stone Adjustment Request", r["name"])
		ln = doc.items[0]
		print("RES saved: book", ln.system_qty, "counted", ln.counted_qty, "difference", ln.difference, "| short", r["short"], "over", r["over"])
		assert flt(ln.system_qty) == b0 and round(flt(ln.difference), 3) == -0.2 and round(r["short"], 3) == 0.2 and r["over"] == 0
		a = api.approve_stone_adjustment(r["name"])
		ln.reload()
		print("RES book", b0, "-> issued 0.5 ->", round(b0 - 0.5, 3), "-> approved ->", bin_(it), "| recorded", ln.approved_from, "->", ln.approved_to)
		assert bin_(it) == round(b0 - 0.7, 3) and flt(ln.approved_from) == round(b0 - 0.5, 3) and flt(ln.approved_to) == round(b0 - 0.7, 3)
		# a line with no book figure sent still works, against the book at submit
		c0 = bin_(it2)
		r2 = api.create_stone_adjustment(json.dumps([{"item": it2, "counted": round(c0 + 0.1, 3)}]), reason="test count 2")
		api.approve_stone_adjustment(r2["name"])
		assert bin_(it2) == round(c0 + 0.1, 3)
		print("RES over count:", c0, "->", bin_(it2))
		# more to come off than the books now hold: refused
		c1 = bin_(it2)
		r3 = api.create_stone_adjustment(json.dumps([{"item": it2, "counted": 0.1, "book": c1}]), reason="test count 3")
		api._stock_move(it2, round(c1 - 0.05, 3), wh, api._wh(IN_PRODUCTION_WAREHOUSE))
		try:
			api.approve_stone_adjustment(r3["name"])
			raise AssertionError("went below zero")
		except AssertionError:
			raise
		except Exception as e:
			print("RES refused:", str(e)[:120])
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
