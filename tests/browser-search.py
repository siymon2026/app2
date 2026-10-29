"""Customer search UI on the REAL lib/search.js (mock server, same logic as /api/search).
Run: python3 tests/browser-search.py   (starts its own server on 4014)"""
import subprocess, time, json, urllib.request, sys, tempfile, os
from playwright.sync_api import sync_playwright
PORT = "4014"; B = "http://localhost:" + PORT; TOK = "test-admin-token"
SEED = tempfile.mkdtemp()
json.dump({"restaurants": []}, open(SEED + "/restaurants.json", "w")); json.dump({"items": []}, open(SEED + "/menu.json", "w"))
srv = subprocess.Popen(["node", "tests/ui-mock-server.js"], env={"PORT": PORT, "SEED_DIR": SEED, "PATH": "/usr/bin:/usr/local/bin"}); time.sleep(1.2)
ok = True; errs = []
def call(method, path, body=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", "X-Admin-Token": TOK}, method=method)
    return json.load(urllib.request.urlopen(r))
def check(n, c, x=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x))); ok = ok and bool(c)
try:
    ph = call("POST", "/api/admin/restaurants", {"name": {"ar": "صيدلية النور", "fr": "Pharmacie Nour", "en": "Nour Pharmacy"}, "type": "pharmacy"})["restaurant"]["id"]
    gr = call("POST", "/api/admin/restaurants", {"name": {"ar": "بقالة الأمل", "fr": "Épicerie Espoir", "en": "Hope Grocery"}, "type": "grocery"})["restaurant"]["id"]
    def item(rid, ar, fr, price, **kw): return call("POST", "/api/admin/menu", {"restaurantId": rid, "name": {"ar": ar, "fr": fr, "en": fr}, "price": price, "cat": "x", **kw})["item"]["id"]
    d1 = item(ph, "دوليبران 1000 ملغ", "Doliprane 1000 mg", 12, stock=4)
    d2 = item(ph, "أموكسيسيلين", "Amoxicilline", 30, stock=0)
    item(gr, "حليب", "Lait", 8, stock=50)
    errsx = []
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar")
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errsx.append(str(e)))
        pg.goto(B + "/"); pg.wait_for_selector("#searchInput"); pg.wait_for_timeout(800)
        def type_(q): pg.fill("#searchInput", ""); pg.type("#searchInput", q, delay=15)
        # --- dropdown suggestions ---
        type_("dolipran")   # typo
        pg.wait_for_selector("#sgBox .sg-row", timeout=4000)
        txt = pg.inner_text("#sgBox")
        check("typo still suggests Doliprane with price + store", "Doliprane" in txt or "دوليبران" in txt, txt)
        check("price shown", "12" in txt, txt)
        check("low stock badge (stock 4)", pg.locator("#sgBox .sg-b.low").count() == 1)
        type_("اموكسيسيلين")   # Arabic hamza variant
        pg.wait_for_selector("#sgBox .sg-row", timeout=4000)
        check("Arabic letter variant finds أموكسيسيلين", "أموكسيسيلين" in pg.inner_text("#sgBox") or "Amoxicilline" in pg.inner_text("#sgBox"), pg.inner_text("#sgBox"))
        check("out-of-stock flagged, not hidden", pg.locator("#sgBox .sg-b.na").count() == 1, pg.inner_text("#sgBox"))
        # --- keyboard: ArrowDown + Enter opens the store ---
        type_("lait")
        pg.wait_for_selector("#sgBox .sg-row", timeout=4000)
        pg.keyboard.press("ArrowDown"); check("aria-activedescendant set", bool(pg.get_attribute("#searchInput", "aria-activedescendant")))
        pg.keyboard.press("ArrowDown")
        pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
        check("suggestion opened the store (store mode)", pg.evaluate("document.body.classList.contains('store-mode')") or pg.evaluate("document.body.classList.contains('feed-mode')") is False)
        pg.reload(); pg.wait_for_selector("#searchInput"); pg.wait_for_timeout(800)
        # --- full results panel ---
        pg.fill("#searchInput", "doliprane 1000"); pg.wait_for_selector(".fh-rcard", timeout=5000)
        card = pg.inner_text(".fh-rcard")
        check("results card has store + price", ("12" in card) and ("النور" in card or "Nour" in card), card)
        pg.press("#searchInput", "Escape")
        pg.fill("#searchInput", "amoxicilline"); pg.wait_for_selector(".fh-rcard.off", timeout=5000)
        check("unavailable medicine offers 'ask the pharmacy'", pg.locator(".fh-rcard.off a.ask").count() == 1)
        href = pg.get_attribute(".fh-rcard.off a.ask", "href")
        check("ask link carries store + medicine", ("store=" + ph) in href and "q=" in href, href)
        # --- nothing found -> pharmacy CTA ---
        pg.fill("#searchInput", "zzzxqj"); pg.wait_for_selector(".fh-ask", timeout=5000)
        check("no result -> ask-pharmacy CTA", "/pharmacy/?store=" in pg.get_attribute(".fh-ask", "href"))
        # --- clearing restores the feed ---
        pg.fill("#searchInput", ""); pg.wait_for_timeout(500)
        check("clearing removes result cards", pg.locator(".fh-rcard").count() == 0)
        b.close()
    check("no page errors", not errsx, errsx[:3])
finally:
    srv.terminate()
print("ALL PASSED" if ok else "FAILED"); sys.exit(0 if ok else 1)
