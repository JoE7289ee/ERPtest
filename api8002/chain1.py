import sys, json; sys.path.insert(0,'.')
from jw import *
sh, re_, jo, ba, low = User("sheeja@jd.in"), User("reena@jd.in"), User("jojokk@jd.in"), User("balan@jd.in"), User("lenusthomas@jd.in")
DESIGN = "A13010NP-18EF-Y"
cards = [r["name"] for r in sh.get_list("Order Bag", {"location": "ORDERING", "design": DESIGN, "is_finished": 0, "stock_status": "In Production", "job_order": "E7617"}, ["name"], 10, "name asc")]
print("cards at ORDERING:", cards)
A, B = cards[0], cards[1]
print("== CARD", A, "and", B)
# wrong people first
step("design-bank user transfers a card (must refuse)", lambda: low.call("transfer_order_bags", names=[A], to_location="CAD"), expect_refuse=False)  # transfer_order_bags swallows errors per-card
step("order desk (Reena) transfers a card", lambda: re_.call("transfer_order_bags", names=[B], to_location="CAD"))
print(bench(f'print("RES", frappe.db.get_value("Order Bag", "{A}", ["location"]), frappe.db.get_value("Order Bag", "{B}", ["location"]))'))
