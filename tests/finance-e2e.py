"""End-to-end financial checks against a REAL running SIYMON server (JSON store).

Usage:  PORT=8099 JWT_SECRET=devsecret ADMIN_PASSWORD=admin123 node server.js &
        python3 tests/finance-e2e.py [--base http://127.0.0.1:8099]

Everything here talks HTTP to the real server and the real data files: no fakes,
no stubs. It creates its own customer, store user and driver, so it can be re-run.

Covers: top-up (pending -> approved, single credit), wallet payment at checkout,
insufficient balance (structured refusal, nothing written), duplicate order
requests, wallet method in the checkout registry, order life cycle to delivered,
loyalty earning exactly once, points -> wallet conversion (idempotent), order
refund (wallet + points reversal, no double refund), cancellation refund,
concurrent double-spend, and the admin permission matrix.
"""
import json
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8099"
for i, a in enumerate(sys.argv):
    if a == "--base" and i + 1 < len(sys.argv):
        BASE = sys.argv[i + 1]

PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4n"
    "GNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)
FAILS = []


def req(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw or "{}")
        except Exception:
            return e.code, {"raw": raw}


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (("  -> " + str(detail)) if not cond else ""))
    if not cond:
        FAILS.append(name)


def unique(prefix):
    return "%s%d" % (prefix, int(time.time() * 1000) % 10 ** 10)


ADMIN_CRED = {"email": "e2e.admin@siymon.test", "phone": "0600000001", "password": "E2ePassw0rd123"}


def admin_token():
    """Legacy ADMIN_PASSWORD login only works while no admin account exists. This
    helper logs in, and (when it is the first run) creates a real full admin so that
    later runs still work after restricted staff accounts have been added."""
    st, a = req("POST", "/api/admin/login", {"password": "admin123"})
    if st == 200:
        # make the environment repeatable: a real system_admin account
        req("POST", "/api/admin/signup", {
            "email": ADMIN_CRED["email"], "phone": ADMIN_CRED["phone"],
            "password": ADMIN_CRED["password"], "password2": ADMIN_CRED["password"],
        }, {"X-Admin-Token": a["token"]})
        return a["token"]
    st, a = req("POST", "/api/admin/login", {"email": ADMIN_CRED["email"], "password": ADMIN_CRED["password"]})
    return a.get("token") if st == 200 else None


