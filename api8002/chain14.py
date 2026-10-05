import sys, json; sys.path.insert(0,'.')
from jw import *
low, fe, an, sh = User("lenusthomas@jd.in"), User("femipaul@jd.in"), User("antonysebastian@jd.in"), User("sheeja@jd.in")
A = "E7617.19.1"; CHART = "PCH-0067"
def card(c=A): return bench(f'b=frappe.db.get_value("Order Bag","{c}",["location","stock_status","bucket","held_by","huid","certifications","is_finished"],as_dict=True); print("RES", dict(b))')[0]
def bins(*pairs): return bench("q = lambda it, wh: flt(frappe.db.get_value('Bin', {'item_code': it, 'warehouse': wh}, 'actual_qty'))\nprint('RES', " + ", ".join(f"'{i}@{w.split(' - ')[0]}', q('{i}','{w}')" for i, w in pairs) + ")")[0]
print("rights  manager:", an.call("sale_rights"), " delivery:", fe.call("sale_rights"), " outsider:", low.call("sale_rights"))
p = an.call("get_sale_piece", barcode=A, price_chart=CHART, gold_rate=9000)
print(json.dumps(p, default=str)[:1400])
json.dump(p, open("salepiece.json", "w"), default=str, indent=1)
