"""Admin panel: Exception center on the REAL exception routes + REAL role table.
Run: node tests/admin-mock-server.js &  python3 tests/browser-admin-exceptions.py   (port 4021)"""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:4021"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def api(method, path, body=None, headers=None):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
async def new_page(b, token, errs, w=1300, h=850):
    ctx = await b.new_context(viewport={"width": w, "height": h}, service_workers="block")
    await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','%s');localStorage.setItem('siymon_admin_sound','0');localStorage.setItem('siymon_admin_lang_v1','en')" % token)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg
async def vis(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s);return !!(e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none')}", sel)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- read-only role: sees the page, but no management controls ----
        ctx, pg = await new_page(b, "tok-driversup", errs); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        check("driver_supervisor: sidebar entry visible (exceptions.read)", await vis(pg, "#sbScroll [data-key=exceptions]"))
        await pg.click("#sbScroll [data-key=exceptions]"); await pg.wait_for_selector("#exceptionsModal.show", timeout=5000)
        check("read-only role: scan/new/settings hidden", not await vis(pg, "#exScan") and not await vis(pg, "#exNew") and not await vis(pg, "#exSet"))
        await ctx.close()
        # ---- system admin: full flow ----
        ctx, pg = await new_page(b, "tok-system", errs); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        await pg.click("#sbScroll [data-key=exceptions]"); await pg.wait_for_selector("#exceptionsModal.show", timeout=5000)
        check("opens inside the panel (route #/exceptions)", "exceptions" in pg.url, pg.url)
        check("title shown", "Exception center" in await pg.inner_text("#exTitle"))
        check("empty at first", await pg.locator("#exItems .ex-item").count() == 0)
        await pg.click("#exScan"); await pg.wait_for_selector("#exItems .ex-item", timeout=5000)
        check("scan finds the 2 real problem orders", await pg.locator("#exItems .ex-item").count() == 2, await pg.inner_text("#exItems"))
        await pg.click("#exScan"); await pg.wait_for_timeout(600)
        check("second scan creates no duplicates", await pg.locator("#exItems .ex-item").count() == 2)
        # open the unassigned one and try to close it WITHOUT a resolution
        await pg.locator("#exItems .ex-item", has_text="Unassigned").click(); await pg.wait_for_selector(".ex-dhead")
        check("case view shows reasons + timeline", "No driver for" in await pg.inner_text("#exDetail") and await pg.locator(".ex-tl li").count() == 1)
        await pg.click(".ex-acts >> button:text-is(\'Close with resolution\')"); await pg.click("#exDetail .ex-form button.pri"); await pg.wait_for_timeout(500)
        check("closing without outcome/note is refused with the server's rule", "outcome and a resolution note" in await pg.inner_text("#exHint"), await pg.inner_text("#exHint"))
        s, d = api("GET", "/__t/ex"); check("case still open on the server", any(c["type"] == "unassigned_order" and c["status"] == "open" for c in d["cases"]))
        # contact + escalate
        await pg.click(".ex-acts >> button:text-is(\'Log a contact\')"); await pg.fill("#exDetail .ex-form textarea", "called the store, they are checking"); await pg.click("#exDetail .ex-form button.pri"); await pg.wait_for_function("document.querySelectorAll('.ex-tl li').length>=2")
        await pg.click(".ex-acts >> button:text-is(\'Escalate\')"); await pg.select_option("#exDetail .ex-form select", "support"); await pg.fill("#exDetail .ex-form textarea", "customer keeps calling"); await pg.click("#exDetail .ex-form button.pri")
        await pg.wait_for_function("document.querySelectorAll('.ex-tl li').length>=3"); await pg.wait_for_timeout(300)
        check("escalation visible: pill + responsible party", "Escalated" in await pg.inner_text(".ex-pills") and "Support" in await pg.inner_text(".ex-info"))
        # now close it properly
        await pg.click(".ex-acts >> button:text-is(\'Close with resolution\')"); await pg.select_option("#exDetail .ex-form select", "reassigned"); await pg.fill("#exDetail .ex-form textarea", "driver 7 accepted manually"); await pg.click("#exDetail .ex-form button.pri")
        await pg.wait_for_selector(".ex-res", timeout=4000)
        check("resolution recorded and shown; no more actions offered", "driver 7 accepted manually" in await pg.inner_text(".ex-res") and not await vis(pg, "#exDetail .ex-acts"))
        # failed delivery: configured attempts (default 2) then escalation
        await pg.locator("#exItems .ex-item", has_text="Failed delivery").click(); await pg.wait_for_selector(".ex-dhead")
        for i, reason in enumerate(["no answer", "wrong address", "phone off"]):
            await pg.click(".ex-acts >> button:text-is(\'Record failed delivery\')"); await pg.fill("#exDetail .ex-form textarea", reason); await pg.click("#exDetail .ex-form button.pri"); await pg.wait_for_timeout(500)
            hint = await pg.inner_text("#exHint")
            if i < 2: check(f"attempt {i+1}: redelivery allowed", "Redelivery allowed" in hint, hint)
            else: check("attempts exhausted -> escalated to supervisor", "exhausted" in hint, hint)
        s, d = api("GET", "/__t/ex"); fo = [o for o in d["orders"] if o["id"] == "X-FAILED"][0]
        check("order record updated (attempt count kept, failure flag cleared)", fo["redeliveryAttempts"] == 3 and "deliveryFailedAt" not in fo, fo)
        # reassign (manual case on an order whose driver has not picked up yet)
        await pg.click("#exNew"); await pg.select_option("#exDetail .ex-form select", "driver_failure"); await pg.fill("#exDetail .ex-form input", "X-ASSIGNED"); await pg.fill("#exDetail .ex-form textarea", "driver phone is off"); await pg.click("#exDetail .ex-form button.pri")
        await pg.wait_for_selector(".ex-dhead", timeout=4000)
        await pg.click(".ex-acts >> button:text-is(\'Reassign driver\')"); check("reassign asks for confirmation", "released" in await pg.inner_text("#exDetail .ex-form")); await pg.click("#exDetail .ex-form button.pri"); await pg.wait_for_timeout(700)
        s, d = api("GET", "/__t/ex"); xo = [o for o in d["orders"] if o["id"] == "X-ASSIGNED"][0]
        check("driver released + dispatch restarted on the server", xo["driverId"] is None and xo["status"] == "restaurant_ready" and d["calls"]["reset"] and d["calls"]["offer"] == ["X-ASSIGNED"], d["calls"])
        # settings (system admin only): out of range is rejected
        await pg.click("#exSet"); await pg.fill("#exDetail input >> nth=0", "1"); await pg.click("#exDetail button.pri"); await pg.wait_for_timeout(400)
        check("settings out of range refused by server", "between" in await pg.inner_text("#exHint"), await pg.inner_text("#exHint"))
        await ctx.close()
        # ---- mobile ----
        ctx, pg = await new_page(b, "tok-system", errs, 390, 800); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.showExceptions && document.getElementById('exceptionsBtn').click()"); await pg.wait_for_selector("#exceptionsModal.show", timeout=5000); await pg.wait_for_selector("#exItems .ex-item", timeout=4000)
        ov = await pg.evaluate("document.querySelector('#exceptionsModal .ex-card').scrollWidth - document.querySelector('#exceptionsModal .ex-card').clientWidth")
        check("390px: no horizontal overflow", ov <= 1, ov)
        await pg.locator("#exItems .ex-item").first.click(); await pg.wait_for_selector(".ex-dhead")
        check("390px: detail replaces list, back button visible", await vis(pg, ".ex-back") and not await vis(pg, ".ex-list"))
        await ctx.close()
        await b.close()
    check("no page errors", not errs, errs)
    print("\nFAILED: %d" % len(fails) if fails else "\nALL PASS"); raise SystemExit(1 if fails else 0)
asyncio.run(main())
