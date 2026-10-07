def main():
    import frappe, json
    from jewelima.jewelima import repair_api
    frappe.set_user("Administrator")
    party = frappe.db.get_value("Repair Party", {}, "party_name") or "TEST PARTY"
    res = repair_api.create_repair_order(json.dumps({"party": party, "narration": "TEST 2026-10-07 critical fixes",
        "items": [{"design_type": "RING", "qty": 1, "weight": 3.0, "karat": "18"}, {"design_type": "RING", "qty": 1, "weight": 4.0, "karat": "18"}]}))
    o = res.get("name") or res.get("repair_order") or frappe.db.get_value("Repair Order", {"narration": "TEST 2026-10-07 critical fixes"}, "name")
    its = [r.repair for r in frappe.get_doc("Repair Order", o).items][:2]
    repair_api.set_piece_stones(o, its[0], json.dumps([{"bucket": "CZ", "stone": "test cz", "sieve": "", "pcs": 4, "ct": 0.4}]))
    repair_api.set_piece_stones(o, its[1], json.dumps([{"bucket": "CVD", "stone": "test cvd", "sieve": "", "pcs": 3, "ct": 0.3}]))
    repair_api.set_piece_stones(o, its[0], json.dumps([{"bucket": "CZ", "stone": "test cz", "sieve": "", "pcs": 5, "ct": 0.5}]))
    got = sorted((s.repair, s.bucket, s.pcs) for s in frappe.get_doc("Repair Order", o).stones)
    print("RES", "PASS" if got == sorted([(its[0], "CZ", 5), (its[1], "CVD", 3)]) else "FAIL", "| T5 saving one repair piece leaves the other piece's stone type alone |", o, got)
main()
