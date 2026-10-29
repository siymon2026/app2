"""Supervisor service-zones page (public/admin/zones/) against the REAL lib/service-zone-routes.js + REAL role table.
Leaflet is replaced by tests/leaflet-stub.js (the sandbox cannot reach cdnjs): this verifies the page LOGIC (list, form, permissions,
save/delete/confirmations, errors, i18n, layout) but NOT real map rendering.
Run: node tests/zones-mock-server.js &  python3 tests/browser-admin-zones.py   (port 4031)"""
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
BASE = "http://127.0.0.1:4031"
STUB = open(os.path.join(os.path.dirname(__file__), "leaflet-stub.js")).read()
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x)))
    if not c: fails.append(n)
def api(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token: h["X-Admin-Token"] = token
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
SQ = [[33.20, -7.65], [33.20, -7.55], [33.30, -7.55], [33.30, -7.65]]
async def new_page(b, token, lang, errs, w=1300, h=850):
    ctx = await b.new_context(viewport={"width": w, "height": h}, service_workers="block")
    await ctx.route("**/leaflet.min.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=STUB))
    await ctx.route("**/leaflet.min.css", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    init = "localStorage.setItem('siymon_admin_lang_v1','%s');" % lang
    if token: init += "localStorage.setItem('siymon_admin_token_v2','%s');" % token
    await ctx.add_init_script(init)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    dialogs = []
    async def on_dialog(d): dialogs.append(d.message); await d.accept()
    pg.on("dialog", on_dialog)
    return ctx, pg, dialogs
async def vis(pg, sel):
    return await pg.evaluate("s=>{const e=document.querySelector(s);return !!(e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none')}", sel)
async def text(pg, sel): return await pg.inner_text(sel)

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        api("POST", "/__reset")

        # ---- not signed in ----
        ctx, pg, _ = await new_page(b, None, "en", errs); await pg.goto(BASE + "/admin/zones/"); await pg.wait_for_timeout(600)
        check("no token: asks to sign in, no crash", "sign in" in (await text(pg, "#znRoleNote")).lower())
        await ctx.close()

        # ---- accountant: no zones.read ----
        ctx, pg, _ = await new_page(b, "tok-accountant", "en", errs); await pg.goto(BASE + "/admin/zones/"); await pg.wait_for_timeout(900)
        check("accountant: refused with a clear message", "may not" in (await text(pg, "#znRoleNote")).lower(), await text(pg, "#znRoleNote"))
        check("accountant: sees no zones", await pg.locator("#znList li").count() == 0)
        await ctx.close()

        # ---- read-only supervisor ----
        ctx, pg, _ = await new_page(b, "tok-ordersup", "en", errs); await pg.goto(BASE + "/admin/zones/"); await pg.wait_for_selector("#znList li", timeout=5000)
        check("supervisor: sees the seeded zone", await pg.locator("#znList li").count() == 1 and "Berrechid" in await text(pg, "#znList"))
        check("supervisor: placeholder-boundary banner shown", await vis(pg, "#znSeedNote"))
        check("supervisor: read-only note shown", await vis(pg, "#znRoleNote"))
        check("supervisor: New-zone button hidden", not await vis(pg, "#znNew"))
        await pg.click("#znList li button"); await pg.wait_for_timeout(200)
        check("supervisor: no edit form, no drawing tools", not await vis(pg, "#znForm") and not await vis(pg, "#znTools"))
        check("tile URL comes from /api/map-config", await pg.evaluate("__stub.tileUrl()") == "https://tiles.test/{z}/{x}/{y}.png")
        await pg.click("#znTestBtn")
        await pg.evaluate("__stub.click(33.2655,-7.5875)"); await pg.wait_for_function("document.querySelector('#znTestOut').textContent.includes('Inside')", timeout=4000)
        check("dry-run inside Berrechid -> inside", "Inside the service area" in await text(pg, "#znTestOut"), await text(pg, "#znTestOut"))
        await pg.evaluate("__stub.click(33.60,-7.60)"); await pg.wait_for_function("document.querySelector('#znTestOut').textContent.includes('Outside')", timeout=4000)
        out = await text(pg, "#znTestOut")
        check("dry-run outside -> outside + the customer-facing reason", "Outside the service area" in out and "outside our service areas" in out, out)
        st, _ = api("PUT", "/api/admin/service-zones/zone_berrechid", {"active": False, "confirmBlockAll": True}, "tok-ordersup")
        check("server also refuses a supervisor's direct edit (403)", st == 403, st)
        await ctx.close()

        # ---- system administrator ----
        api("POST", "/__reset")
        ctx, pg, dialogs = await new_page(b, "tok-system", "en", errs); await pg.goto(BASE + "/admin/zones/"); await pg.wait_for_selector("#znList li", timeout=5000)
        check("admin: New-zone button visible, no read-only note", await vis(pg, "#znNew") and not await vis(pg, "#znRoleNote"))
        await pg.click("#znList li button"); await pg.wait_for_selector("#znForm:not([hidden])", timeout=3000)
        check("admin: edit form + drawing tools shown", await vis(pg, "#znForm") and await vis(pg, "#znTools"))
        check("admin: seeded zone drawn with its 36 vertex handles", await pg.evaluate("__stub.markers().length") == 36, await pg.evaluate("__stub.markers().length"))
        await pg.fill("#fMax", "6"); await pg.click("#znSave"); await pg.wait_for_function("!document.querySelector('#znToast').hidden", timeout=4000)
        check("saving a road limit works", "Saved" in await text(pg, "#znToast"))
        z = api("GET", "/api/admin/service-zones", None, "tok-system")[1]
        check("server stored limit 6 km, revision 1, no longer flagged as seeded", z["zones"][0]["maxRoadKm"] == 6 and z["revision"] == 1 and z["zones"][0]["seeded"] is False, z["zones"][0].get("maxRoadKm"))
        check("placeholder banner gone after the supervisor saves", not await vis(pg, "#znSeedNote"))
        aud = json.load(urllib.request.urlopen(BASE + "/__audit"))
        check("update audited with before/after", aud and aud[-1]["action"] == "service_zone.update" and aud[-1]["before"]["maxRoadKm"] is None and aud[-1]["after"]["maxRoadKm"] == 6, aud[-1:] )

        # invalid value is refused by the server and the message is shown (not a silent failure)
        await pg.fill("#fMax", "500"); await pg.click("#znSave"); await pg.wait_for_selector("#znErr:not([hidden])", timeout=4000)
        check("out-of-range limit -> server message shown", "between 1 and 60" in await text(pg, "#znErr"), await text(pg, "#znErr"))
        await pg.fill("#fMax", "")

        # create a new zone by clicking points on the map
        await pg.click("#znNew"); await pg.wait_for_selector("#znForm:not([hidden])")
        check("new zone: drawing mode is on", "Stop drawing" in await text(pg, "#znDraw"))
        await pg.click("#znSave")
        check("new zone: saving with nothing drawn is refused client-side", "at least 3" in await text(pg, "#znErr"), await text(pg, "#znErr"))
        for lat, lng in [(33.50, -7.70), (33.50, -7.50)]: await pg.evaluate("([a,b])=>__stub.click(a,b)", [lat, lng])
        await pg.fill("#fNameEn", "Casablanca"); await pg.fill("#fCity", "Casablanca")
        await pg.click("#znSave"); check("2 points are not enough", "at least 3" in await text(pg, "#znErr"))
        # bow-tie shape: server rejects self-intersection
        for lat, lng in [(33.60, -7.70), (33.60, -7.50)]: await pg.evaluate("([a,b])=>__stub.click(a,b)", [lat, lng])
        await pg.click("#znSave"); await pg.wait_for_function("document.querySelector('#znErr').textContent.includes('cross')", timeout=4000)
        check("self-intersecting shape rejected by the server with a readable reason", True)
        await pg.click("#znUndo"); await pg.click("#znUndo")
        await pg.evaluate("([a,b])=>__stub.click(a,b)", [33.65, -7.50]); await pg.evaluate("([a,b])=>__stub.click(a,b)", [33.65, -7.70])
        check("points counter follows the drawing", "Points: 4" in await text(pg, "#znPolyInfo"), await text(pg, "#znPolyInfo"))
        # drag a vertex then remove one
        await pg.evaluate("__stub.dragMarker(0, 33.49, -7.71)")
        await pg.click("#znSave"); await pg.wait_for_function("document.querySelector('#znToast').textContent.includes('Saved')", timeout=4000)
        z = api("GET", "/api/admin/service-zones", None, "tok-system")[1]
        check("second zone saved with the dragged vertex", len(z["zones"]) == 2 and z["zones"][1]["polygon"][0] == [33.49, -7.71] and z["zones"][1]["city"] == "Casablanca", z["zones"][-1].get("polygon"))
        check("list shows both zones", await pg.locator("#znList li").count() == 2)

        # public check now covers the new city
        st, r = api("POST", "/api/service-area/check", {"lat": 33.58, "lng": -7.60})
        check("public check: Casablanca point now inside", st == 200 and r["inside"] is True and r["zone"]["city"] == "Casablanca", r)

        # stale revision: someone else edits, then we save
        await pg.click("#znList li:nth-child(2) button"); await pg.wait_for_selector("#znForm:not([hidden])")
        api("PUT", "/api/admin/service-zones/" + z["zones"][1]["id"], {"note": "other supervisor"}, "tok-system")
        await pg.fill("#fNote", "mine"); await pg.click("#znSave"); await pg.wait_for_function("document.querySelector('#znToast').textContent.includes('another supervisor')", timeout=4000)
        check("stale edit: told to review, not silently overwritten", api("GET", "/api/admin/service-zones", None, "tok-system")[1]["zones"][1]["note"] == "other supervisor")
        await pg.click("#znSave"); await pg.wait_for_function("document.querySelector('#znToast').textContent.includes('Saved')", timeout=4000)
        check("after reviewing, the second save succeeds", api("GET", "/api/admin/service-zones", None, "tok-system")[1]["zones"][1]["note"] == "mine")

        # delete the Casablanca zone (confirmation dialog), then try to remove the LAST active zone
        n0 = len(dialogs)
        await pg.click("#znDelete"); await pg.wait_for_function("document.querySelectorAll('#znList li').length===1", timeout=4000)
        check("delete asks for confirmation first", len(dialogs) == n0 + 1 and "permanently" in dialogs[-1], dialogs[-1:])
        await pg.click("#znList li button"); await pg.wait_for_selector("#znForm:not([hidden])")
        await pg.uncheck("#fActive"); n1 = len(dialogs)
        await pg.click("#znSave"); await pg.wait_for_function("document.querySelector('#znToast').textContent.includes('Saved')", timeout=4000)
        check("deactivating the LAST active zone needs an explicit extra confirmation", len(dialogs) == n1 + 1 and "NO active zone" in dialogs[-1], dialogs[-1:])
        st, r = api("POST", "/api/service-area/check", {"lat": 33.2655, "lng": -7.5875})
        check("with every zone off, addresses are refused (fail-closed)", r.get("inside") is False and r.get("reason") == "NO_ACTIVE_ZONES", r)

        # ---- Arabic RTL, French LTR ----
        for lg, d, word in (("ar", "rtl", "مناطق الخدمة"), ("fr", "ltr", "Zones de service")):
            c2, p2, _ = await new_page(b, "tok-system", lg, errs); await p2.goto(BASE + "/admin/zones/"); await p2.wait_for_selector("#znList li", timeout=5000)
            check(lg + ": direction " + d + " + translated title", await p2.evaluate("document.documentElement.dir") == d and word in await text(p2, "#znTitle"))
            await c2.close()
        await ctx.close()

        # ---- phone width ----
        ctx, pg, _ = await new_page(b, "tok-system", "ar", errs, 390, 800); await pg.goto(BASE + "/admin/zones/"); await pg.wait_for_selector("#znList li", timeout=5000)
        await pg.click("#znList li button"); await pg.wait_for_selector("#znForm:not([hidden])")
        check("390px: no horizontal scroll", await pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"), await pg.evaluate("document.documentElement.scrollWidth"))
        check("390px: buttons are at least 40px tall", await pg.evaluate("[...document.querySelectorAll('#znSave,#znNew,#znDraw')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=40)"))
        await ctx.close()

        await b.close()
    check("no uncaught page errors", not errs, errs)
    print("\nFAILED: %d" % len(fails) if fails else "\nALL PASSED")
    raise SystemExit(1 if fails else 0)
asyncio.run(main())
