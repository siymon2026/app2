"""Remove the artefacts left by the E2E scripts from a data directory.

    python3 tests/cleanup-e2e-data.py --data data --dry-run
    python3 tests/cleanup-e2e-data.py --data data

What counts as an artefact: accounts/records created by tests/finance-e2e.py and
the older flow scripts, i.e.
  - admins, customers, drivers and store users whose email ends with @siymon.test
    or @x.test (the test domains),
  - drivers named "E2E Driver",
  - the orders / top-ups / notifications / points ledgers of those customers,
  - the payment method the tests configure (a fake bank account) is disabled and
    its fake details are cleared,
  - loyalty settings and wallet policy go back to the shipped defaults.
Real records (any other e-mail/phone, any record the tests did not create) are
NEVER touched. A copy of every modified file is written to backups/e2e-cleanup-*.

Run the E2E itself with ./tests/run-finance-e2e.sh (isolated DATA_DIR) so this is
not needed; this script is the repair path for a run that hit a live instance.
"""
import argparse
import json
import os
import re
import shutil
import sys
import time

TEST_EMAIL = re.compile(r"@(siymon|x)\.test$", re.I)


def read(path, fallback):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data", help="data directory (default: data)")
    ap.add_argument("--dry-run", action="store_true", help="only report what would change")
    args = ap.parse_args()

    data_dir = os.path.abspath(args.data)
    if not os.path.isdir(data_dir):
        print("not a directory:", data_dir)
        return 2

    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = os.path.join("backups", "e2e-cleanup-" + stamp)
    if not args.dry_run:
        os.makedirs(backup, exist_ok=True)

    changed = {}

    def load(name, fallback):
        return read(os.path.join(data_dir, name), fallback)

    def save(name, payload):
        changed[name] = payload
        if args.dry_run:
            return
        shutil.copy2(os.path.join(data_dir, name), os.path.join(backup, name)) if os.path.exists(
            os.path.join(data_dir, name)
        ) else None
        write(os.path.join(data_dir, name), payload)

    # ---- who is a test customer? -------------------------------------------
    customers = load("customers.json", {"customers": []})
    test_customers = {str(c["id"]) for c in customers.get("customers", []) if TEST_EMAIL.search(str(c.get("email") or ""))}
    customers["customers"] = [c for c in customers.get("customers", []) if str(c["id"]) not in test_customers]
    save("customers.json", customers)

    # ---- their money trails -------------------------------------------------
    orders = load("orders.json", {"orders": []})
    before = len(orders.get("orders", []))
    orders["orders"] = [o for o in orders.get("orders", []) if str(o.get("customerId")) not in test_customers]
    save("orders.json", orders)
    print("orders removed:", before - len(orders["orders"]))

    topups = load("topups.json", {"topups": []})
    before = len(topups.get("topups", []))
    topups["topups"] = [t for t in topups.get("topups", []) if str(t.get("customerId")) not in test_customers]
    save("topups.json", topups)
    print("top-ups removed:", before - len(topups["topups"]))

    notes = load("notifications.json", {"notifications": []})
    before = len(notes.get("notifications", []))
    notes["notifications"] = [n for n in notes.get("notifications", []) if str(n.get("customerId") or "") not in test_customers]
    save("notifications.json", notes)
    print("notifications removed:", before - len(notes["notifications"]))

    loyalty = load("loyalty.json", {"settings": None, "accounts": []})
    before = len(loyalty.get("accounts", []))
    loyalty["accounts"] = [a for a in loyalty.get("accounts", []) if a and str(a.get("customerId")) not in test_customers]
    loyalty["settings"] = None  # shipped default: programme disabled, no rules changed
    save("loyalty.json", loyalty)
    print("points ledgers removed:", before - len(loyalty["accounts"]))

    # ---- staff / drivers / store accounts created by the tests ---------------
    admins = load("admins.json", {"admins": []})
    before = len(admins.get("admins", []))
    admins["admins"] = [a for a in admins.get("admins", []) if not TEST_EMAIL.search(str(a.get("email") or ""))]
    save("admins.json", admins)
    print("admin accounts removed:", before - len(admins["admins"]), "| left:", len(admins["admins"]))
    if admins["admins"]:
        print("  NOTE: real admin accounts remain, so the password-only login stays closed.")
    else:
        print("  password-only admin login (ADMIN_PASSWORD) works again.")

    drivers = load("drivers.json", {"drivers": []})
    before = len(drivers.get("drivers", []))
    drivers["drivers"] = [
        d
        for d in drivers.get("drivers", [])
        if not (str(d.get("name") or "") == "E2E Driver" or TEST_EMAIL.search(str(d.get("email") or "")))
    ]
    save("drivers.json", drivers)
    print("drivers removed:", before - len(drivers["drivers"]))

    users = load("restaurant_users.json", {"users": []})
    before = len(users.get("users", []))
    users["users"] = [u for u in users.get("users", []) if not TEST_EMAIL.search(str(u.get("email") or ""))]
    save("restaurant_users.json", users)
    print("store users removed:", before - len(users["users"]))

    # ---- the fake bank account the tests configure --------------------------
    methods = load("payment_methods.json", {"methods": []})
    for m in methods.get("methods", []):
        if m.get("id") != "cih":
            continue
        m["enabled"] = False
        m["contexts"] = {k: False for k in (m.get("contexts") or {})}
        for aud in (m.get("details") or {}).values():
            if not isinstance(aud, dict):
                continue
            for k in ("holderName", "bankName", "rib", "iban", "accountNumber", "paymentIdentifier", "branch"):
                if k in aud:
                    aud[k] = ""
        m["qrImage"] = ""
    save("payment_methods.json", methods)

    # ---- wallet policy back to the shipped defaults -------------------------
    wallet = load("wallet_settings.json", {"policy": {}})
    policy = wallet.get("policy") or {}
    policy.update({"enabled": True, "currency": "MAD", "minTopup": 10, "maxTopup": 20000, "feePercent": 0, "feeFixed": 0, "presets": [50, 100, 200, 500]})
    wallet["policy"] = policy
    save("wallet_settings.json", wallet)

    if args.dry_run:
        print("\n(dry run — nothing written)")
    else:
        print("\nbackup of the previous files:", backup)
    return 0


if __name__ == "__main__":
    sys.exit(main())
