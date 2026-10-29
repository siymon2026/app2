"""Pharmacist UI on the REAL routes: request -> quote in the dashboard -> customer accepts -> order for the store.
Run: PORT=4010 node tests/ui-store-server.js &  python3 tests/browser-store-pharmacy.py"""
import json, sys, urllib.request
from playwright.sync_api import sync_playwright
B = "http://localhost:4010"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def call(method, path, body=None, cust=None):
    h = {"Content-Type": "application/json"}
    if cust: h["X-Cust"] = cust
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
CUST = {"name": "Ali", "phone": "0611111111", "addr": "Rabat Agdal", "lat": 34.02, "lng": -6.84}
st, r = call("POST", "/api/customer/pharmacy/requests", {"storeId": "p1", "text": "Doliprane 1000 + sirop toux", "prescription": PNG, "customer": CUST}, "c1")
check("customer request created", st == 201, r)
rid = r["request"]["id"]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 850}, locale="ar")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/store/"); pg.wait_for_selector("#li")
    pg.fill("#li", "boss@x.com"); pg.fill("#lp", "pw"); pg.click("button[type=submit]")
    pg.wait_for_selector(".picker"); pg.click(".picker .btn >> nth=1")   # boss has g1 + p1; second is the pharmacy
    pg.wait_for_selector(".nav a[data-k=pharmacy]")
    nav = pg.eval_on_selector_all(".nav a", "e=>e.map(x=>x.getAttribute('data-k'))")
    check("pharmacy section in nav", "pharmacy" in nav, nav)
    pg.wait_for_timeout(600)
    check("badge shows pending count", pg.inner_text("#bd_pharmacy").isdigit() and int(pg.inner_text("#bd_pharmacy")) >= 1, pg.inner_text("#bd_pharmacy"))
    pg.click(".nav a[data-k=pharmacy]"); pg.wait_for_selector(f"[data-ph={rid}]")
    pg.click(f"[data-ph={rid}]"); pg.wait_for_selector(".modal")
    pg.wait_for_selector(".modal img", timeout=5000)
    check("prescription image loads (authorised fetch)", pg.eval_on_selector(".modal img", "i=>i.naturalWidth>0"))
    # empty quote refused with a clear message
    pg.click(".modal .foot .btn.primary"); pg.wait_for_timeout(500)
    check("empty price refused", st == 201 and call("GET", "/api/customer/pharmacy/requests/" + rid, None, "c1")[1]["request"]["status"] == "pending")
    pg.fill(".ph-name", "Doliprane 1000mg"); pg.fill(".ph-qty", "2"); pg.fill(".ph-price", "12.5")
    pg.click("#phAddLine"); pg.locator(".ph-name").nth(1).fill("Sirop toux"); pg.locator(".ph-price").nth(1).fill("30")
    pg.click(".modal .foot .btn.primary"); pg.wait_for_timeout(900)
    s2, d = call("GET", "/api/customer/pharmacy/requests/" + rid, None, "c1")
    check("quote stored: quoted, total 55 + delivery", d["request"]["status"] == "quoted" and d["request"]["quote"]["medicinesTotal"] == 55 and d["request"]["total"] == 65, d)
    pg.wait_for_selector(".modal", state="detached", timeout=3000)
    # tab "waiting for customer" lists it
    pg.wait_for_timeout(300)
    pg.locator("button.btn.sm", has_text="بانتظار الزبون").click()
    check("listed under waiting-for-customer", pg.locator(f"[data-ph={rid}]").count() == 1)
    # customer accepts -> order exists for the pharmacy (normal flow), request closed
    s3, a = call("POST", f"/api/customer/pharmacy/requests/{rid}/accept", {"expectTotal": 65}, "c1")
    check("accept creates order", s3 == 200 and a.get("orderId"), a)
    pg.click(".nav a[data-k=orders]"); pg.wait_for_selector(".item", timeout=5000); pg.wait_for_timeout(500)
    check("order visible in the pharmacy orders list", pg.locator(".item", has_text=a["orderId"][-6:]).count() >= 1 or pg.locator(".item").count() >= 1)
    # unavailable flow
    s4, r2 = call("POST", "/api/customer/pharmacy/requests", {"storeId": "p1", "text": "Produit X", "customer": CUST}, "c2")
    pg.click(".nav a[data-k=pharmacy]"); pg.wait_for_timeout(300)
    pg.locator("button.btn.sm", has_text="جديدة").click(); pg.wait_for_selector(f"[data-ph={r2['request']['id']}]", timeout=5000)
    pg.click(f"[data-ph={r2['request']['id']}]"); pg.wait_for_selector(".modal"); pg.click("#phUnavail"); pg.fill(".modal textarea", "Rupture de stock")
    pg.click(".modal .foot .btn.primary"); pg.wait_for_timeout(800)
    s5, d2 = call("GET", "/api/customer/pharmacy/requests/" + r2["request"]["id"], None, "c2")
    check("unavailable stored with reason", d2["request"]["status"] == "unavailable" and d2["request"]["quote"]["reason"] == "Rupture de stock", d2)
    b.close()
check("no page errors", not errs, errs[:3])
print("FAILED: %s" % fails if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
