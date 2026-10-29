"""Admin panel: System settings + audit log on the REAL settings routes, REAL role table and REAL audit store.
Run: node tests/admin-mock-server.js &  python3 tests/browser-admin-system.py   (port 4021)"""
import asyncio, json, time, urllib.request
PRICE = round(1 + (time.time() % 40), 2)  # unique per run so the test is repeatable on one server
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:4021"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def get(path):
    with urllib.request.urlopen(BASE + path) as x: return json.load(x)
async def new_page(b, token, errs, w=1300, h=850):
    ctx = await b.new_context(viewport={"width": w, "height": h}, service_workers="block")
    await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','%s');localStorage.setItem('siymon_admin_sound','0');" % token)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg
async def open_system(pg):
    await pg.goto(BASE + "/admin/")
    await pg.wait_for_selector(".sb-item[data-key=system]", state="visible", timeout=8000)
    await pg.locator(".sb-item[data-key=system]").click()
    await pg.wait_for_selector("#systemModal.show", timeout=8000)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- system admin
        ctx, pg = await new_page(b, "tok-system", errs)
        dialogs = []
        pg.on("dialog", lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.accept())))
        await open_system(pg)
        n = await pg.locator("#sysBody .sys-group").count()
        check("settings tab lists all 7 groups for system_admin", n == 7, n)
        check("audit tab is available", await pg.locator("#sysTabA").is_visible())
        # change the price per km through the UI
        grp = pg.locator("#sysBody .sys-group").first
        await grp.locator("select").select_option("distance")
        await grp.locator("input[type=number]").first.fill(str(PRICE))
        await grp.locator("button.pri").click(); await pg.wait_for_timeout(800)
        cfg = get("/__t/config")
        check("price per km saved to the real store", cfg.get("deliveryPricePerKm") == PRICE and cfg.get("deliveryPricingMode") == "distance", cfg)
        check("sensitive change asked for confirmation", len(dialogs) == 1, dialogs)
        # out-of-range value: server refuses, UI shows the server message, nothing saved
        await pg.locator("#sysBody .sys-group").first.locator("input[type=number]").first.fill("999")
        await pg.locator("#sysBody .sys-group").first.locator("button.pri").click(); await pg.wait_for_timeout(600)
        hint = (await pg.locator("#sysHint").inner_text()).strip()
        check("out-of-range refused with a server message", "between" in hint, hint)
        check("refused value not stored", get("/__t/config").get("deliveryPricePerKm") == PRICE)
        # audit tab
        await pg.locator("#sysTabA").click(); await pg.wait_for_selector(".sys-row", timeout=5000)
        rows = await pg.locator(".sys-row").count()
        check("audit list shows records", rows >= 3, rows)
        await pg.fill("#sysFAction", "settings.*"); await pg.select_option("#sysFResult", "rejected"); await pg.locator("#sysList").evaluate("e=>e") ; await pg.get_by_role("button").filter(has_text="بحث").first.click(); await pg.wait_for_timeout(600)
        check("filter narrows to the rejected attempt", await pg.locator(".sys-row").count() >= 1, await pg.locator(".sys-row").count())
        await pg.locator(".sys-row").first.click()
        check("row details expand (previous/attempted visible)", "attempted" in await pg.locator(".sys-det pre").first.inner_text())
        await pg.get_by_role("button").filter(has_text="فحص سلامة").click(); await pg.wait_for_timeout(500)
        ver = await pg.locator("#sysVer").inner_text()
        check("integrity check reports intact", "good" in (await pg.locator("#sysVer").get_attribute("class")), ver)
        await ctx.close()
        # ---- accountant: read-only pricing, no audit tab, no forbidden request
        ctx, pg = await new_page(b, "tok-accountant", errs)
        await open_system(pg)
        ids = await pg.locator("#sysBody .sys-group h4").count()
        check("accountant sees only readable groups", ids == 3, ids)
        check("accountant has no Save buttons", await pg.locator("#sysBody button.pri").count() == 0)
        check("accountant has no audit tab", not await pg.locator("#sysTabA").is_visible())
        den = get("/__t/denied")
        check("no forbidden request was made by the accountant UI", not any(r["role"] == "accountant" and "/settings" in r["path"] for r in den), den)
        await ctx.close()
        # ---- order supervisor: page is not reachable
        ctx, pg = await new_page(b, "tok-ordersup", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(2000)
        check("order supervisor does not get the sidebar entry", not await pg.locator(".sb-item[data-key=system]").is_visible(), "")
        await ctx.close(); await b.close()
    check("no JS errors", not errs, errs)
    print("FAILED" if fails else "ALL PASS"); raise SystemExit(1 if fails else 0)
asyncio.run(main())
