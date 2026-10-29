"""Customer wallet in the profile + page colours (footer/bottom bar) on small phones.
Run: python3 tests/browser-customer-wallet.py   (starts its own server on 4017)"""
import subprocess, time, json, tempfile, sys
from playwright.sync_api import sync_playwright
PORT = "4017"; B = "http://localhost:" + PORT
SEED = tempfile.mkdtemp(); json.dump({"restaurants": []}, open(SEED + "/restaurants.json", "w")); json.dump({"items": []}, open(SEED + "/menu.json", "w"))
srv = subprocess.Popen(["node", "tests/ui-mock-server.js"], env={"PORT": PORT, "SEED_DIR": SEED, "PATH": "/usr/bin:/usr/local/bin"}); time.sleep(1.2)
ok = True; errs = []
def check(n, c, x=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x))); ok = ok and bool(c)
PROFILE = json.dumps({"firstName": "علي", "lastName": "الإدريسي", "phone": "0611111111"})
def ctx_for(b, w, theme, token="ctok"):
    c = b.new_context(viewport={"width": w, "height": 700}, locale="ar", service_workers="block")
    c.add_init_script("localStorage.setItem('siymon_theme_v3','%s');%s" % (theme, ("localStorage.setItem('siymon_customer_token_v1','%s');localStorage.setItem('siymon_customer_profile_v1',%s);" % (token, json.dumps(PROFILE))) if token else ""))
    return c
def nav_profile(pg):
    later = pg.get_by_text("لاحقًا")
    if later.count() and later.first.is_visible(): later.first.click(); pg.wait_for_timeout(400)
    pg.click("#nav_user")
def rgb(pg, sel): return pg.evaluate("s=>{const e=document.querySelector(s);return e?getComputedStyle(e).backgroundColor:null}", sel)
def lum(c):
    import re
    r, g, b = [int(x) for x in re.findall(r"\d+", c)[:3]]; return (r + g + b) / 3
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in (320, 360, 412):
            c = ctx_for(b, w, "dark"); pg = c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(B + "/"); pg.wait_for_selector("#searchInput"); pg.wait_for_timeout(700)
            nav_profile(pg); pg.wait_for_selector("#pfWallet", timeout=5000); pg.wait_for_timeout(600)
            check(f"[{w}] profile wallet shows the real balance", "125.50" in pg.inner_text("#pfWalletAmt"), pg.inner_text("#pfWallet"))
            over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            box = pg.evaluate("(()=>{const r=document.getElementById('pfWallet').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
            check(f"[{w}] wallet card inside the screen, no sideways scroll", over <= 0 and box[0] >= 0 and box[1] <= box[2], (over, box))
            pg.click("#pfWalletOpen"); pg.wait_for_selector("#walletFrame[src]", timeout=4000)
            fr = pg.frame_locator("#walletFrame"); fr.locator("#wBal").wait_for(timeout=5000)
            check(f"[{w}] wallet sheet shows balance + history", "125.50" in fr.locator("#wBal").inner_text() and fr.locator(".w-row").count() >= 2)
            c.close()
        # logged-out: no wallet card, no crash
        c = ctx_for(b, 360, "dark", token=None); pg = c.new_page(); pg.goto(B + "/"); pg.wait_for_selector("#searchInput"); pg.wait_for_timeout(500)
        nav_profile(pg); pg.wait_for_timeout(500)
        check("guest: no wallet card", pg.locator("#pfWallet").count() == 0); c.close()
        # orders page wallet chip
        c = ctx_for(b, 360, "dark"); pg = c.new_page(); pg.goto(B + "/orders/"); pg.wait_for_selector("#pfWalletAmt", timeout=6000); pg.wait_for_timeout(800)
        check("orders profile chip shows the real balance", "125.50" in pg.inner_text("#pfWalletAmt"), pg.inner_text("#pfWalletAmt")); c.close()
        # colours: dark theme => every customer page is dark at the bottom, light theme => light (no white in dark / no dark in light)
        for theme in ("dark", "light"):
            for path in ("/", "/orders/", "/wallet/", "/policy/", "/chat/", "/pharmacy/", "/notifications/", "/support/", "/stores/"):
                c = ctx_for(b, 360, theme); pg = c.new_page(); pg.goto(B + path); pg.wait_for_timeout(1800)
                if not pg.url.split("?")[0].endswith(path): print("SKIP %s (redirects without a real backend: %s)" % (path, pg.url)); c.close(); continue
                pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); pg.wait_for_timeout(200)
                body = rgb(pg, "body"); f = rgb(pg, "footer"); foot = f if f and "0, 0, 0, 0" not in f else body
                want_dark = theme == "dark"
                check(f"{theme} {path}: body/footer colour matches theme", (lum(body) < 80) == want_dark and (lum(foot) < 80) == want_dark, (body, f))
                check(f"{theme} {path}: color-scheme follows theme", pg.evaluate("document.documentElement.style.colorScheme") == theme, pg.evaluate("document.documentElement.style.colorScheme"))
                c.close()
        b.close()
    check("no page errors", not errs, errs[:3])
finally:
    srv.terminate()
print("ALL PASSED" if ok else "FAILED"); sys.exit(0 if ok else 1)
