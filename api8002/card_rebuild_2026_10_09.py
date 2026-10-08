# B0098 B0114 B0101: correcting a card rebuilds its own lines on every design (SI-IJ and VS-IJ too),
# keeps lines added to a design by hand, and leaves cards already ordered alone. Rolls back.
import frappe
def main():
	import json
	from frappe.utils import flt
	from jewelima.jewelima import api
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	try:
		print("RES diamond groups", frappe.get_all("Item Group", filters={"name": ["like", "DIAMOND %"]}, pluck="name"))
		for g, t in api._CAD_TOKEN_OF_GROUP.items():
			assert t in api.DESIGN_STONE_TOKENS, (g, t)
			assert frappe.db.exists("Item Group", g), g
		for g in frappe.get_all("Item Group", filters={"name": ["like", "DIAMOND %"], "is_group": 0}, pluck="name"):
			assert g in api._CAD_TOKEN_OF_GROUP, "diamond family with no token: " + g
		it = frappe.db.get_value("Item", {"item_group": "DIAMOND SI-IJ"}, "name")
		card = api._cad_card_from_materials([{"item": "18KYG", "qty": 0, "weight": 3.2}, {"item": it, "qty": 12, "weight": 0.18}])
		print("RES CAD ring with", it, "-> token", [v for k, v in card.items() if "token" in k or "quality" in k], "name", api.design_variant_name("ZZTEST1", "18K", "SI-IJ", "YG"))
		# a card with an EF and an SI-IJ design
		row = frappe.db.sql("""select d.design_bank, count(*) n from tabDesign d join `tabDesign Bank` b on b.name = d.design_bank
			where d.status = 'Active' and b.status = 'Approved' and d.name like '%%-EF'
			and exists (select 1 from `tabDesign Bank Stone` s where s.parent = b.name) group by d.design_bank limit 1""", as_dict=True)[0]
		bank = frappe.get_doc("Design Bank", row.design_bank)
		ef = frappe.get_all("Design", filters={"design_bank": bank.name, "status": "Active", "name": ["like", "%-EF"]}, pluck="name")[0]
		ident = api._variant_identity(bank, ef)
		si_name = api.design_variant_name(bank.design_no, ident[0], "SI-IJ", ident[2])
		if not frappe.db.exists("Design", si_name):
			src = frappe.get_doc("Design", ef)
			seed = api._variant_seed(bank, ident[0], "SI-IJ", ident[2])
			si = frappe.copy_doc(src)
			si.set("materials", [{"item": m["item"], "qty": m["qty"], "weight": m["weight"]} for m in seed])
			si.item = None; si.bom = None
			si.flags.jw_reseed_from_card = True
			si.insert(ignore_permissions=True, set_name=si_name)
		assert api._variant_identity(bank, si_name) == (ident[0], "SI-IJ", ident[2]), api._variant_identity(bank, si_name)
		# a line added by hand on the EF design
		extra = frappe.db.get_value("Item", {"stone_type": "Color Stone"}, "name") or "CS"
		d = frappe.get_doc("Design", ef)
		d.append("materials", {"item": extra, "qty": 4, "weight": 0.2})
		d.flags.jw_reseed_from_card = True
		d.save(ignore_permissions=True)
		gold = lambda nm: next(flt(m.weight) for m in frappe.get_doc("Design", nm).materials if not frappe.db.get_value("Item", m.item, "stone_type"))
		g_ef, g_si = gold(ef), gold(si_name)
		# a card already ordered in the EF design
		ot = frappe.get_all("Order Type", pluck="name", limit=1)[0]
		placed = api.place_order(json.dumps({"customer": "JD Stock", "order_type": ot, "lines": [{"design": ef, "qty": 1}]}))
		bag = frappe.get_doc("Order Bag", placed["bags"][0])
		bag_plan = [(r.item, flt(r.qty), flt(r.weight)) for r in bag.bag_bom]
		# correct the card: +0.4 g and one stone line dropped
		seeded = api._variant_seed_items(bank)
		gone = bank.stones[-1] if len(bank.stones) > 1 else None
		bank.gross_weight = flt(bank.gross_weight) + 0.4
		if gone:
			bank.remove(gone)
		bank.save(ignore_permissions=True)
		rebuilt, skipped = api._rebuild_bank_variants(bank, seeded)
		print("RES rebuilt", rebuilt, "skipped", skipped)
		assert ef in rebuilt and si_name in rebuilt and not skipped
		print("RES gold EF", g_ef, "->", gold(ef), "| SI-IJ", g_si, "->", gold(si_name))
		assert gold(ef) > g_ef and gold(si_name) > g_si
		after = [(m.item, flt(m.qty), flt(m.weight)) for m in frappe.get_doc("Design", ef).materials]
		assert (extra, 4.0, 0.2) in after, after
		print("RES hand-added line kept:", [a for a in after if a[0] == extra], "| lines now", len(after), "cs_no", frappe.db.get_value("Design", ef, "cs_no"))
		if gone:
			fam_items = [a[0] for a in after]
			was_only = seeded[ef] - {m.get("item") for m in api._variant_seed(bank, *ident)}
			print("RES the card's dropped stone line left the design:", [i for i in was_only], [i in fam_items for i in was_only])
			assert not any(i in fam_items for i in was_only)
		now = [(r.item, flt(r.qty), flt(r.weight)) for r in frappe.get_doc("Order Bag", bag.name).bag_bom]
		assert now == bag_plan
		print("RES the card already ordered is unchanged:", len(now), "lines")
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
