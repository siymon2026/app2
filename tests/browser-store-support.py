"""Store dashboard 'Help & support' on the REAL support routes: channels managed by the admin appear in the store,
tickets + replies flow both ways, nothing is duplicated, drafts survive refreshes.
Run: PORT=4010 node tests/ui-store-server.js &  python3 tests/browser-store-support.py"""
import json, sys, urllib.request
from playwright.sync_api import sync_playwright
B = "http://localhost:4010"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def call(method, path, body=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Admin-Token": "adm"}, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
errs = []
# admin publishes channels: one for stores (enabled), one disabled, one drivers-only
s, c1 = call("POST", "/api/admin/support-channels", {"kind": "whatsapp", "label": {"ar": "واتساب الدعم"}, "value": "+212 612-345-678", "audience": ["stores"], "hours": "9-18"})
check("admin creates a channel", s == 201, c1)
call("POST", "/api/admin/support-channels", {"kind": "phone", "label": {"ar": "هاتف معطل"}, "value": "+212600000001", "audience": ["stores"], "enabled": False})
call("POST", "/api/admin/support-channels", {"kind": "email", "label": {"ar": "للسائقين فقط"}, "value": "drivers@x.com", "audience": ["drivers"]})
check("invalid phone refused by the server", call("POST", "/api/admin/support-channels", {"kind": "phone", "label": "x", "value": "abc", "audience": ["stores"]})[0] == 400)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1100, "height": 850}, locale="ar", service_workers="block")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/store/"); pg.wait_for_selector("#li")
    pg.fill("#li", "boss@x.com"); pg.fill("#lp", "pw"); pg.click("button[type=submit]")
    pg.wait_for_selector(".picker"); pg.click(".picker .btn >> nth=0")     # grocery g1
    pg.wait_for_selector(".nav a[data-k=help]"); pg.click(".nav a[data-k=help]")
    pg.wait_for_selector("#spChannels", timeout=5000)
    check("only the enabled, store-addressed channel is shown", pg.locator("#spChannels [data-ch]").count() == 1, pg.inner_text("#spChannels"))
    href = pg.get_attribute("#spChannels [data-ch]", "href")
    check("whatsapp link built by the server from the normalised number", href == "https://wa.me/212612345678", href)
    check("no external /support/ page link any more", pg.locator("a[href='/support/']").count() == 0)
    # open a ticket (double click must create ONE)
    pg.fill("#spSubject", "مشكلة في الطلبات"); pg.fill("#spText", "لا تظهر الطلبات الجديدة")
    pg.dblclick("#spCreate"); pg.wait_for_selector("#spMsgs", timeout=5000); pg.wait_for_timeout(600)
    s, lst = call("GET", "/api/admin/store-support/tickets")
    check("exactly one ticket created", len(lst["tickets"]) == 1 and lst["tickets"][0]["unread"] == 1, lst)
    tid = lst["tickets"][0]["id"]
    check("first message shown in the thread", "لا تظهر" in pg.inner_text("#spMsgs"))
    # admin replies -> store sees it without reload, unread badge on the menu while the list is shown
    s, _ = call("POST", f"/api/admin/store-support/tickets/{tid}/messages", {"text": "تم فحص المشكلة، حاول الآن"}); check("admin reply ok", s == 200)
    pg.wait_for_function("document.querySelector('#spMsgs').innerText.includes('تم فحص')", timeout=12000)
    check("reply arrives by itself (incremental poll)", True)
    check("status answered", "تم الرد" in pg.inner_text("#spStatus"), pg.inner_text("#spStatus"))
    # store replies (optimistic) + a duplicate clientId is not stored twice
    pg.fill("#spInput", "شكراً"); pg.press("#spInput", "Enter"); pg.wait_for_function("document.querySelector('#spMsgs').innerText.includes('شكراً')", timeout=5000)
    pg.wait_for_timeout(500)
    s, th = call("GET", f"/api/admin/store-support/tickets/{tid}")
    check("store reply stored once", [m["text"] for m in th["messages"]].count("شكراً") == 1, th)
    # back to the list: draft survives the refresh timer
    pg.click("#spBack"); pg.wait_for_selector("#spSubject")
    pg.fill("#spSubject", "مسودة"); pg.wait_for_timeout(9500)
    check("typed draft survives the 8 s refresh", pg.input_value("#spSubject") == "مسودة")
    check("ticket listed", pg.locator("#spTickets [data-tk]").count() == 1)
    # admin closes: store sees closed, composer hidden
    call("POST", f"/api/admin/store-support/tickets/{tid}/status", {"status": "closed"})
    pg.click(f"[data-tk={tid}]"); pg.wait_for_selector("#spStatus"); pg.wait_for_timeout(800)
    check("closed ticket: composer hidden + note shown", pg.locator("#spComposer").is_hidden() and pg.locator("#spClosedNote").is_visible())
    # admin changes a channel -> store gets it on reload
    call("PUT", f"/api/admin/support-channels/{c1['channel']['id']}", {"kind": "whatsapp", "label": {"ar": "واتساب جديد"}, "value": "+212611111111", "audience": ["stores"], "enabled": True})
    pg.reload(); pg.wait_for_selector(".nav a[data-k=help]"); pg.click(".nav a[data-k=help]"); pg.wait_for_selector("#spChannels")
    check("edited number shows in the store", "واتساب جديد" in pg.inner_text("#spChannels") and pg.get_attribute("#spChannels [data-ch]", "href").endswith("212611111111"))
    b.close()
# isolation: another store (pharmacy p1 owner) cannot read the g1 ticket
import base64
ptok = "tok:" + base64.b64encode(json.dumps({"role": "store_user", "uids": ["u2"], "id": "u2", "restaurantId": "p1"}).encode()).decode()
r = urllib.request.Request(B + f"/api/store/support/tickets/{tid}", headers={"Authorization": "Bearer " + ptok, "X-Store-Id": "p1"})
try: code = urllib.request.urlopen(r).status
except urllib.error.HTTPError as e: code = e.code
check("another store gets 404 for this ticket", code == 404, code)
check("no page errors", not errs, errs[:3])
print("FAILED: %s" % fails if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
