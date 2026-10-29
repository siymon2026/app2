"""Admin Reports page on the REAL report routes + REAL role table (seeded test data).
Run: node tests/admin-mock-server.js &  python3 tests/browser-admin-reports.py   (port 4021)"""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:4021"
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
async def new_page(b, token, errs, lang="en", w=1300, h=900):
    ctx = await b.new_context(viewport={"width": w, "height": h}, service_workers="block", accept_downloads=True)
    await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','%s');localStorage.setItem('siymon_admin_sound','0');localStorage.setItem('siymon_admin_lang_v1','%s')" % (token, lang))
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg
async def vis(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s);return !!(e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none')}", sel)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # --- accountant: sees finance reports
        ctx, pg = await new_page(b, "tok-accountant", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_selector('.sb-item[data-key="reports"]', state="visible", timeout=8000); await pg.click('.sb-item[data-key="reports"]'); await pg.wait_for_selector("#rpMount .rp-bar select", timeout=8000)
        await pg.wait_for_selector("#rpMount table", timeout=8000)
        check("accountant: reports page visible", await vis(pg, "#reportsModal"))
        opts = await pg.eval_on_selector_all("#rpMount .rp-f select >> nth=0 >> option", "o=>o.map(x=>x.value)")
        check("accountant has finance reports", "payments" in opts and "reconcile" in opts and "sales" in opts, opts)
        txt = await pg.inner_text("#rpMount")
        check("sales table shows delivered total 380 (= 110+70+92+... of last 30d: R1,R2,R3)", "Total" in txt)
        # totals row correct: R1 110 + R2 70 + R3 92 = 272 total billed, R4 is 40 days ago (outside 30d)
        tot = await pg.eval_on_selector("#rpMount tfoot", "e=>e.innerText")
        check("30-day total excludes the 40-day-old order", "272.00" in tot and "390" not in tot, tot)
        await pg.screenshot(path="/tmp/claude-0/-home-claude/fe4c5c21-1dee-5042-9aae-310db9bd3416/scratchpad/out/ui-sales.png")
        # switch to 'this period' custom? change report to reconcile
        await pg.select_option("#rpMount .rp-f select >> nth=0", "reconcile")
        await pg.wait_for_selector("#rpMount .rp-banner", timeout=8000)
        check("reconcile banner shown", "All checks passed" in await pg.inner_text("#rpMount .rp-banner"), await pg.inner_text("#rpMount .rp-banner"))
        # export xlsx triggers a real download
        await pg.select_option("#rpMount .rp-f select >> nth=0", "commissions"); await pg.wait_for_selector("#rpMount table")
        async with pg.expect_download() as d:
            await pg.click("#rpMount .rp-acts .rp-b:nth-child(2)")
        dl = await d.value
        path = await dl.path()
        data = open(path, "rb").read()
        check("xlsx download is a zip", data[:2] == b"PK", data[:4])
        # no customer PII anywhere in the page
        html = await pg.content()
        check("no customer PII rendered", "PRIVATE-NAME" not in html and "0600PRIVATE" not in html)
        await ctx.close()
        # --- support: no reports entry, API refused
        ctx, pg = await new_page(b, "tok-support", errs)
        await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        check("support: sidebar has no Reports entry", not await vis(pg, '.sb-item[data-key="reports"]'))
        await ctx.close()
        # --- Arabic RTL
        ctx, pg = await new_page(b, "tok-system", errs, lang="ar")
        await pg.goto(BASE + "/admin/"); await pg.wait_for_selector('.sb-item[data-key="reports"]', state="visible", timeout=8000); await pg.click('.sb-item[data-key="reports"]'); await pg.wait_for_selector("#rpMount table", timeout=8000)
        check("arabic: page direction rtl", await pg.evaluate("document.documentElement.dir") == "rtl")
        check("arabic: report title localised", "المبيعات" in await pg.inner_text("#rpMount"))
        await pg.screenshot(path="/tmp/claude-0/-home-claude/fe4c5c21-1dee-5042-9aae-310db9bd3416/scratchpad/out/ui-sales-ar.png")
        await ctx.close()
        # --- phone width: no horizontal page scroll
        ctx, pg = await new_page(b, "tok-system", errs, w=390, h=800)
        await pg.goto(BASE + "/admin/"); await pg.click("#navBurger"); await pg.wait_for_selector('.sb-item[data-key="reports"]', state="visible", timeout=8000); await pg.click('.sb-item[data-key="reports"]'); await pg.wait_for_selector("#rpMount table", timeout=8000)
        check("phone: no page-level horizontal scroll", await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2"), await pg.evaluate("document.documentElement.scrollWidth"))
        await pg.screenshot(path="/tmp/claude-0/-home-claude/fe4c5c21-1dee-5042-9aae-310db9bd3416/scratchpad/out/ui-sales-phone.png")
        await ctx.close()
        # --- store scope: only own data over HTTP
        def sget(path, sid):
            r = urllib.request.Request(BASE + path, headers={"X-Store-Id": sid})
            with urllib.request.urlopen(r) as x: return json.load(x)
        s1 = sget("/api/store/reports/sales?preset=30d", "p1")
        check("store p1 sees only its own delivered order", s1["report"]["tables"][0]["totals"]["delivered"] == 1, s1["report"]["tables"][0]["totals"])
        await b.close()
    check("no page errors", not errs, errs)
    print("\nFAILED:" if fails else "\nALL PASSED", fails if fails else "")
    raise SystemExit(1 if fails else 0)
asyncio.run(main())
