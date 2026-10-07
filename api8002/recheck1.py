import sys, json; sys.path.insert(0,'.')
from jw import *
low = User("lenusthomas@jd.in")
T = [("transfer a card", "transfer_order_bags", dict(names=["E7617.4.1"], to_location="CAD")),
 ("assign at a bench", "assign_bench_cards", dict(names=["E7617.4.1"], location="WAXING")),
 ("collect at a bench", "collect_bench_cards", dict(names=["E7617.4.1"], location="WAXING")),
 ("issue at a bench", "issue_bench_cards", dict(names=["E7617.4.1"], location="GRINDING")),
 ("receipt at a bench", "receipt_bench_cards", dict(lines=[], location="GRINDING")),
 ("return stones", "stone_return_apply", dict(order_bag="E7617.3.1", lines=[{"item": "VVS-EF 2-2.5", "pcs": 1, "ct": 0.009}])),
 ("make a tree", "make_tree", dict(karat="18KYG", names=["E7617.4.1"])),
 ("book cast gold", "cast_weigh", dict(tree="T-18Y-004", entries=[])),
 ("make a product", "make_products", dict(bags=["E7619.1.3"], bucket="FEMI")),
 ("change a holder", "transfer_holder", dict(bags=["E7619.1.1"], to_customer="JD Stock")),
 ("prep a certification", "cert_prep_create_full", dict(cert_type="IGI", quality="VVS-EF", bags=["E7619.1.1"])),
 ("send a certification", "send_cert_prep", dict(name="IGI-0005")),
 ("collect a certification", "collect_certification", dict(name="IGI-0005")),
 ("confirm a certificate", "confirm_cert_batch", dict(changes=[])),
 ("prep a hallmark batch", "hall_prep_create", dict(bags=["E7619.1.1"])),
 ("send a hallmark batch", "send_hall_prep", dict(name="HM-0007", center="GOLD MARK")),
 ("collect a hallmark batch", "collect_hallmarking", dict(name="HM-0009")),
 ("confirm a HUID", "huid_confirm_batch", dict(changes=[])),
 ("start a bag split", "start_bag_split", dict(order_bag="E7619.1.3")),
 ("move an order's dates", "update_order_dates", dict(job_order="E7617", due_date="2028-01-01")),
 ("rewrite a card's BOM", "save_bag_bom", dict(order_bag="E7617.4.1", rows=[])),
 ("book a loss", "book_loss", dict(order_bag="E7617.4.1", item="18KYG", qty=0.1)),
 ("SELL a piece", "create_product_sale", dict(payload={"customer": "AJ-KUR-TCR-KL", "lines": []})),
 ("read a price chart", "get_price_chart", dict(name="PCH-0067")),
 ("list price charts", "get_price_chart_list", {}),
 ("price a piece", "get_sale_piece", dict(barcode="E7619.1.1", price_chart="PCH-0067")),
 ("read parked sales", "get_sale_preparations", {}),
 ("read the party directory", "get_party_directory", {}),
 ("read stone stock", "get_stone_stock", {}),
 ("read finished stock", "get_finished_stock_matrix", {}),
 ("place an order", "create_job_order", dict(payload={"customer": "AJ-KUR-TCR-KL"})),
]
bad = 0
for t, m, a in T:
    try: low.call(m, **a); print("  STILL OPEN  ", t); bad += 1
    except Refused as e: print("  refused     ", t, "->", e.msg[:60])
print("still open:", bad, "of", len(T))
# what a design-bank user SHOULD still be able to do
for m in ("jewelima.jewelima.design_bank_api.get_tags", "get_quick_menu", "get_home_menu", "get_my_workstations", "get_my_account"):
    try: low.call(m); print("  works       ", m.split(".")[-1])
    except Refused as e: print("  BLOCKED     ", m.split(".")[-1], e.msg[:60])
