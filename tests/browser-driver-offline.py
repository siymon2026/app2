"""Section 20 — driver app offline behaviour, in a real browser against tests/offline-driver-server.js.
The 'network' is cut by aborting every /api/** request from the page (the static files keep loading).
Run: python3 tests/browser-driver-offline.py   (starts its own server on 4021)"""
import subprocess, time, json, urllib.request, sys
from playwright.sync_api import sync_playwright

PORT = "4021"; B = "http://localhost:" + PORT
srv = subprocess.Popen(["node", "tests/offline-driver-server.js"], env={"PORT": PORT, "PATH": "/usr/bin:/usr/local/bin"}); time.sleep(1.2)
ok = True
def check(n, c, x=""):
    global ok; print(("PASS " if c else "FAIL ") + n + ("" if c else " -> " + str(x))); ok = ok and bool(c)
def st(): return json.load(urllib.request.urlopen(B + "/__t/state"))
def post(path, body=None):
    r = urllib.request.Request(B + path, data=json.dumps(body or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(r))
errs = []
net = {"up": True}
lose = {"on": None}
def handler(route):
    r = route.request
    if not net["up"]: return route.abort("internetdisconnected")
    hit = (lose["on"] == "patch" and r.method == "PATCH") or (lose["on"] == "chat" and r.method == "POST" and r.url.endswith("/chat"))
    if hit:  # the server applies it, but the answer never reaches the phone, and the network stays down
        lose["on"] = None; route.fetch(); net["up"] = False; return route.abort("connectionreset")
    route.continue_()

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 800}, locale="ar", service_workers="block")
        ctx.add_init_script("localStorage.setItem('SIYMON_DRIVER_TOKEN','dtok'); localStorage.setItem('SIYMON_DRIVER_SOUND_PROMPTED','1')")
        ctx.route("**/api/**", handler)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        post("/__t/reset")
        def go_orders(): pg.click(".nav-item[data-page=orders]"); pg.wait_for_timeout(300)
        pg.goto(B + "/driver/"); pg.wait_for_timeout(1800); go_orders()

        card = lambda: pg.locator(".o-card[data-oid='O1']")
        check("online: the active order card is shown", card().count() == 1)
        check("online: a successful sync time is recorded", pg.evaluate("SiymonOffline.queue.lastSyncAt()") > 0)
        check("online: banner hidden", pg.evaluate("document.getElementById('netBanner').classList.contains('hidden')"))
        snap = pg.evaluate("JSON.parse(localStorage.getItem('siymon_driver_active_snapshot_v1')||'null')")
        check("active delivery snapshot saved (no verification codes in it)", snap and snap["mine"][0]["id"] == "O1" and "pickupCode" not in json.dumps(snap) and "deliveryCode" not in json.dumps(snap), snap)

        # ---------- network drops ----------
        net["up"] = False
        pg.click("[data-action=advance][data-id=O1]"); pg.wait_for_timeout(900)
        banner = pg.evaluate("(()=>{const b=document.getElementById('netBanner');return {hidden:b.classList.contains('hidden'),text:document.getElementById('netBannerText').textContent}})()")
        check("real offline detected: banner visible", not banner["hidden"], banner)
        check("banner shows the last successful sync time", "آخر مزامنة" in banner["text"] and "لم تتم" not in banner["text"], banner)
        check("'start delivery' kept as PENDING (badge, no button)", card().locator(".pending-badge").count() == 1 and card().locator("[data-action=advance]").count() == 0)
        check("UI does NOT claim the new status", "picked_up" in (pg.evaluate("document.querySelector('.o-card[data-oid=O1] .status-chip').className")))
        check("server state untouched while offline", st()["order"]["status"] == "picked_up" and st()["transitions"] == 0)
        check("panel lists the pending update", pg.locator("#syncPanel .sq-row.pending").count() == 1)

        # ---------- reload while offline: active delivery is still shown (labelled) ----------
        pg.reload(); pg.wait_for_timeout(1800); go_orders()
        check("reload offline: the saved active delivery is still displayed", card().count() == 1)
        check("reload offline: pending update survived the reload", pg.evaluate("SiymonOffline.queue.counts().pending") == 1)

        # ---------- verified steps are never done offline ----------
        pg.evaluate("SiymonOffline.queue.clear()")  # isolate: test delivered separately
        post("/__t/set", {"status": "on_the_way"})  # (server moved on while we were away)
        net["up"] = True; pg.evaluate("SiymonOffline.probe()"); pg.wait_for_timeout(800); pg.click("#refreshOrders") if pg.locator("#refreshOrders").count() else None
        pg.evaluate("loadOrders(true)"); pg.wait_for_timeout(900)
        net["up"] = False
        pg.click("[data-action=advance][data-id=O1]"); pg.wait_for_timeout(300)
        pg.click("#confirmOkBtn"); pg.wait_for_timeout(900)
        check("delivery attempt offline is NOT queued", pg.evaluate("SiymonOffline.queue.list().length") == 0)
        check("delivery attempt offline did not change the order", st()["order"]["status"] == "on_the_way" and st()["transitions"] == 0)
        net["up"] = True

        # ---------- server rejects a queued verified step even if a client tries ----------
        r = pg.evaluate("""fetch('/api/driver/orders/O1',{method:'PATCH',headers:{'Content-Type':'application/json','X-Driver-Token':'dtok'},
            body:JSON.stringify({status:'delivered',queued:true,queuedAt:Date.now()})}).then(async r=>({s:r.status,j:await r.json()}))""")
        check("server refuses 'delivered' sent as a queued update (400 NOT_QUEUEABLE)", r["s"] == 400 and r["j"]["code"] == "NOT_QUEUEABLE", r)
        check("...and the order is unchanged", st()["order"]["status"] == "on_the_way")

        # ---------- lost response + replay = exactly one transition ----------
        post("/__t/reset"); post("/__t/set", {"status": "picked_up"})
        pg.evaluate("SiymonOffline.queue.clear()"); pg.evaluate("loadOrders(true)"); pg.wait_for_timeout(900)
        lose["on"] = "patch"
        pg.click("[data-action=advance][data-id=O1]"); pg.wait_for_timeout(1000)
        check("lost response: server applied once", st()["transitions"] == 1 and st()["order"]["status"] == "on_the_way", st())
        check("lost response: client shows it as pending (unconfirmed)", pg.evaluate("SiymonOffline.queue.counts().pending") == 1)
        net["up"] = True; pg.evaluate("SiymonOffline.probe()"); pg.wait_for_timeout(1800)
        s = st()
        check("replay after reconnect: still exactly ONE transition (no duplicate)", s["transitions"] == 1 and s["patchCalls"] == 2, s)
        check("queue is empty after confirmed sync", pg.evaluate("SiymonOffline.queue.list().length") == 0)

        # ---------- chat: pending bubble, no duplicate after lost response ----------
        pg.click(".o-card[data-oid=O1] [data-action=chat]"); pg.wait_for_timeout(900)
        lose["on"] = "chat"
        pg.fill("#orderChatInput", "وصلت إلى الباب"); pg.click("#orderChatSendBtn"); pg.wait_for_timeout(1200)
        check("chat: stored by server once (response was lost)", len(st()["messages"]) == 1, st()["messages"])
        check("chat: shown locally as pending/unconfirmed", pg.locator("#orderChatBox .chat-msg.pending-local").count() == 1)
        net["up"] = True; pg.evaluate("SiymonOffline.probe()"); pg.wait_for_timeout(1800)
        check("chat: replay with the SAME key created no second message", len(st()["messages"]) == 1 and st()["chatPosts"] == 2, st())
        check("chat: pending bubble gone, real message displayed", pg.locator("#orderChatBox .chat-msg.pending-local").count() == 0 and "وصلت" in pg.inner_text("#orderChatBox"))

        # ---------- sync error is exposed, with retry/discard ----------
        pg.click("#closeOrderChatBtn"); pg.wait_for_timeout(300)
        post("/__t/reset"); post("/__t/set", {"status": "picked_up"})
        pg.evaluate("SiymonOffline.queue.clear()"); pg.evaluate("loadOrders(true)"); pg.wait_for_timeout(900)
        net["up"] = False
        pg.click("[data-action=advance][data-id=O1]"); pg.wait_for_timeout(700)
        post("/__t/set", {"status": "canceled"})  # order was cancelled meanwhile
        net["up"] = True; pg.evaluate("SiymonOffline.probe()"); pg.wait_for_timeout(2200)
        check("conflicting queued update is NOT applied", st()["order"]["status"] == "canceled" and st()["transitions"] == 0)
        check("sync error is visible with retry and discard", pg.locator("#syncPanel .sq-row.failed").count() == 1 and pg.locator("#syncPanel [data-sq=retry]").count() == 1 and pg.locator("#syncPanel [data-sq=discard]").count() == 1)
        pg.click("#syncPanel [data-sq=discard]"); pg.wait_for_timeout(300)
        check("discard removes it", pg.locator("#syncPanel .sq-row").count() == 0 and pg.evaluate("SiymonOffline.queue.list().length") == 0)

        # ---------- logout wipes the saved delivery ----------
        pg.evaluate("logout()"); pg.wait_for_timeout(300)
        check("logout clears the saved active-delivery snapshot", pg.evaluate("localStorage.getItem('siymon_driver_active_snapshot_v1')") is None)

        check("no JS errors", not errs, errs)
        ctx.close(); b.close()
finally:
    srv.terminate()
print("ALL PASS" if ok else "FAILURES"); sys.exit(0 if ok else 1)
