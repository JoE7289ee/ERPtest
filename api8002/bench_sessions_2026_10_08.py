# B0032 / B0039: a card worked twice at one bench shows both workers and both losses
# on the phone Day screen, the TV overview, the performance board and Job Work Records. Rolls back.
import frappe
def main():
	from frappe.utils import flt
	frappe.set_user("Administrator")
	from jewelima.jewelima import api
	from jewelima.jewelima.benches import BENCH_DOCTYPE
	for dt in dict.fromkeys(BENCH_DOCTYPE.values()):
		if frappe.db.exists("DocType", dt):
			frappe.db.sql("select count(*) from {0} w".format(api._bench_work_sql(dt)))
	print("RES every bench reads")
	def snap():
		d = api.get_jw_day(); tv = api.get_tv_overview(); pf = api.get_employee_performance(30)
		jw = api._m_records_all("job_work")
		fil = next((r for r in d["rows"] if r["location"] == "FILING"), {"issued": 0, "done": 0, "loss": 0})
		return {"day_done": fil["done"], "day_issued": fil["issued"], "day_loss": fil["loss"], "tv_done": tv["done_today"], "tv_loss": tv["loss_today"],
			"perf": {r["employee"]: (r["pieces"], r["loss"]) for r in pf["rows"]}, "jw_rows": jw["totals"]["records"], "jw_loss": jw["totals"]["loss"], "jw": jw["rows"]}
	before = snap()
	now = frappe.utils.now_datetime()
	emps = frappe.get_all("Employee", filters={"status": "Active"}, pluck="name", limit=2)
	ravi, suresh = emps[0], emps[1]
	v = frappe.db.sql("select name, order_bag from `tabFiling` order by creation desc limit 1", as_dict=True)[0]
	frappe.db.delete("Bench Issue", {"visit": v.name, "visit_doctype": "Filing"})
	def session(emp, out, inn, state):
		frappe.get_doc({"doctype": "Bench Issue", "order_bag": v.order_bag, "bench": "FILING", "visit": v.name, "visit_doctype": "Filing",
			"employee": emp, "status": "Receipted", "issued_at": now, "receipted_at": now, "weight_out": out, "weight_in": inn,
			"loss": round(out - inn, 3), "collection_state": state}).insert(ignore_permissions=True)
	base = snap()
	session(ravi, 12.400, 12.250, "Partial")
	session(suresh, 12.250, 12.200, "Completed")
	# the bench's own row as the app leaves it: the latest session only
	frappe.db.set_value("Filing", v.name, {"employee": suresh, "status": "Receipted", "issued_at": now, "receipted_at": now,
		"weight_out": 12.250, "weight_in": 12.200, "loss": 0.050}, update_modified=False)
	after = snap()
	def delta(k):
		return round(flt(after[k]) - flt(base[k]), 3)
	print("RES day done +", delta("day_done"), "issued +", delta("day_issued"), "loss +", delta("day_loss"))
	print("RES tv done +", delta("tv_done"), "loss +", delta("tv_loss"))
	old = [(r["who"], r["weight_out"]) for r in base["jw"] if r["card"] == v.order_bag and r["bench"] == "FILING"]
	mine = [r for r in after["jw"] if r["card"] == v.order_bag and r["bench"] == "FILING" and (r["who"], r["weight_out"]) not in old]
	print("RES job work rows for the card", [(r["who"], r["weight_out"], r["weight_in"], r["loss"]) for r in mine])
	pr = after["perf"].get(ravi, (0, 0)); pb = base["perf"].get(ravi, (0, 0))
	ps = after["perf"].get(suresh, (0, 0)); psb = base["perf"].get(suresh, (0, 0))
	print("RES perf first worker +", pr[0] - pb[0], round(pr[1] - pb[1], 3), "second +", ps[0] - psb[0], round(ps[1] - psb[1], 3))
	assert len(mine) == 2 and round(sum(r["loss"] for r in mine), 3) == 0.2
	assert pr[0] - pb[0] == 1 and round(pr[1] - pb[1], 3) == 0.15
	assert ps[0] - psb[0] == 1 and round(ps[1] - psb[1], 3) == 0.05
	assert delta("day_loss") >= 0.15 and delta("tv_loss") >= 0.15 and delta("day_done") >= 1 and delta("tv_done") >= 1
	frappe.db.rollback()
	end = snap()
	assert end["jw_rows"] == before["jw_rows"]
	print("RES unchanged after rollback; job work rows", end["jw_rows"])
	print("RES ALL PASS")
main()
