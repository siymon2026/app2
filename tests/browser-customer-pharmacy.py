"""Customer /pharmacy/ page on the REAL pharmacy routes: new request (+prescription) -> pharmacist quotes -> customer accepts.
Run: PORT=4010 node tests/ui-store-server.js &  python3 tests/browser-customer-pharmacy.py"""
import json, sys, base64, urllib.request
from playwright.sync_api import sync_playwright
B = "http://localhost:4010"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
PTOK = "tok:" + base64.b64encode(json.dumps({"role": "store_user", "uids": ["u2"], "id": "u2", "restaurantId": "p1"}).encode()).decode()
def call(method, path, body=None, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
PH = {"Authorization": "Bearer " + PTOK, "X-Store-Id": "p1"}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
open("/tmp/rx.png", "wb").write(PNG)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar")
    ctx.add_init_script("localStorage.setItem('siymon_customer_token_v1','cust-c1')")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/pharmacy/"); pg.wait_for_selector("#phSend")
    check("form prefilled from profile", pg.input_value("#phName") == "علي الإدريسي" and pg.input_value("#phPhone") == "0611111111")
    pg.click("#phSend"); pg.wait_for_timeout(200)
    check("empty request refused client-side", "اكتب" in pg.inner_text("#phHint"), pg.inner_text("#phHint"))
    pg.fill("#phText", "Doliprane 1000mg")
    pg.click("#phSend"); pg.wait_for_timeout(200)
    check("missing address refused", "مطلوبة" in pg.inner_text("#phHint"), pg.inner_text("#phHint"))
    pg.select_option("#phSaved", "a1")
    check("saved address fills the field", "أكدال" in pg.input_value("#phAddr"), pg.input_value("#phAddr"))
    pg.set_input_files("#phFile", "/tmp/rx.png"); pg.wait_for_selector(".ph-rx")
    pg.click("#phSend"); pg.wait_for_selector("#phStatus", timeout=5000)
    rid = pg.inner_text(".ph-row b")
    check("request number shown (PH-XXXXXXXX)", rid.startswith("PH-") and len(rid) == 11, rid)
    check("status pending", "بانتظار" in pg.inner_text("#phStatus"))
    pg.wait_for_selector(".ph-rx", timeout=5000)
    check("prescription visible via authorised fetch", pg.eval_on_selector(".ph-rx", "i=>i.naturalWidth>0"))
    st, lst = call("GET", "/api/customer/pharmacy/requests", headers={"X-Cust": "c1"})
    check("exactly one request stored (no duplicate)", len(lst["requests"]) == 1 and lst["requests"][0]["hasPrescription"], lst)
    check("no order yet", call("GET", "/api/customer/pharmacy/requests/" + rid, headers={"X-Cust": "c1"})[1]["request"]["orderId"] is None)
    # pharmacist answers
    s, q = call("POST", f"/api/store/pharmacy/requests/{rid}/quote", {"available": True, "lines": [{"name": "Doliprane 1000mg", "qty": 2, "price": 12.5}], "validMinutes": 30}, PH)
    check("pharmacist quote ok", s == 200, q)
    pg.wait_for_selector("#phAccept", timeout=12000)
    check("offer shown with total = 25 + 10 delivery", "35" in pg.inner_text("#phTotal"), pg.inner_text("#phTotal"))
    pg.once("dialog", lambda d: d.accept())
    pg.click("#phAccept"); pg.wait_for_selector("a[href='/orders/']", timeout=8000)
    s, d = call("GET", "/api/customer/pharmacy/requests/" + rid, headers={"X-Cust": "c1"})
    check("accepted -> order created", d["request"]["status"] == "accepted" and d["request"]["orderId"], d)
    pg.click("#phChat")
    pg.wait_for_url("**/chat/?store=*"); check("chat link carries the request id", rid in pg.url, pg.url)
    # second request: unavailable, and cancel
    s, r2 = call("POST", "/api/customer/pharmacy/requests", {"storeId": "p1", "text": "Produit X", "customer": {"name": "A", "phone": "0611111111", "addr": "x y"}}, {"X-Cust": "c1"})
    call("POST", f"/api/store/pharmacy/requests/{r2['request']['id']}/quote", {"available": False, "reason": "Rupture de stock"}, PH)
    pg.goto(B + "/pharmacy/?request=" + r2["request"]["id"]); pg.wait_for_selector("#phStatus")
    check("unavailable shown with reason", "Rupture" in pg.inner_text("#phBody") and pg.locator("#phAccept").count() == 0)
    pg.goto(B + "/pharmacy/?tab=mine"); pg.wait_for_selector("[data-ph]")
    check("my requests lists both", pg.locator("[data-ph]").count() == 2)
    pg.goto(B + "/pharmacy/?store=p1&q=" + "Amoxicilline"); pg.wait_for_selector("#phText")
    check("search handoff prefills the medicine + pharmacy", pg.input_value("#phText") == "Amoxicilline" and pg.input_value("#phStore") == "p1")
    # another customer cannot open it
    check("other customer gets 404", call("GET", "/api/customer/pharmacy/requests/" + rid, headers={"X-Cust": "c2"})[0] == 404)
    b.close()
check("no page errors", not errs, errs[:3])
print("FAILED: %s" % fails if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
