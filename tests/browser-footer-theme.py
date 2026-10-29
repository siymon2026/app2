"""White-flash / white-footer check: while the page's scripts are still loading (slow phone), a customer page in the
saved DARK theme must already be dark (background + footer). Run: python3 tests/browser-footer-theme.py"""
import subprocess, time, json, tempfile, sys
from playwright.sync_api import sync_playwright
SEED = tempfile.mkdtemp(); json.dump({"restaurants": []}, open(SEED + "/restaurants.json", "w")); json.dump({"items": []}, open(SEED + "/menu.json", "w"))
srv = subprocess.Popen(["node", "tests/ui-mock-server.js"], env={"PORT": "4016", "SEED_DIR": SEED, "PATH": "/usr/bin:/usr/local/bin"}); time.sleep(1.2)
ok = True
def check(n, c, x=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x))); ok = ok and bool(c)
LUM = """()=>{const p=s=>{const m=s.match(/[\\d.]+/g);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255};
const f=document.querySelector('footer');
return {theme:document.documentElement.getAttribute('data-theme'),body:p(getComputedStyle(document.body).backgroundColor),footer:f?p(getComputedStyle(f).backgroundColor):null,
metaTheme:(document.querySelector('meta[name=theme-color]')||{}).content||null}}"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for path in ["/", "/orders/", "/notifications/", "/support/", "/stores/", "/chat/", "/pharmacy/"]:
            ctx = b.new_context(viewport={"width": 390, "height": 800}, service_workers="block")
            ctx.add_init_script("localStorage.setItem('siymon_customer_token_v1','x');localStorage.setItem('siymon_theme_v3','dark');")
            pg = ctx.new_page()
            # slow phone: every OTHER script of the page arrives 1.5 s late (the theme bootstrap must not depend on them)
            def slow(route):
                u = route.request.url
                if u.endswith(".js") and "theme-boot" not in u and "siymon-page" not in u:
                    time.sleep(1.5)
                route.continue_()
            pg.route("**/*.js", slow)
            pg.goto("http://localhost:4016" + path, wait_until="commit"); pg.wait_for_timeout(700)
            r = pg.evaluate(LUM)
            check(f"{path}: dark before the page scripts finish (theme={r['theme']}, body={r['body']:.2f}, footer={r['footer']})", r["theme"] == "dark" and r["body"] < 0.3 and (r["footer"] is None or r["footer"] < 0.3 or r["footer"] == 0), r)
            ctx.close()
        # light theme keeps working and the meta theme-color follows it
        ctx = b.new_context(viewport={"width": 390, "height": 800}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('siymon_theme_v3','light');")
        pg = ctx.new_page(); pg.goto("http://localhost:4016/"); pg.wait_for_timeout(900)
        r = pg.evaluate(LUM)
        check("light theme still light + meta theme-color light", r["theme"] is None and r["body"] > 0.8 and (r["metaTheme"] or "").lower() in ("#f8f8f8", "#ffffff"), r)
        ctx.close(); b.close()
finally:
    srv.terminate()
print("ALL PASSED" if ok else "FAILED"); sys.exit(0 if ok else 1)
