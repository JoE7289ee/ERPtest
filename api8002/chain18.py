import sys, json; sys.path.insert(0,'.')
from jw import *
low, sh, ni = User("lenusthomas@jd.in"), User("sheeja@jd.in"), User("nimaks@jd.in")
M = json.load(open("chain17.json"))["M"]
soft = lambda r: (_ for _ in ()).throw(Refused(200, json.dumps(r, default=str)[:260])) if isinstance(r, dict) and r.get("errors") and not (r.get("done") or r.get("count") or r.get("transferred")) else r
def state(): return bench(f'''
rows = frappe.db.sql("select name, qty, split_of, piece_no, location, act_gross_weight g, act_nett_weight n, act_dmd_no dn, act_dmd_weight dw from `tabOrder Bag` where name like %s order by name", "{M.rsplit('.',1)[0]}%", as_dict=True)
for r in rows: print("RES", dict(r))
led = frappe.db.sql("select order_bag, item, round(sum(case when direction='In' then qty else -qty end),4) from `tabBag Material Ledger` where order_bag like %s group by 1,2 order by 1,2", "{M.rsplit('.',1)[0]}%")
print("RES held", led)
q = lambda it, wh: flt(frappe.db.get_value("Bin", {{"item_code": it, "warehouse": wh}}, "actual_qty"))
print("RES bins 18KYG InBags", q("18KYG","In Bags - JD"), "2-2.5 InBags", q("VVS-EF 2-2.5","In Bags - JD"))
''')
for l in state(): print(l)
P = lambda golds: [{"items": [{"item": "18KYG", "qty": 0, "weight": g}, {"item": "VVS-EF 2-2.5", "qty": 12, "weight": 0.108}, {"item": "VVS-EF 3-3.5", "qty": 6, "weight": 0.066}]} for g in golds]
step("split before pressing Start (must refuse)", lambda: ni.call("split_bag", order_bag=M, pieces=P([2.6, 2.5, 2.596])), expect_refuse=True)
guarded("press Start on the split", low, ni, "start_bag_split", order_bag=M)
step("split assigning MORE gold than the bag holds (must refuse)", lambda: ni.call("split_bag", order_bag=M, pieces=P([3.0, 3.0, 3.0])), expect_refuse=True)
r = step("split assigning LESS gold than the bag holds (7.500 of 7.696) - where does 0.196 g go?", lambda: ni.call("split_bag", order_bag=M, pieces=P([2.5, 2.5, 2.5])))
print(json.dumps(r, default=str)[:500])
for l in state(): print(l)
json.dump({"LOG": LOG, "GAPS": GAPS}, open("chain18.json", "w"), indent=1, default=str)
