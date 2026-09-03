"""One-time setup the factory seeder needs. Idempotent, site-agnostic:
    python factory_setup.py [site]   (defaults to development.localhost)
Finds the Design Bank by its readable design_no, never by hash, so the same
script sets up dev and PROD."""
import frappe, json, sys
SITE = sys.argv[1] if len(sys.argv) > 1 else "development.localhost"
frappe.init(site=SITE); frappe.connect(); frappe.set_user("Administrator")

BANK_NO = "A 13010"            # the card Reena orders 1000 times
CODE    = "A13010NP-18EF-Y"    # its 18K EF yellow variant, the way the desk resolves it
need = {"users": ["reena@jd.in", "jojokk@jd.in", "sheeja@jd.in"],
        "items": ["18KYG", "18KWG", "18KPG", "22KYG", "Standard Gold 999", "Alloy",
                  "VVS-EF 2-2.5", "VVS-EF 3-3.5"],
        "customer": "AJ-KUR-TCR-KL", "order_type": "CUSTOMER",
        "warehouses": ["Gold Issue - JD", "Stone Issue - JD", "Casting - JD", "In Bags - JD"]}
missing = []
missing += [u for u in need["users"] if not frappe.db.exists("User", u)]
missing += [i for i in need["items"] if not frappe.db.exists("Item", i)]
missing += [w for w in need["warehouses"] if not frappe.db.exists("Warehouse", w)]
if not frappe.db.exists("Customer", need["customer"]): missing.append("Customer " + need["customer"])
if not frappe.db.exists("Order Type", need["order_type"]): missing.append("Order Type " + need["order_type"])
if not frappe.get_all("Employee", filters={"status": "Active"}, limit=1): missing.append("an Active Employee")
bank = frappe.db.get_value("Design Bank", {"design_no": BANK_NO}, ["name", "design_type"], as_dict=True)
if not bank: missing.append("Design Bank " + BANK_NO)
if missing:
    print("MISSING on", SITE, "->", missing); sys.exit(1)

# ---- Balan: the stone room only. Buying is Jojo's job.
if not frappe.db.exists("User", "balan@jd.in"):
    frappe.get_doc({"doctype": "User", "email": "balan@jd.in", "first_name": "Balan",
                    "send_welcome_email": 0, "enabled": 1, "user_type": "System User"}).insert(ignore_permissions=True)
u = frappe.get_doc("User", "balan@jd.in")
u.set("roles", [r for r in u.roles if r.role != "Jewelima Purchase"])
have = {r.role for r in u.roles}
for role in ("JW Stone Admin", "Jewelima Info"):
    if role not in have: u.append("roles", {"role": role})
u.save(ignore_permissions=True)
print("Balan:", sorted(r.role for r in u.roles if r.role.startswith(("JW", "Jewelima"))))

# ---- the one design, hung on the real card
if not frappe.db.exists("Design", CODE):
    frappe.get_doc({"doctype": "Design", "design_name": CODE, "design_type": bank.design_type or "NOSEPIN",
        "design_bank": bank.name, "status": "Active",
        "materials": [
            {"item": "18KYG", "qty": 0, "weight": 2.400, "purity": 75.1, "uom": "Gram"},
            {"item": "VVS-EF 2-2.5", "qty": 12, "weight": 0.108, "uom": "Carat"},
            {"item": "VVS-EF 3-3.5", "qty": 6, "weight": 0.066, "uom": "Carat"},
        ]}).insert(ignore_permissions=True)
d = frappe.get_doc("Design", CODE)
if d.design_bank != bank.name or d.status != "Active":
    d.design_bank = bank.name; d.status = "Active"; d.save(ignore_permissions=True)
frappe.db.commit()
from jewelima.jewelima.api import variant_for_code
ok = variant_for_code(CODE)
print("Design:", d.name, "on bank", bank.name, f"({BANK_NO}, {bank.design_type}) | desk resolves it:", bool(ok.get("name")))
print("READY on", SITE)

# ---- Balan issues stones as HIMSELF: the station locks the issuer to the Employee
#      whose user_id is the login, so he needs one
if not frappe.db.get_value("Employee", {"user_id": "balan@jd.in"}, "name"):
    e = frappe.get_doc({"doctype": "Employee", "first_name": "Balan", "employee_name": "BALAN",
                        "gender": "Male", "date_of_birth": "1985-01-01", "date_of_joining": "2026-01-01",
                        "status": "Active", "user_id": "balan@jd.in",
                        "company": frappe.db.get_single_value("Global Defaults", "default_company")})
    e.insert(ignore_permissions=True)
print("Balan's employee:", frappe.db.get_value("Employee", {"user_id": "balan@jd.in"}, ["name", "employee_name"]))

# ---- the Make Tree dialog offers ONLY the TREE MAKING roster — make sure it has someone
tm = frappe.get_doc("Bench", "TREE MAKING")
if not (tm.get("employees") or []):
    emp = frappe.db.get_value("Employee", {"status": "Active", "user_id": ["in", ["", None]]}, "name")
    tm.append("employees", {"employee": emp}); tm.save(ignore_permissions=True)
print("TREE MAKING roster:", [(r.employee, frappe.db.get_value("Employee", r.employee, "employee_name")) for r in tm.get("employees")])
frappe.db.commit()

# ---- facts the spec needs to know about this site
from jewelima.jewelima.benches import ISSUE_RECEIPT_LOCATIONS, ASSIGN_COLLECT_LOCATIONS
def roster(bench):
    b = frappe.get_doc("Bench", bench)
    names = [frappe.db.get_value("Employee", r.employee, "employee_name") for r in (b.get("employees") or [])]
    return names or [frappe.db.get_value("Employee", {"status": "Active"}, "employee_name")]
print("casting-weigh roles:", [r.role for r in frappe.get_doc("Page", "casting-weigh").roles])
print("weight benches:", sorted(ISSUE_RECEIPT_LOCATIONS), "| light benches:", sorted(ASSIGN_COLLECT_LOCATIONS))
print("rosters:", {b: roster(b)[:1] for b in ["TREE MAKING", "SETTING", "FILING", "WAXING", "WAX SETTING", "CAD"]})
