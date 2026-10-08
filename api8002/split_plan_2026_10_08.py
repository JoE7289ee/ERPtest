# B0016: pieces cut from a card carry the card's own (edited) plan; a plan that cannot be
# shared out equally refuses the split. Rolls back.
import frappe
def main():
	from frappe.utils import flt
	from jewelima.jewelima import api
	from jewelima.jewelima.benches import bench_doctype
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		dt = bench_doctype("BAG EXTRACTION")
		cand = frappe.db.sql("""select b.name from `tabOrder Bag` b where b.qty between 2 and 4 and b.is_finished = 0
			and b.stock_status not in ('Cancelled','Sold') and ifnull(b.split_of,'') = ''
			and exists (select 1 from `tabOrder Bag BOM Item` r join tabItem i on i.name = r.item
				where r.parent = b.name and ifnull(i.stone_type,'') != '') order by b.creation desc limit 1""")
		card = cand[0][0]
		bag = frappe.get_doc("Order Bag", card)
		n = int(bag.qty)
		design = [(m.item, flt(m.qty), flt(m.weight)) for m in frappe.get_doc("Design", bag.design).materials]
		# edit the card's plan so it no longer matches the catalogue design
		for r in bag.bag_bom:
			if frappe.db.get_value("Item", r.item, "stone_type"):
				r.qty = round(flt(r.qty)) + 2
			else:
				r.weight = round(flt(r.weight) + 1.2, 3)
		bag.location = "BAG EXTRACTION"
		bag.save(ignore_permissions=True)
		plan = [(r.item, flt(r.qty), flt(r.weight)) for r in bag.bag_bom]
		assert plan != design
		if not frappe.db.exists(dt, {"order_bag": card}):
			frappe.get_doc({"doctype": dt, "order_bag": card, "bench": dt, "status": "In Queue"}).insert(ignore_permissions=True)
		else:
			frappe.db.set_value(dt, {"order_bag": card}, "status", "In Queue")
		# a stone line that is not whole to a piece: refused at scan and at split
		stone = next(r for r in bag.bag_bom if frappe.db.get_value("Item", r.item, "stone_type"))
		keep = stone.qty
		frappe.db.set_value("Order Bag BOM Item", stone.name, "qty", keep + 0.5)
		g = api.get_bag_for_split(card)
		print("RES uneven plan at scan ->", g.get("error"))
		assert g.get("error") and "cannot be split equally" in g["error"]
		api.start_bag_split(card)
		try:
			api.split_bag(card, [{"items": []} for _ in range(n)])
			print("RES FAIL uneven plan was split")
		except Exception as e:
			print("RES uneven plan at split refused OK")
		frappe.db.set_value("Order Bag BOM Item", stone.name, "qty", keep)
		g = api.get_bag_for_split(card)
		assert not g.get("error"), g.get("error")
		try:
			api.split_bag(card, [{"items": []} for _ in range(n + 1)])
			print("RES FAIL wrong piece count was split")
		except Exception as e:
			print("RES wrong piece count refused OK")
		pieces = [{"items": [{"item": it["item"], "qty": it["per_piece"][j]["qty"], "weight": it["per_piece"][j]["weight"]} for it in g["items"]]} for j in range(n)]
		api.split_bag(card, pieces)
		kids = frappe.get_all("Order Bag", filters={"split_of": card}, pluck="name", order_by="name")
		print("RES split", card, "into", 1 + len(kids), "of", n)
		assert len(kids) == n - 1
		parent = frappe.db.get_value("Order Bag", card, ["nett_weight", "dmd_no", "cz_no", "gross_weight"], as_dict=True)
		for k in kids:
			kp = [(r.item, flt(r.qty), flt(r.weight)) for r in frappe.get_all("Order Bag BOM Item", filters={"parent": k, "parenttype": "Order Bag"}, fields=["item", "qty", "weight"], order_by="idx")]
			assert kp == plan, (k, kp, plan)
			assert kp != design
			kv = frappe.db.get_value("Order Bag", k, ["nett_weight", "dmd_no", "cz_no", "gross_weight"], as_dict=True)
			assert kv == parent, (kv, parent)
		print("RES every piece carries the edited plan; plan weights equal the first piece", dict(parent))
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