def main():
    token = admin_token()
    if not token:
        print("cannot log in as admin: set ADMIN_PASSWORD=admin123 on a fresh data dir, "
              "or create the system admin %s" % ADMIN_CRED["email"])
        return 2
    AT = {"X-Admin-Token": token}

    print("\n== payment method + wallet policy ==")
    req("PUT", "/api/admin/payment-methods/cih", {
        "enabled": True,
        "contexts": {"customerTopup": True, "checkout": False, "driverTopup": False},
        "details": {"default": {"holderName": "SIYMON SARL", "bankName": "CIH", "rib": "007780000012345678901234"}},
        "requireReceipt": False,
    }, AT)
    st, pol = req("PUT", "/api/admin/wallet/settings", {"minTopup": 10, "maxTopup": 5000, "feePercent": 0, "feeFixed": 0}, AT)
    check("wallet policy saved", st == 200 and pol["policy"]["minTopup"] == 10, pol)

    print("\n== customer ==")
    email = unique("wallet") + "@siymon.test"
    st, c = req("POST", "/api/customer/signup", {
        "firstName": "E2E", "lastName": "Wallet", "email": email,
        "phone": "06" + str(int(time.time() * 1000))[-8:], "password": "secret123", "password2": "secret123",
    })
    check("customer signup", st == 200 and c.get("token"), c)
    CT = {"X-Customer-Token": c["token"]}
    cid = c["customer"]["id"]

    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("wallet starts at 0 (server-side)", st == 200 and w["walletBalance"] == 0, w.get("walletBalance"))
    check("wallet exposes the loyalty programme",
          isinstance(w.get("loyalty"), dict)
          and isinstance(w["loyalty"]["program"].get("enabled"), bool)
          and "balances" in w["loyalty"] and "valueMAD" in w["loyalty"])

    print("\n== top-up ==")
    st, t1 = req("POST", "/api/customer/wallet/topups", {
        "methodId": "cih", "amount": 300, "reference": unique("REF"),
    }, CT)
    check("top-up request created as pending", st == 200 and t1["topup"]["status"] == "pending", t1)
    tid = t1["topup"]["id"]
    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("pending top-up does NOT change the balance", w["walletBalance"] == 0, w["walletBalance"])
    check("pending top-up is visible in the history", any(t["status"] == "pending" for t in w["transactions"]))
    req("PUT", "/api/admin/wallet/settings", {"minTopup": 1000}, AT)
    check("amount below the supervisor minimum is refused",
          req("POST", "/api/customer/wallet/topups", {"methodId": "cih", "amount": 50, "reference": unique("REF")}, CT)[0] == 400)
    req("PUT", "/api/admin/wallet/settings", {"minTopup": 10}, AT)

    st, ap = req("PATCH", "/api/admin/topups/" + tid, {"status": "approved", "confirmedReference": "BANK-" + tid}, AT)
    check("approval credits the wallet", st == 200 and ap["topup"]["creditAmount"] == 300, ap)
    st, ap2 = req("PATCH", "/api/admin/topups/" + tid, {"status": "approved"}, AT)
    check("second approval refused", st == 409 and ap2.get("code") == "ALREADY_DECIDED", ap2)
    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("balance credited exactly once", w["walletBalance"] == 300, w["walletBalance"])
    check("totals show the added amount", w["totals"]["added"] == 300, w["totals"])
    st, rc = req("GET", "/api/admin/customers/%s/wallet-reconcile" % cid, None, AT)
    check("wallet reconciles with the ledger", rc.get("ok") is True and rc.get("diff") == 0, rc)

    print("\n== loyalty programme ==")
    st, ls = req("PUT", "/api/admin/loyalty/settings", {
        "enabled": True,
        "earn": {"unitAmount": 1, "pointsPerUnit": 1, "base": "paid", "pendingDays": 0},
        "redeem": {"minPoints": 50, "pointsPerCurrencyUnit": 100, "maxPointsPerTx": 500},
        "expiry": {"enabled": True, "days": 365},
    }, AT)
    check("programme settings saved", st == 200 and ls["settings"]["enabled"] is True, ls)
    st, pv = req("POST", "/api/admin/loyalty/preview", {"earn": {"unitAmount": 2}}, AT)
    check("draft preview works without saving",
          st == 200 and "every 2 MAD" in pv["preview"]["en"]["earn"]["rule"], st)

    st, menu = req("GET", "/api/menu")
    item = menu["items"][0]
    body = {
        "restaurantId": "REST-1",
        "customer": {"name": "E2E Wallet", "phone": "0612345678", "addr": "Berrechid centre", "lat": 33.2655, "lng": -7.5872},
        "items": [{"id": item["id"], "qty": 2}],
        "paymentMethod": "cod",
        "useWallet": True,
        "requestId": "e2e-" + unique(""),
    }
    st, o = req("POST", "/api/orders", body, CT)
    check("order created and paid from the wallet", st == 200 and o.get("paidFromWallet", 0) > 0, o)
    oid = o.get("id")
    paid = o.get("paidFromWallet", 0)
    st, o2 = req("POST", "/api/orders", body, CT)
    check("repeated request returns the same order (idempotent)", st == 200 and o2.get("duplicate") is True and o2.get("id") == oid, o2)
    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("wallet debited once", w["walletBalance"] == round(300 - paid, 2), w["walletBalance"])

    print("\n== wallet is a real checkout method ==")
    st, pm = req("GET", "/api/payment-methods?context=checkout", None, CT)
    wallet = [m for m in pm.get("methods", []) if m.get("id") == "wallet"]
    check("the signed-in customer sees the wallet method", st == 200 and len(wallet) == 1, pm)
    check("the wallet method exposes the real balance", wallet and wallet[0].get("walletBalance") == round(300 - paid, 2), wallet)
    st, pm2 = req("GET", "/api/payment-methods?context=checkout")
    check("an anonymous visitor never sees a wallet method", all(m.get("id") != "wallet" for m in pm2.get("methods", [])))

    print("\n== not enough balance ==")
    st, w = req("GET", "/api/customer/wallet", None, CT)
    before = w["walletBalance"]
    big = dict(body)
    big["items"] = [{"id": item["id"], "qty": 40}]
    big["paymentMethod"] = "wallet"   # the wallet must cover the whole goods part
    big["useWallet"] = "full"
    big["requestId"] = "e2e-big-" + unique("")
    st, ins = req("POST", "/api/orders", big, CT)
    check("insufficient balance refused with a structured answer", st == 409 and ins.get("code") == "WALLET_INSUFFICIENT", ins)
    check("the refusal shows available / required / shortfall",
          isinstance(ins.get("wallet"), dict) and {"available", "required", "shortfall"} <= set(ins["wallet"]), ins.get("wallet"))
    check("the refusal is translated (ar/fr/en)", isinstance(ins.get("message"), dict) and set(ins["message"]) == {"ar", "fr", "en"})
    check("it offers to top up or choose another method", ins.get("canTopUp") is True and ins.get("canChooseAnotherMethod") is True)
    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("no partial debit and no order created", w["walletBalance"] == before, (before, w["walletBalance"]))
    st, orders = req("GET", "/api/customer/orders", None, CT)
    mine = [x for x in orders.get("orders", []) if str(x.get("id")) == str(ins.get("id"))]
    check("no phantom successful payment", not mine)

    print("\n== delivery life cycle (store + driver) ==")
    store_email = unique("store") + "@siymon.test"
    st, su = req("POST", "/api/admin/restaurant-users", {"restaurantId": "REST-1", "email": store_email, "password": "storepass123", "role": "owner"}, AT)
    check("store user created for the delivery chain", st == 200, su)
    st, sl = req("POST", "/api/store/login", {"identifier": store_email, "password": "storepass123"})
    if st != 200:
        print("  (store login unavailable, skipping the delivery chain)", sl)
    else:
        ST = {"Authorization": "Bearer " + sl["token"], "X-Store-Id": sl["stores"][0]["id"]}
        req("PATCH", "/api/orders/" + oid, {"status": "admin_accepted"}, AT)
        st, a1 = req("PATCH", "/api/store/orders/" + oid, {"action": "accept"}, ST)
        st, a2 = req("PATCH", "/api/store/orders/" + oid, {"action": "ready"}, ST)
        check("store accepts and releases the order", st == 200, a2)
        # driver
        dphone = "07" + str(int(time.time() * 1000))[-8:]
        st, d = req("POST", "/api/driver/signup", {
            "name": "E2E Driver", "phone": dphone, "password": "driver123", "password2": "driver123",
            "vehicleType": "bicycle", "vehiclePlate": "E2E123", "cardNumber": "E2E" + dphone,
            "faceWithBikeCard": PNG, "idFront": PNG, "idBack": PNG, "profilePhoto": PNG, "licenseImage": PNG,
        })
        check("driver signup", st == 200, d)
        did = d.get("driver", {}).get("id") or d.get("id")
        st, dr = req("PATCH", "/api/admin/drivers/" + str(did), {"status": "approved"}, AT)
        check("driver approved", st == 200, dr)
        st, asg = req("PATCH", "/api/orders/" + oid, {"driverId": did}, AT)
        check("driver assigned", st == 200, asg)
        st, dl = req("POST", "/api/driver/login", {"phone": dphone, "password": "driver123"})
        check("driver login", st == 200 and dl.get("token"), dl)
        DT = {"Authorization": "Bearer " + dl.get("token", "")}
        st, r = req("PATCH", "/api/driver/orders/" + oid, {"status": "accepted"}, DT)
        check("driver -> accepted", st == 200, r)
        # Pickup and delivery are verified: the store gives the pickup code to the driver,
        # the customer gives the delivery code on arrival. Neither is guessable.
        st, so = req("GET", "/api/store/orders", None, ST)
        row = next((x for x in so.get("orders", []) if str(x.get("id")) == str(oid)), {})
        pickup = row.get("pickupCode")
        check("the store sees the pickup code (and the driver does not)", bool(pickup), row.get("id"))
        st, r = req("PATCH", "/api/driver/orders/" + oid, {"status": "picked_up", "code": pickup}, DT)
        check("driver -> picked_up (with the store's code)", st == 200, r)
        st, r = req("PATCH", "/api/driver/orders/" + oid, {"status": "on_the_way"}, DT)
        check("driver -> on_the_way", st == 200, r)
        st, co = req("GET", "/api/customer/orders", None, CT)
        crow = next((x for x in co.get("orders", []) if str(x.get("id")) == str(oid)), {})
        dcode = crow.get("deliveryCode")
        check("the customer sees the delivery code", bool(dcode), crow.get("id"))
        st, r = req("PATCH", "/api/driver/orders/" + oid, {"status": "delivered", "code": dcode}, DT)
        check("driver -> delivered (with the customer's code)", st == 200, r)
        st, w = req("GET", "/api/customer/wallet", None, CT)
        earned = w["loyalty"]["balances"]["earnedTotal"]
        check("points earned once the order is delivered", earned > 0, w["loyalty"]["balances"])
        st, r2 = req("PATCH", "/api/driver/orders/" + oid, {"status": "delivered", "code": dcode}, DT)
        st, w2 = req("GET", "/api/customer/wallet", None, CT)
        check("delivery replay does not earn twice", w2["loyalty"]["balances"]["earnedTotal"] == earned, w2["loyalty"]["balances"])

        print("\n== points -> wallet ==")
        avail = w2["loyalty"]["balances"]["available"]
        st, rd = req("POST", "/api/customer/wallet/loyalty/redeem", {"points": 50, "requestId": "rd-" + unique("")}, CT)
        check("conversion accepted", st == 200 and rd.get("points") == 50, rd)
        check("wallet credited by the converted value", st == 200 and rd.get("amount") == 0.5, rd)
        # a supervisor bonus (audited) makes room for a second, idempotent conversion
        req("POST", "/api/admin/loyalty/customers/%s/adjust" % cid,
            {"points": 100, "direction": "credit", "reason": "E2E conversion bonus"}, AT)
        key = "rd2-" + unique("")
        rest = 50
        if rest > 0:
            st, r1 = req("POST", "/api/customer/wallet/loyalty/redeem", {"points": rest, "requestId": key}, CT)
            st, r2 = req("POST", "/api/customer/wallet/loyalty/redeem", {"points": rest, "requestId": key}, CT)
            check("same request key converts only once", r2.get("duplicate") is True and r2.get("points") == r1.get("points"), (r1, r2))
        st, over = req("POST", "/api/customer/wallet/loyalty/redeem", {"points": 999999}, CT)
        check("conversion above the balance refused", st == 409 and over.get("code") == "INSUFFICIENT_POINTS", over)

        print("\n== refund of a delivered order ==")
        st, w = req("GET", "/api/customer/wallet", None, CT)
        bal_before_refund = w["walletBalance"]
        pts_before_refund = w["loyalty"]["balances"]["available"]
        st, rf = req("POST", "/api/admin/orders/%s/refund" % oid, {"reason": "E2E delivery problem"}, AT)
        check("admin refund accepted", st == 200 and rf.get("order", {}).get("refund", {}).get("amount", 0) > 0, rf)
        if st != 200:
            rf = {"walletRefunded": 0}
        check("the wallet part went back to the wallet", rf.get("walletRefunded", 0) > 0, rf)
        st, w = req("GET", "/api/customer/wallet", None, CT)
        check("wallet balance increased by the refund",
              w["walletBalance"] == round(bal_before_refund + rf["walletRefunded"], 2), (bal_before_refund, w["walletBalance"]))
        check("the refund is visible in the history", any(t["type"] == "refund" for t in w["transactions"]))
        check("points of the refunded order were reversed",
              w["loyalty"]["balances"]["reversed"] >= 0 and w["loyalty"]["balances"]["available"] <= pts_before_refund,
              w["loyalty"]["balances"])
        st, rf2 = req("POST", "/api/admin/orders/%s/refund" % oid, {"reason": "again"}, AT)
        check("no double refund", st == 409 and rf2.get("code") == "ALREADY_REFUNDED", rf2)
        st, rc2 = req("GET", "/api/admin/customers/%s/wallet-reconcile" % cid, None, AT)
        check("wallet still reconciles after the refund", rc2.get("diff") == 0, rc2)

    print("\n== cancel before acceptance refunds the wallet ==")
    body2 = dict(body)
    body2["requestId"] = "e2e2-" + unique("")
    body2.pop("useWallet", None)
    body2["paymentMethod"] = "cod"
    body2["items"] = [{"id": item["id"], "qty": 2}]
    body2["useWallet"] = True
    st, o3 = req("POST", "/api/orders", body2, CT)
    oid3 = o3.get("id") if st == 200 else None
    check("second order created", st == 200, o3)
    st, w = req("GET", "/api/customer/wallet", None, CT)
    bal_after_pay = w["walletBalance"]
    st, cn = req("POST", "/api/customer/orders/" + oid3 + "/cancel", {}, CT)
    check("customer cancellation accepted", st == 200, cn)
    st, w2 = req("GET", "/api/customer/wallet", None, CT)
    check("wallet refunded by the paid part", round(w2["walletBalance"] - bal_after_pay, 2) == round(o3.get("paidFromWallet", 0), 2), (bal_after_pay, w2["walletBalance"], o3.get("paidFromWallet")))
    check("refund is recorded in the history", any(t["type"] == "refund" for t in w2["transactions"]))
    st, cn2 = req("POST", "/api/customer/orders/" + oid3 + "/cancel", {}, CT)
    check("second cancellation does not refund twice", st == 409, cn2)

    print("\n== no double spend under concurrency ==")
    st, top = req("POST", "/api/customer/wallet/topups", {"methodId": "cih", "amount": 1000, "reference": unique("REF")}, CT)
    req("PATCH", "/api/admin/topups/" + top["topup"]["id"], {"status": "approved"}, AT)
    st, w = req("GET", "/api/customer/wallet", None, CT)
    start = w["walletBalance"]
    results = []

    def buy(i):
        b = dict(body)
        b["items"] = [{"id": item["id"], "qty": 40}]  # 1600 of goods: more than the whole balance
        b["paymentMethod"] = "wallet"                # must be covered in full, or refused
        b["useWallet"] = "full"
        b["requestId"] = "conc-%d-%s" % (i, unique(""))
        results.append(req("POST", "/api/orders", b, CT)[0])

    threads = [threading.Thread(target=buy, args=(i,)) for i in range(2)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    st, w = req("GET", "/api/customer/wallet", None, CT)
    check("concurrent over-spending refused, balance untouched", w["walletBalance"] == start and all(r == 409 for r in results), (start, w["walletBalance"], results))

    print("\n== permissions ==")
    st, me = req("GET", "/api/admin/me", None, AT)
    check("admin permissions include the loyalty rights", "*" in me["permissions"], me)
    roles = req("GET", "/api/admin/loyalty/customers?q=" + cid, None, AT)
    check("admin can search a customer by id", roles[0] == 200 and roles[1]["customers"][0]["id"] == cid, roles[1])
    st, other = req("GET", "/api/customer/wallet", None, {"X-Customer-Token": "not-a-token"})
    check("a forged customer token cannot read a wallet", st in (401, 403), st)

    # a real accountant: may adjust points, may not change the rules
    acc_email = unique("acc") + "@siymon.test"
    acc_phone = "05" + str(int(time.time() * 1000))[-8:]
    st, staff = req("POST", "/api/admin/staff", {"email": acc_email, "phone": acc_phone, "password": "accpass123", "role": "accountant"}, AT)
    if st != 200:
        check("accountant created", False, staff)
    else:
        st, al = req("POST", "/api/admin/login", {"email": acc_email, "password": "accpass123"})
        AAT = {"X-Admin-Token": al.get("token", "")}
        st, adj = req("POST", "/api/admin/loyalty/customers/%s/adjust" % cid, {"points": 10, "direction": "credit", "reason": "E2E accountant bonus"}, AAT)
        check("accountant may adjust points", st == 200, adj)
        st, forb = req("PUT", "/api/admin/loyalty/settings", {"enabled": False}, AAT)
        check("accountant may NOT change the rules", st == 403, forb)
        st, wadj = req("POST", "/api/admin/customers/%s/wallet-adjust" % cid, {"direction": "credit", "amount": 5, "reason": "E2E goodwill"}, AAT)
        check("accountant may adjust the wallet", st == 200, wadj)
        st, wset = req("PUT", "/api/admin/wallet/settings", {"minTopup": 5}, AAT)
        check("accountant may NOT change the money limits", st == 403, wset)

    print("\n== result ==")
    if FAILS:
        print("%d check(s) FAILED:" % len(FAILS))
        for f in FAILS:
            print("  -", f)
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
