# B0014: findings go onto and come off CARDS ON THE FLOOR only; a card never gives back
# more than it holds; finished, sold, cancelled and away cards are locked. Rolls back.
import frappe
def main():
	from frappe.utils import flt
	from jewelima.jewelima import api
	from jewelima.setup import GOLD_ISSUE_WAREHOUSE, IN_PRODUCTION_WAREHOUSE
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	def refused(what, fn):
		try:
			fn()
		except Exception as e:
			print("RES refused:", what, "->", str(e)[:110])
			frappe.db.rollback(save_point="t") if False else None
			return
		raise AssertionError("NOT refused: " + what)
	try:
		shelf, bags = api._wh(GOLD_ISSUE_WAREHOUSE), api._wh(IN_PRODUCTION_WAREHOUSE)
		groups = api._finding_groups()
		item = frappe.db.sql("""select name from tabItem where item_group in %s and item_group not like '%%Common%%' limit 1""", (tuple(groups),))[0][0]
		se = frappe.get_doc({"doctype": "Stock Entry", "stock_entry_type": "Material Receipt", "company": api._company(),
			"items": [{"item_code": item, "qty": 5, "uom": "Gram", "t_warehouse": shelf, "allow_zero_valuation_rate": 1}]})
		se.flags.ignore_permissions = True
		se.insert()
		se.submit()
		gold = api._finding_gold_item(item)
		card = frappe.db.sql("""select name from `tabOrder Bag` where stock_status = 'In Production' and is_finished = 0 order by creation desc limit 1""")[0][0]
		fin = frappe.db.get_value("Order Bag", {"is_finished": 1, "stock_status": "In Stock"}, "name")
		can = frappe.db.get_value("Order Bag", {"stock_status": "Cancelled"}, "name")
		sold = frappe.db.get_value("Order Bag", {"stock_status": "Sold"}, "name")
		away = frappe.db.get_value("Order Bag", {"stock_status": ["in", ["At Certification", "At Hallmarking"]]}, "name")
		print("RES using", item, "->", gold, "card", card, "| locked:", fin, can, sold, away)
		refused("issue to a location", lambda: api.issue_finding(item, 0.5, "Location", location=bags))
		for nm, c in (("finished", fin), ("cancelled", can), ("sold", sold), ("away", away)):
			if not c:
				print("RES no", nm, "card on this copy"); continue
			refused("issue to " + nm, lambda: api.issue_finding(item, 0.5, "Card", order_bag=c))
			refused("recover from " + nm, lambda: api.recover_finding(item, 0.1, order_bag=c))
			assert api.get_recoverable_gold(c).get("error")
		refused("recover with no card", lambda: api.recover_finding(item, 0.1))
		h0 = api._card_gold_held(card, gold)
		b0 = flt(frappe.db.get_value("Bin", {"item_code": gold, "warehouse": bags}, "actual_qty"))
		s0 = flt(frappe.db.get_value("Bin", {"item_code": item, "warehouse": shelf}, "actual_qty"))
		api.issue_finding(item, 0.5, "Card", order_bag=card)
		assert round(api._card_gold_held(card, gold) - h0, 3) == 0.5
		g = api.get_recoverable_gold(card)
		row = next(r for r in g["rows"] if r["gold"] == gold)
		assert any(c["item"] == item for c in row["can_become"]) and round(row["qty"] - h0, 3) == 0.5
		refused("recover more than the card holds", lambda: api.recover_finding(item, round(h0 + 0.5 + 0.01, 3), order_bag=card))
		r = api.recover_finding(item, 0.5, order_bag=card)
		h1 = api._card_gold_held(card, gold)
		b1 = flt(frappe.db.get_value("Bin", {"item_code": gold, "warehouse": bags}, "actual_qty"))
		s1 = flt(frappe.db.get_value("Bin", {"item_code": item, "warehouse": shelf}, "actual_qty"))
		print("RES card gold", h0, "-> +0.5 ->", h1, "| in bags", round(b0, 3), round(b1, 3), "| shelf", round(s0, 3), round(s1, 3))
		assert round(h1 - h0, 3) == 0 and round(b1 - b0, 3) == 0 and round(s1 - s0, 3) == 0
		led = frappe.get_all("Bag Material Ledger", filters={"order_bag": card, "item": gold}, fields=["direction", "qty", "entry_type", "reference"], order_by="creation desc", limit=2)
		print("RES card ledger", [(l.direction, l.qty, l.entry_type) for l in led])
		assert {(l.direction, l.entry_type) for l in led} == {("In", "Gold Issue"), ("Out", "Weight Reduce")}
		rec = frappe.db.get_value("Finding Issue", r["recovery"], ["direction", "target_type", "order_bag", "location"], as_dict=True)
		assert rec.direction == "Recovery" and rec.order_bag == card and not rec.location
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
