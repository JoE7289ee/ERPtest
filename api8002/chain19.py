import sys, json; sys.path.insert(0,'.')
from jw import *
low, re_, jo, an = User("lenusthomas@jd.in"), User("reena@jd.in"), User("jojokk@jd.in"), User("antonysebastian@jd.in")
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:200])) if isinstance(r, dict) and (r.get("errors") or r.get("error")) and not (r.get("done") or r.get("count")) else r
print("== admin-level calls as the design-bank-only user (all must refuse)")
T = [("give himself System Manager", "set_user_roles", dict(user="lenusthomas@jd.in", roles=["System Manager"])),
 ("reset another user's password", "admin_reset_password", dict(user="reena@jd.in")),
 ("end another user's sessions", "end_user_sessions", dict(user="reena@jd.in")),
 ("create logins for employees", "create_employee_users", dict(employees=["HR-EMP-00059"])),
 ("read the login export", "get_login_export", {}),
 ("save a price chart", "save_price_chart", dict(payload={"chart_name": "ZZ", "making_rate": 1})),
 ("change the transfer matrix", "save_transfer_matrix", dict(role="Jewelima Transfer", pairs=[])),
 ("change stone issue tolerances", "save_stone_issue_tolerance", dict(values={"tol_dmd": 99})),
 ("give himself a bucket", "set_bucket_access", dict(user="lenusthomas@jd.in", bucket="FEMI", can_transfer=1)),
 ("put someone on a bench roster", "set_bench_employee", dict(bench="SETTING", employee="HR-EMP-00059", add=1)),
 ("buy gold", "post_raw_material_purchase", dict(supplier="JD Stock", warehouse="Gold Issue - JD", voucher_type="SIN", items=[{"item": "Standard Gold 999", "weight": 5, "count": 0}])),
 ("melt gold", "melt_gold", dict(warehouse="Gold Issue - JD", output_item="18KYG", output_weight=1, inputs=[{"item": "Standard Gold 999", "weight": 0.751}, {"item": "Alloy", "weight": 0.249}])),
 ("write off loss", "writeoff_loss", dict(payload={"reason": "x", "lines": []})),
 ("cancel an order card", "cancel_order_bag", dict(order_bag="E7617.2.1")),
 ("move an order's dates", "update_order_dates", dict(job_order="E7617", due_date="2027-01-01")),
 ("rewrite a card's BOM", "save_bag_bom", dict(order_bag="E7617.2.1", rows=[])),
 ("delete a design type", "delete_design_type", dict(name="CHAIN NECKLACE")),
 ("approve a product photo", "jewelima.jewelima.design_bank_api.approve_photo_update", dict(name="nope")),
 ("save the barcode layout", "save_barcode_layout", dict(layout={})),
 ("add a bench work option", "bench_work_option_add", dict(location="CAD", kind="Work Type", value="ZZ")),
 ("retire an order type", "retire_order_master", dict(kind="type", name="BULK")),
 ("add a finished bucket", "add_finished_bucket", dict(bucket_name="ZZ")),
 ("mark an order request placed", "mark_order_request_placed", dict(name="nope")),
 ("save a sale board", "save_sale_prep_board", dict(payload={"title": "zz", "rows": []})),
 ("book loss", "book_loss", dict(order_bag="E7617.2.1", item="18KYG", qty=0.1)),
]
for title, m, a in T:
    step(title, lambda: soft(low.call(m, **a)), expect_refuse=True)
print(bench('print("RES roles lenus", frappe.get_roles("lenusthomas@jd.in")[:8], "| E7617 due", frappe.db.get_value("Job Order","E7617","due_date"), "| E7617.2.1", frappe.db.get_value("Order Bag","E7617.2.1",["stock_status","location"]))'))
json.dump({"LOG": LOG}, open("chain19.json", "w"), indent=1, default=str)
