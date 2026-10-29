"""Customer <-> store chat page (/chat/?store=O1): no duplicates on retry / lost response, polling merge, unread.
Run: node tests/chat-mock-server.js &  python3 tests/browser-store-chat.py"""
import json, sys, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
B = "http://127.0.0.1:4022"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def st(): return json.load(urllib.request.urlopen(B + "/__t/state"))
def tset(q): urllib.request.urlopen(B + "/__t/set?" + q)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 800})
    ctx.add_init_script("localStorage.setItem('siymon_customer_token_v1','tok');localStorage.setItem('siymon_lang','ar')")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/chat/?store=O1"); pg.wait_for_timeout(1500)
    check("title shows the store name", "بقالة الحي" in pg.inner_text("#chatTitle"), pg.inner_text("#chatTitle"))
    def bubbles(): return pg.eval_on_selector_all("#chatBox .cc-text", "e=>e.map(x=>x.textContent)")
    pg.fill("#chatInput", "مرحبا"); pg.click("#chatSendBtn"); pg.wait_for_timeout(800)
    check("message appears once", bubbles() == ["مرحبا"], bubbles())
    # server down: message not delivered, text restored, then retry succeeds with ONE message
    tset("failNext=1")
    pg.fill("#chatInput", "هل متوفر؟"); pg.click("#chatSendBtn"); pg.wait_for_timeout(800)
    check("failed send keeps the typed text", pg.input_value("#chatInput") == "هل متوفر؟", pg.input_value("#chatInput"))
    check("failed send leaves no ghost bubble", bubbles() == ["مرحبا"], bubbles())
    pg.click("#chatSendBtn"); pg.wait_for_timeout(800)
    check("retry delivers it", bubbles() == ["مرحبا", "هل متوفر؟"], bubbles())
    # response lost AFTER the server stored it: user retries the same text -> still ONE copy on the server
    tset("dropResponseNext=1")
    pg.fill("#chatInput", "شكرا"); pg.click("#chatSendBtn"); pg.wait_for_timeout(1000)
    pg.click("#chatSendBtn"); pg.wait_for_timeout(1000)
    srv = [m["text"] for m in st()["messages"]]
    check("lost response + retry => no duplicate on the server", srv == ["مرحبا", "هل متوفر؟", "شكرا"], srv)
    check("and none on screen", bubbles() == ["مرحبا", "هل متوفر؟", "شكرا"], bubbles())
    # store replies: arrives by polling, nothing lost or repeated
    urllib.request.urlopen(B + "/__t/store-says?text=" + urllib.parse.quote("نعم متوفر") if False else B + "/__t/store-says?text=yes")
    pg.wait_for_timeout(4500)
    check("store reply arrives via polling, once", bubbles() == ["مرحبا", "هل متوفر؟", "شكرا", "yes"], bubbles())
    pg.wait_for_timeout(4500)
    check("later polls do not duplicate", len(bubbles()) == 4, bubbles())
    pg.reload(); pg.wait_for_timeout(1500)
    check("reload restores the full thread", len(bubbles()) == 4, bubbles())
    check("store messages read by customer", all(m.get("readByCustomer") for m in st()["messages"] if m["from"] == "store"))
    b.close()
check("no page errors", not errs, errs[:3])
print("FAILED: %s" % fails if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
