"""Browser test (real admin page + real role table, mock API): permissions UI + auto-refresh resume.
Run: node tests/admin-mock-server.js &  python3 tests/browser-admin-perms-refresh.py
"""
import asyncio, json, sys, urllib.request
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:4021"
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" -> " + str(extra) if extra and not cond else ""))
    if not cond: fails.append(name)
def get(path):
    return json.load(urllib.request.urlopen(BASE + "/__t/" + path))

async def new_page(b, token, errs):
    ctx = await b.new_context(viewport={"width": 1300, "height": 850})
    await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','%s');localStorage.setItem('siymon_admin_sound','0')" % token)
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg

async def vis(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s);return !!(e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none')}", sel)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- permissions ----------
        for tok, role, shown, hidden_ in [
            ("tok-system", "system_admin", ["#sbScroll [data-key=settings]", "#sbScroll [data-key=drivers]", "#sbScroll [data-key=topups]"], []),
            ("tok-support", "support", ["#sbScroll [data-key=support]", "#sbScroll [data-key=customers]", "#sbScroll [data-key=drivers]"],
             ["#sbScroll [data-key=settings]", "#sbScroll [data-key=topups]", "#sbScroll [data-key=dispatch]", "#sbScroll [data-key=notifications]", "#sbScroll [data-key=menuManage]", "#sbPortal"]),
            ("tok-accountant", "accountant", ["#sbScroll [data-key=topups]"], ["#sbScroll [data-key=support]", "#sbScroll [data-key=drivers] >> nth=0", "#sbScroll [data-key=dispatch]", "#sbScroll [data-key=settings]"]),
        ]:
            ctx, pg = await new_page(b, tok, errs)
            await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
            for s in shown:
                if "nth" in s: continue
                check(f"{role}: sees {s.split('=')[-1]}", await vis(pg, s))
            for s in hidden_:
                if "nth" in s: continue
                check(f"{role}: does NOT see {s.split('=')[-1]}", not await vis(pg, s))
            await ctx.close()
        # accountant drivers.read is granted -> visible; driver_supervisor lacks finance/support
        ctx, pg = await new_page(b, "tok-driversup", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        check("driver_supervisor: no topups", not await vis(pg, "#sbScroll [data-key=topups]"))
        check("driver_supervisor: no support", not await vis(pg, "#sbScroll [data-key=support]"))
        check("driver_supervisor: no accept/done order buttons", not await vis(pg, "[data-action=accept]") and not await vis(pg, "[data-action=done]"))
        await ctx.close()
        # support role: order action buttons hidden, view still there
        ctx, pg = await new_page(b, "tok-support", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        check("support: order row visible", await pg.locator("#ordersBody tr").count() >= 1)
        check("support: accept/done/wifi hidden", not await vis(pg, "[data-action=accept]") and not await vis(pg, "[data-action=done]") and not await vis(pg, "[data-action=wifi]"))
        check("support: view button still visible", await vis(pg, "[data-action=view]"))
        await pg.locator("#ordersBody tr").first.click(); await pg.wait_for_timeout(500)
        check("support: no assign-driver / edit-ticket in details", not await vis(pg, "#assignDriverBtn") and not await vis(pg, "#editTicketDetails"))
        # typed route to a forbidden page must bounce to Orders
        await pg.evaluate("location.hash='#/settings'"); await pg.wait_for_timeout(800)
        check("support: #/settings refused", await pg.evaluate("location.hash") in ("#/", "") and not await vis(pg, "#settingsModal.show"))
        await pg.evaluate("location.hash='#/topups'"); await pg.wait_for_timeout(800)
        check("support: #/topups refused", not await vis(pg, "#topupsModal.show"))
        await pg.evaluate("location.hash='#/support'"); await pg.wait_for_timeout(1000)
        check("support: #/support allowed", await vis(pg, "#supportModal.show"))
        await ctx.close()
        # system admin: order buttons present, #/settings opens
        ctx, pg = await new_page(b, "tok-system", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        check("system: accept button visible", await vis(pg, "[data-action=accept]"))
        await pg.evaluate("location.hash='#/settings'"); await pg.wait_for_timeout(1000)
        check("system: #/settings opens", await vis(pg, "#settingsModal.show"))
        await ctx.close()
        # ---------- no forbidden request was ever made by any restricted role ----------
        d = json.load(urllib.request.urlopen(BASE + "/__t/denied"))
        check("no 403 produced by the UI for any role", len(d) == 0, d[:6])

        # ---------- auto refresh ----------
        ctx, pg = await new_page(b, "tok-ordersup", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        n0 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        await pg.wait_for_timeout(11500)
        n1 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        check("auto refresh polls orders (>=2 in 11s)", n1 - n0 >= 2, (n0, n1))
        # reload the page: polling must resume
        await pg.reload(); await pg.wait_for_timeout(1500)
        m0 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        await pg.wait_for_timeout(11500)
        m1 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        check("after page reload polling resumes (>=2 in 11s)", m1 - m0 >= 2, (m0, m1))
        # manual refresh triggers a request immediately and polling continues
        k0 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        await pg.click("#refreshBtn"); await pg.wait_for_timeout(700)
        k1 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        check("manual refresh fetches orders at once", k1 - k0 >= 1, (k0, k1))
        check("refresh button not stuck busy", not await pg.evaluate("document.getElementById('refreshBtn').classList.contains('busy')"))
        await pg.wait_for_timeout(6500)
        k2 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        check("auto refresh continues after manual refresh", k2 - k1 >= 1, (k1, k2))
        await ctx.close()
        # a hanging loader must NOT prevent auto refresh after reload (the original bug)
        urllib.request.urlopen(BASE + "/__t/hang?p=/api/admin/drivers")
        ctx, pg = await new_page(b, "tok-ordersup", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(2000)
        h0 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        await pg.wait_for_timeout(11500)
        h1 = json.load(urllib.request.urlopen(BASE + "/__t/count?re=%5E%2Fapi%2Forders%24"))["n"]
        check("polling runs even though /api/admin/drivers hangs", h1 - h0 >= 2, (h0, h1))
        urllib.request.urlopen(BASE + "/__t/unhang")
        await ctx.close()
        await b.close()
    check("no page errors", not errs, errs[:5])
    print("\nFAILED: %s" % fails if fails else "\nALL PASSED")
    sys.exit(1 if fails else 0)
asyncio.run(main())
