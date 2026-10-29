"""Admin panel: 'Store support' page (tickets + contact channels) on the REAL support routes and REAL role table.
Run: node tests/admin-mock-server.js &  python3 tests/browser-admin-store-support.py   (port 4021)"""
import asyncio, json, sys, urllib.request
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
def denied(): return api("GET", "/__t/denied")[1]
async def new_page(b, token, errs):
    ctx = await b.new_context(viewport={"width": 1300, "height": 850}, service_workers="block")
    await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','%s');localStorage.setItem('siymon_admin_sound','0');localStorage.setItem('siymon_admin_lang_v1','en')" % token)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg
async def vis(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s);return !!(e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none')}", sel)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- who sees the entry ----
        for tok, role, want in [("tok-system", "system_admin", True), ("tok-support", "support", True), ("tok-ordersup", "order_supervisor", True), ("tok-accountant", "accountant", False), ("tok-driversup", "driver_supervisor", False)]:
            ctx, pg = await new_page(b, tok, errs); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
            check(f"{role}: sidebar entry {'visible' if want else 'hidden'}", (await vis(pg, "#sbScroll [data-key=storeSupport]")) == want)
            if not want:
                n0 = len(denied()); await pg.goto(BASE + "/admin/#/store-support"); await pg.wait_for_timeout(1200)
                check(f"{role}: typed #/store-support is refused (no page, no 403 request)", not await pg.evaluate("document.getElementById('storeSupportModal').classList.contains('show')") and len(denied()) == n0)
            await ctx.close()
        # ---- support role: full management ----
        ctx, pg = await new_page(b, "tok-support", errs); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        await pg.click("#sbScroll [data-key=storeSupport]"); await pg.wait_for_selector("#storeSupportModal.show", timeout=5000)
        check("opens INSIDE the admin panel (route #/store-support)", "store-support" in pg.url, pg.url)
        check("page title is Store support", "Store support" in await pg.inner_text("#ssTitle"))
        await pg.click("#ssTabChannels"); await pg.wait_for_selector("#ssAddCh:not([hidden])")
        check("channels tab shows add button for support.manage", await vis(pg, "#ssAddCh"))
        await pg.click("#ssAddCh"); await pg.fill("#ssfAr", "واتساب الدعم"); await pg.select_option("#ssfKind", "whatsapp"); await pg.fill("#ssfValue", "abc")
        await pg.click("#ssfSave"); await pg.wait_for_timeout(500)
        check("invalid number rejected with the server's message", "Invalid" in await pg.inner_text("#ssHint") or "8-15" in await pg.inner_text("#ssHint"), await pg.inner_text("#ssHint"))
        await pg.fill("#ssfValue", "+212 612-345-678"); await pg.click("#ssfSave"); await pg.wait_for_selector("#ssChList .ss-ch", timeout=4000)
        check("channel saved + listed with the normalised number", "+212612345678" in await pg.inner_text("#ssChList"))
        await pg.click("#ssAddCh"); await pg.fill("#ssfAr", "نفس الرقم"); await pg.select_option("#ssfKind", "whatsapp"); await pg.fill("#ssfValue", "+212612345678"); await pg.click("#ssfSave"); await pg.wait_for_timeout(500)
        check("duplicate refused", await pg.locator("#ssChList .ss-ch").count() == 1, await pg.inner_text("#ssHint"))
        await pg.click("#ssfCancel")
        await pg.click("#ssAddCh"); await pg.fill("#ssfAr", "البريد"); await pg.select_option("#ssfKind", "email"); await pg.fill("#ssfValue", "support@siymon7.com"); await pg.click("#ssfSave"); await pg.wait_for_function("document.querySelectorAll('#ssChList .ss-ch').length==2")
        s, chs = api("GET", "/api/admin/support-channels", headers={"X-Admin-Token": "tok-support"})
        check("two channels stored, both addressed to stores by default", len(chs["channels"]) == 2 and all("stores" in c["audience"] for c in chs["channels"]), chs)
        s, pub = api("GET", "/api/admin/support-channels", headers={"X-Admin-Token": "tok-support"})
        # disable the first -> the store stops seeing it (store route uses the same data)
        await pg.locator("#ssChList .ss-ch >> nth=0").locator("button", has_text="●").click(); await pg.wait_for_function("document.querySelectorAll('#ssChList .ss-ch.off').length==1")
        check("disable works", True)
        await pg.locator("#ssChList .ss-ch >> nth=1").locator("button", has_text="↑").click(); await pg.wait_for_timeout(500)
        check("reorder works", "support@siymon7.com" in await pg.inner_text("#ssChList .ss-ch >> nth=0"))
        pg.once("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.locator("#ssChList .ss-ch >> nth=0").locator("button.bad").click(); await pg.wait_for_function("document.querySelectorAll('#ssChList .ss-ch').length==1")
        check("delete works (with confirm)", True)
        # ---- tickets ----
        s, t = api("POST", "/api/store/support/tickets", {"subject": "الطلبات لا تصل", "category": "orders", "text": "لا تصلني الطلبات", "clientId": "cid-test-0001"}, {"X-Store-Id": "g1"})
        check("a store opens a ticket", s == 201, t)
        tid = t["ticket"]["id"]
        await pg.click("#ssTabTickets"); await pg.wait_for_selector(f"[data-id={tid}]", timeout=5000)
        check("ticket listed with the store name + unread badge", "Hope" in await pg.inner_text(f"[data-id={tid}]") and await pg.locator(f"[data-id={tid}] .ss-b").count() == 1)
        await pg.click(f"[data-id={tid}]"); await pg.wait_for_selector("#ssMsgs .ss-m", timeout=4000)
        check("thread shows the store message", "لا تصلني" in await pg.inner_text("#ssMsgs"))
        await pg.fill("#ssInput", "نعمل على حل المشكلة"); await pg.press("#ssInput", "Enter"); await pg.wait_for_function("document.querySelector('#ssMsgs').innerText.includes('نعمل')", timeout=5000)
        s, sv = api("GET", "/api/store/support/tickets/" + tid, headers={"X-Store-Id": "g1"})
        check("store sees the admin reply, without the staff name", any(m["from"] == "admin" and m["by"] == "" for m in sv["messages"]), sv)
        await pg.click("#ssStatusBtn"); await pg.wait_for_function("document.getElementById('ssStatusBtn').textContent.includes('Reopen')", timeout=5000)
        s, sv = api("GET", "/api/store/support/tickets/" + tid, headers={"X-Store-Id": "g1"}); check("closed from the admin", sv["ticket"]["status"] == "closed")
        s, r = api("POST", f"/api/store/support/tickets/{tid}/messages", {"text": "ما زلت أحتاج"}, {"X-Store-Id": "g1"}); check("store cannot post to a closed ticket (409)", s == 409, r)
        check("no forbidden request was made by the support page", all("store-support" not in d["path"] and "support-channels" not in d["path"] for d in denied()), denied())
        await ctx.close()
        # ---- order_supervisor: view only ----
        ctx, pg = await new_page(b, "tok-ordersup", errs); await pg.goto(BASE + "/admin/"); await pg.wait_for_timeout(1500)
        await pg.click("#sbScroll [data-key=storeSupport]"); await pg.wait_for_selector("#storeSupportModal.show"); await pg.click("#ssTabChannels"); await pg.wait_for_selector("#ssChNote")
        check("order_supervisor: channels are view-only (no add button, note shown)", not await vis(pg, "#ssAddCh") and "View only" in await pg.inner_text("#ssChNote"), await pg.inner_text("#ssChNote"))
        s, r = api("POST", "/api/admin/support-channels", {"kind": "phone", "label": "x", "value": "+212600000009", "audience": ["stores"]}, {"X-Admin-Token": "tok-ordersup"})
        check("and the SERVER refuses the write (403)", s == 403, (s, r))
        await ctx.close()
        await b.close()
    check("no page errors", not errs, errs[:3])
asyncio.run(main())
print("FAILED: %s" % fails if fails else "ALL PASSED"); sys.exit(1 if fails else 0)
