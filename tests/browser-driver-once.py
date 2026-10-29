"""(1) Driver app: the 'enable sound' card shows once per device.  (2) Customer app: the driver-rating card pops up once per delivery.
Run: python3 tests/browser-driver-once.py   (starts its own server on 4015)"""
import subprocess, time, json, urllib.request, sys
from playwright.sync_api import sync_playwright
PORT = "4015"; B = "http://localhost:" + PORT
srv = subprocess.Popen(["node", "tests/driver-rate-server.js"], env={"PORT": PORT, "PATH": "/usr/bin:/usr/local/bin"}); time.sleep(1.2)
ok = True
def check(n, c, x=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x))); ok = ok and bool(c)
def st(): return json.load(urllib.request.urlopen(B + "/__t/state"))
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ================= driver sound gate =================
        ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar", service_workers="block")
        ctx.add_init_script("localStorage.setItem('SIYMON_DRIVER_TOKEN','dtok')")
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/driver/"); pg.wait_for_timeout(1500)
        gate = lambda: pg.evaluate("document.getElementById('soundGate').classList.contains('show-flex')")
        check("first ever load: card shown (autoplay needs a tap)", gate())
        check("persisted as shown", pg.evaluate("localStorage.getItem('SIYMON_DRIVER_SOUND_PROMPTED')") == "1")
        pg.reload(); pg.wait_for_timeout(1500)
        check("reload WITHOUT tapping: card does not come back", not gate())
        pg.reload(); pg.wait_for_timeout(1200)
        pg.mouse.click(200, 400); pg.wait_for_timeout(500)
        check("after a tap + another reload: still no card", not gate())
        # user taps the card itself on a fresh device
        pg.evaluate("localStorage.removeItem('SIYMON_DRIVER_SOUND_PROMPTED')"); pg.reload(); pg.wait_for_timeout(1500)
        check("fresh device: shown again (flag cleared)", gate())
        pg.click("#soundGateBtn"); pg.wait_for_timeout(400)
        check("tap 'enable sound' hides it", not gate())
        pg.reload(); pg.wait_for_timeout(1500)
        check("and it never returns after enabling", not gate())
        check("sound setting stays on", pg.evaluate("localStorage.getItem('SIYMON_DRIVER_SOUND')") in (None, "1"))
        ctx.close()
        # ================= customer rating card =================
        urllib.request.urlopen(B + "/__t/reset")
        ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar", service_workers="block")
        ctx.add_init_script("localStorage.setItem('siymon_customer_token_v1','ctok')")
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        shown = lambda: pg.evaluate("!!document.querySelector('#drvRateModal.show')")
        pg.goto(B + "/orders/"); pg.wait_for_timeout(2000)
        check("rating card pops up after delivery", shown())
        pg.wait_for_timeout(500)
        s = st(); check("server remembers it was prompted (once, saved once)", s["order"].get("ratingPromptedAt") and s["state"]["saves"] == 1, s)
        pg.click("#rdLater"); pg.wait_for_timeout(300)
        check("'later' closes it", not shown())
        pg.click("#refreshOrders"); pg.wait_for_timeout(1200)
        check("data refresh does not reopen it", not shown())
        pg.reload(); pg.wait_for_timeout(2000)
        check("reload does not reopen it", not shown())
        pg.evaluate("localStorage.removeItem('siymon_rate_driver_prompted_v1')"); pg.reload(); pg.wait_for_timeout(2000)
        check("even with the local flag lost, the server flag keeps it closed (other device)", not shown())
        pg.click("[data-action=rate-driver]"); pg.wait_for_timeout(300)
        check("manual 'Rate driver' button still opens it", shown())
        pg.click("#drvRateModal .star-btn[data-star='5']"); pg.click("#drvRateModal .rd-yn[data-q=polite] .rd-yn-b[data-v=yes]"); pg.click("#drvRateModal .rd-yn[data-q=extra] .rd-yn-b[data-v=no]")
        pg.once("dialog", lambda d: d.accept()); pg.click("#rdSend"); pg.wait_for_timeout(1000)
        check("rating saved on the order", st()["order"].get("driverRating", {}).get("stars") == 5)
        pg.reload(); pg.wait_for_timeout(2000)
        check("after rating: never again, button gone", not shown() and pg.locator("[data-action=rate-driver]").count() == 0)
        # old delivery (>48h) is not auto-prompted
        ctx.close()
        b.close()
    check("no page errors", not errs, errs[:3])
finally:
    srv.terminate()
print("ALL PASSED" if ok else "FAILED"); sys.exit(0 if ok else 1)
