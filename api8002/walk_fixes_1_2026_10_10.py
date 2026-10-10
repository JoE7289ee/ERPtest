# UI walk, first round: old variant names put right, Bench Work Setup reads work sessions,
# minus figures refused. Rolls back.
import frappe
def main():
	import json
	from frappe.utils import flt
	from jewelima.jewelima import api
	frappe.set_user("Administrator")
	real = frappe.db.commit
	frappe.db.commit = lambda *a, **k: None
	def refused(what, fn):
		try:
			fn()
		except Exception as e:
			print("RES refused:", what, "->", str(e)[:90]); return
		raise AssertionError("NOT refused: " + what)
	try:
		# 1a — names left on the old form
		d = frappe.get_all("Design", filters={"name": ["like", "%-18P-EF"]}, pluck="name", limit=1)[0]
		old = d[:-len("-18P-EF")] + "-18EF-P"
		assert api._variant_new_name(old) == d
		tree = frappe.db.sql("select name from `tabWax Tree Card` limit 1")[0][0]
		frappe.db.sql("update `tabWax Tree Card` set design = %s where name = %s", (old, tree))
		from jewelima.patches import variant_names_left_behind as pt
		pt.execute()
		assert frappe.db.get_value("Wax Tree Card", tree, "design") == d
		left = sum(frappe.db.sql("select count(*) from `tab{0}` where `{1}` regexp '-(14|18|22)(CZ|CVD|EF|GH|FG|SI)'".format(dt, col))[0][0] for dt, col in pt.PLAIN)
		print("RES old-form names left in baskets, tree cards and stone changes:", left)
		assert left == 0
		# 1b — a work type still on an earlier session is in use
		v = frappe.db.sql("select name, order_bag from `tabFiling` order by creation desc limit 1", as_dict=True)[0]
		opt = frappe.get_doc({"doctype": "Bench Work Option", "bench": "FILING", "kind": "Work Type", "value": "ZZ Test Work"}).insert(ignore_permissions=True)
		assert api._bench_option_usage("FILING", "Work Type", "ZZ Test Work") == 0
		frappe.get_doc({"doctype": "Bench Issue", "order_bag": v.order_bag, "bench": "FILING", "visit": v.name, "visit_doctype": "Filing",
			"status": "Receipted", "work_type": "ZZ Test Work", "issued_at": frappe.utils.now_datetime(), "receipted_at": frappe.utils.now_datetime()}).insert(ignore_permissions=True)
		used = api._bench_option_usage("FILING", "Work Type", "ZZ Test Work")
		print("RES work type on an earlier session counts as used:", used)
		assert used == 1
		refused("delete a work type in use", lambda: api.bench_work_option_delete(opt.name))
		api.bench_work_option_rename(opt.name, "ZZ Test Work 2")
		assert frappe.db.count("Bench Issue", {"work_type": "ZZ Test Work 2"}) == 1 and not frappe.db.count("Bench Issue", {"work_type": "ZZ Test Work"})
		print("RES rename followed onto the work session")
		# 3 — minus figures
		t = frappe.db.sql("select name from `tabWax Tree` where ifnull(report_done,0)=0 limit 1")
		if t:
			refused("furnace sheet Cutting Bal -2", lambda: api.save_casting_report(t[0][0], 10, 9, -2, 5, 0))
			refused("furnace sheet Dust WT -1", lambda: api.save_casting_report(t[0][0], 10, 9, 1, 5, -1))
			refused("Casting WT a thousand million", lambda: api.save_casting_report(t[0][0], 1000000000, 9, 1, 5, 0))
			doc = frappe.get_doc("Wax Tree", t[0][0])
			refused("tree wax weight -3", lambda: api._apply_tree_recompute(doc, -3))
		done = frappe.db.sql("select name from `tabWax Tree` where report_done=1 limit 1")
		if done:
			refused("rewrite a completed furnace sheet", lambda: api.save_casting_report(done[0][0], 10, 9, 1, 5, 0))
		refused("customer stone taken in with -3 pieces", lambda: api.receive_customer_stone("ZZ Test", frappe.get_meta("Customer Stone").get_field("bucket").options.split("\n")[0], "x", 0.2, pcs=-3))
		cs = frappe.db.sql("select name from `tabCustomer Stone` where status in ('In House','Partly Issued') limit 1")
		bag = frappe.db.sql("select name from `tabOrder Bag` where stock_status='In Production' and is_finished=0 limit 1")[0][0]
		if cs:
			refused("customer stone issued with -2 pieces", lambda: api.issue_customer_stone(cs[0][0], bag, pcs=-2))
		sv = frappe.get_all("Diamond Sieve", fields=["name", "mm_size", "avg_cts", "cvd_avg_cts", "cz_avg_cts", "sw_avg_cts"], limit=1)[0]
		refused("sieve average -0.01", lambda: api.save_sieve_chart(json.dumps([dict(sv, avg_cts=-0.01)])))
		assert api.save_sieve_chart(json.dumps([dict(sv)]))["saved"] == 1
		print("RES ALL PASS")
	finally:
		frappe.db.commit = real
		frappe.db.rollback()
main()
