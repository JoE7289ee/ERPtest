"""Critical fixes of 7 Oct 2026, through real requests on :8002: a ledger row
written by a call with no commit of its own is still saved at the end of the
request, and a batch keeps its good cards while a bad one is refused whole."""
import sys, json; sys.path.insert(0, '.')
from jw import *
adm, sh = User("Administrator"), User("sheeja@jd.in")
pick = bench('''
from jewelima.jewelima import api
from jewelima.jewelima.benches import ISSUE_RECEIPT_LOCATIONS
out = []
for nm, loc in frappe.db.sql("select name, location from `tabOrder Bag` where is_finished=0 and stock_status='In Production' and location in %s", (list(ISSUE_RECEIPT_LOCATIONS),)):
    if flt(api.get_bag_contents(nm)["gold_grams"]) > 0.5 and not api._open_bench_issue(nm, loc):
        out.append({"card": nm, "loc": loc, "item": api._bag_gold_item(nm), "gold": flt(api.get_bag_contents(nm)["gold_grams"])})
roster = {b.name: [e.employee for e in frappe.get_doc("Bench", b.name).employees][:1] for b in frappe.get_all("Bench")}
print("RES", json.dumps({"cards": out[:4], "roster": roster}))
''')
P = json.loads(pick[0]); print("cards:", P["cards"])
def truth(card, item):
    r = bench(f'''
from jewelima.jewelima import api
n = frappe.db.sql("select count(*), ifnull(sum(case when entry_type='Loss' then qty else 0 end),0) from `tabBag Material Ledger` where order_bag=%s", "{card}")[0]
b = flt(frappe.db.get_value("Bin", {{"item_code": "{item}", "warehouse": api._wh("In Bags")}}, "actual_qty"))
bi = frappe.db.sql("select status, weight_out, weight_in, loss from `tabBench Issue` where order_bag=%s order by creation desc limit 1", "{card}")
print("RES", json.dumps({{"rows": n[0], "loss": flt(n[1]), "in_bags": b, "issue": list(bi[0]) if bi else None}}, default=str))
''')
    return json.loads(r[0])
A = P["cards"][0]
t0 = truth(A["card"], A["item"])
step("a manager books a 0.001 g loss by a direct call (no commit of its own)", lambda: adm.call("book_loss", order_bag=A["card"], item=A["item"], qty=0.001, bench=A["loc"]))
t1 = truth(A["card"], A["item"])
okA = t1["rows"] == t0["rows"] + 1 and abs(t1["in_bags"] - (t0["in_bags"] - 0.001)) < 0.0005
print(("  ok   " if okA else "  BUG  ") + f"it is saved at the end of the request: rows {t0['rows']} -> {t1['rows']}, In Bags {t0['in_bags']} -> {t1['in_bags']}")
LOG.append({"step": "direct ledger call persists", "ok": okA})

B = P["cards"][1] if len(P["cards"]) > 1 else A
E = (P["roster"].get(B["loc"]) or [None])[0] or next(v[0] for v in P["roster"].values() if v)
opts = sh.call("get_bench_work_options", location=B["loc"]) or {}
wt = ((opts.get("work_types") or opts.get("Work Type") or [None]) + [None])[0]
if isinstance(wt, dict): wt = wt.get("value") or wt.get("name")
print("bench", B["loc"], "employee", E, "work type", wt)
b0 = truth(B["card"], B["item"])
r = step("issue the card at its bench", lambda: sh.call("issue_bench_cards", names=[B["card"]], location=B["loc"], employee=E, work_type=wt))
print("     ", r)
b1 = truth(B["card"], B["item"]); wout = float(b1["issue"][1]) if b1["issue"] else 0
r = step("receipt it 0.004 g light, with a card that does not exist in the same batch", lambda: sh.call("receipt_bench_cards",
    lines=[{"order_bag": B["card"], "weight_in": round(wout - 0.004, 3)}, {"order_bag": "E0000.0.0", "weight_in": 1}], location=B["loc"], employee=E))
print("     ", r)
b2 = truth(B["card"], B["item"])
okB = bool(r) and r.get("count") == 1 and len(r.get("errors") or []) == 1 and b2["issue"][0] == "Receipted" and abs(b2["loss"] - b0["loss"] - 0.004) < 0.0005 and abs(b2["in_bags"] - (b0["in_bags"] - 0.004)) < 0.0005
print(("  ok   " if okB else "  BUG  ") + f"good card received (loss {b0['loss']} -> {b2['loss']}, In Bags {b0['in_bags']} -> {b2['in_bags']}, issue {b2['issue']}), bad card refused")
LOG.append({"step": "batch receipt: good kept, bad refused", "ok": okB})
r = step("receipt the same card again (must refuse: nothing to receipt)", lambda: (lambda x: (_ for _ in ()).throw(Refused(200, str(x["errors"]))) if x.get("errors") else x)(
    sh.call("receipt_bench_cards", lines=[{"order_bag": B["card"], "weight_in": round(wout - 0.004, 3)}], location=B["loc"], employee=E)), expect_refuse=True)
b3 = truth(B["card"], B["item"])
okC = b3["rows"] == b2["rows"]
print(("  ok   " if okC else "  BUG  ") + f"and it wrote nothing more: rows {b2['rows']} -> {b3['rows']}")
LOG.append({"step": "second receipt writes nothing", "ok": okC})
json.dump({"LOG": LOG}, open("chain21.json", "w"), indent=1)
print("SUMMARY", sum(1 for l in LOG if l["ok"]), "of", len(LOG))
