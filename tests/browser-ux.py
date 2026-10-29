"""Browser UX tests: offline screen, notification-permission sheet, notification center.
Run: python3 tests/browser-ux.py   (needs Playwright + Chromium; starts tests/ux-mock-server.js itself)"""
import json, os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright
B="http://localhost:4567"; res=[]
def ck(n,c,x=""):
    res.append(bool(c)); print(("PASS " if c else "FAIL ")+n+((" :: "+str(x)) if (not c and x!="") else ""))
_srv=None
def restart():
    global _srv
    if _srv: _srv.terminate(); _srv.wait()
    _srv=subprocess.Popen(["node",os.path.join(os.path.dirname(os.path.abspath(__file__)),"ux-mock-server.js")],stdout=subprocess.DEVNULL)
    for _ in range(50):
        try: urllib.request.urlopen(B+"/api/health"); return
        except Exception: time.sleep(0.1)
def get(p): return json.load(urllib.request.urlopen(B+p))
SEED="if(!localStorage.getItem('__s')){localStorage.setItem('siymon_addr_prompted_v1','true');localStorage.setItem('siymon_customer_token_v1','tok1');localStorage.setItem('siymon_customer_profile_v1',JSON.stringify({id:'c1',firstName:'محمد',lastName:'العربي',email:'m@x.com'}));localStorage.setItem('__s','1')}"
def ctx(b, sw="block", extra=None, perms=None):
    c=b.new_context(viewport={"width":393,"height":851},device_scale_factor=2,is_mobile=True,has_touch=True,locale="ar",service_workers=sw)
    c.add_init_script(SEED)
    if extra: c.add_init_script(extra)
    return c
def noscroll(pg,name):
    d=pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    ck(name+": no horizontal scroll", d[0]<=d[1], d)

with sync_playwright() as p:
    b=p.chromium.launch()

    # ============ A. notification center ============
    restart()
    c=ctx(b); pg=c.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item")
    items=pg.locator(".nc-item"); ck("A1 six real notifications rendered", items.count()==6, items.count())
    titles=pg.locator(".nc-item .nc-title").all_inner_texts()
    ck("A2 newest first (real createdAt)", pg.locator(".nc-item").first.get_attribute("data-id")=="o1" and pg.locator(".nc-item").last.get_attribute("data-id")=="b1")
    ck("A3 header: title + unread counter=4", pg.locator("#ncCount").is_visible() and pg.locator("#ncCount").inner_text()=="4", pg.locator("#ncCount").inner_text())
    ck("A4 unread highlighted (4 rows)", pg.locator(".nc-item.unread").count()==4)
    ck("A5 summary hides repeated '(طلب #ID)'", "(طلب" not in pg.locator(".nc-item").first.inner_text() and "طلبك في طريقه إليك" in pg.locator(".nc-item").first.inner_text())
    ck("A6 compact cards (<=125px, was ~130 and 3-4 lines)", max(x["height"] for x in [i.bounding_box() for i in items.all()])<=125, [i.bounding_box()["height"] for i in items.all()])
    ck("A7 chips: all/orders/offers", pg.locator(".nc-chip").all_inner_texts()==["الكل","الطلبات","العروض"], pg.locator(".nc-chip").all_inner_texts())
    pg.click(".nc-chip[data-k='offers']"); ck("A8 offers filter shows only broadcasts", pg.locator(".nc-item").count()==2)
    pg.click(".nc-chip[data-k='orders']"); ck("A9 orders filter shows only order updates", pg.locator(".nc-item").count()==4)
    pg.click(".nc-chip[data-k='all']")
    noscroll(pg,"A10 notifications"); pg.screenshot(path="u_list.png")
    log0=len(get("/__log"))
    # open an unread order notification
    pg.locator(".nc-item[data-id='o1']").click(); pg.wait_for_selector("#ndRoot.on"); pg.wait_for_timeout(500)
    ck("A11 details: full title", "تحديث الطلب" in pg.locator("#ndTitle").inner_text())
    ck("A12 details: full message incl. order id", "MU0JYS4V-48EE87" in pg.locator("#ndMsg").inner_text())
    ck("A13 details: order number row", "MU0JYS4V-48EE87" in pg.locator("#ndRows").inner_text())
    ck("A14 details: real order status (from orders API)", "في الطريق" in pg.locator("#ndRows").inner_text(), pg.locator("#ndRows").inner_text())
    ck("A15 opening marked it read, counter 4->3 instantly", pg.locator("#ncCount").inner_text()=="3" and pg.locator(".nc-item[data-id='o1']").get_attribute("class").find("unread")<0)
    ck("A16 opening did NOT mark everything on the server", not any("notifications/seen" in x for x in get("/__log")[log0:]))
    pg.screenshot(path="u_detail.png")
    # back closes the sheet and keeps us on the list
    pg.go_back(); pg.wait_for_timeout(450)
    ck("A17 Back closes details, stays on the list", pg.url.endswith("/notifications/") and not pg.locator("#ndRoot").is_visible())
    # persistence across reload
    pg.reload(); pg.wait_for_selector(".nc-item")
    ck("A18 read state survives reload (counter 3)", pg.locator("#ncCount").inner_text()=="3", pg.locator("#ncCount").inner_text())
    # scroll position kept when opening/closing
    pg.evaluate("window.scrollTo(0,200)"); y0=pg.evaluate("window.scrollY")
    pg.locator(".nc-item").nth(4).click(); pg.wait_for_selector("#ndRoot.on"); pg.go_back(); pg.wait_for_timeout(450)
    ck("A19 list scroll position kept", abs(pg.evaluate("window.scrollY")-y0)<=2, (y0,pg.evaluate("window.scrollY")))
    # order button goes to the right order
    pg.locator(".nc-item[data-id='o4']").click(); pg.wait_for_selector("#ndRoot.on"); pg.wait_for_timeout(400)
    ck("A20 button 'عرض الطلب' present", pg.locator(".nd-go").inner_text()=="عرض الطلب")
    ck("A20b href uses the REAL id", pg.locator(".nd-go").get_attribute("href")=="/orders/?order=MO45FWC6-B78BA7")
    pg.locator(".nd-go").click(); pg.wait_for_url("**/orders/?order=*"); pg.wait_for_selector(".order-card.order-focus")
    ck("A21 lands on that order, highlighted", pg.locator(".order-card.order-focus").get_attribute("data-oid")=="MO45FWC6-B78BA7")
    pg.screenshot(path="u_order.png"); noscroll(pg,"A22 orders")
    # broadcast with valid link / without
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item")
    pg.locator(".nc-item[data-id='b1']").click(); pg.wait_for_selector("#ndRoot.on"); pg.wait_for_timeout(350)
    ck("A23 offer: full multi-line message shown", "ولا يُجمع مع عروض أخرى" in pg.locator("#ndMsg").inner_text())
    ck("A24 offer with real link -> button to it", pg.locator(".nd-go").get_attribute("href")=="/orders/")
    pg.go_back(); pg.wait_for_timeout(400)
    pg.locator(".nc-item[data-id='b2']").click(); pg.wait_for_selector("#ndRoot.on"); pg.wait_for_timeout(350)
    ck("A25 notice without link -> no fake button", pg.locator(".nd-go").count()==0)
    # X button + top back both close the sheet
    pg.click("#ndClose"); pg.wait_for_timeout(450); ck("A26 X closes sheet", not pg.locator("#ndRoot").is_visible())
    pg.locator(".nc-item").first.click(); pg.wait_for_selector("#ndRoot.on"); pg.evaluate("document.getElementById('goHome').click()"); pg.wait_for_timeout(450)
    ck("A27 top Back closes sheet first (no page leave)", pg.url.endswith("/notifications/") and not pg.locator("#ndRoot").is_visible())
    # mark all
    pg.click("#markAll"); pg.wait_for_function("document.querySelector('#ncCount').hidden")
    ck("A28 mark all: counter hidden, no unread rows, server marker updated", pg.locator(".nc-item.unread").count()==0 and any("notifications/seen" in x for x in get("/__log")))
    ck("A29 bottom nav still there", pg.locator(".sub-nav").is_visible())
    ck("A30 no JS errors", not errs, errs)
    c.close()

    # empty state
    restart()
    c=ctx(b); pg=c.new_page()
    pg.route("**/api/customer/notifications", lambda r: r.fulfill(status=200,content_type="application/json",body='{"ok":true,"notifications":[],"unreadCount":0,"lastSeenAt":null}'))
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-empty")
    ck("A31 empty state text", "لا توجد إشعارات جديدة" in pg.locator(".nc-empty").inner_text() and not pg.locator("#markAll").is_visible()); pg.screenshot(path="u_empty.png")
    c.close()
    # only one kind -> no pointless chips
    c=ctx(b); pg=c.new_page()
    pg.route("**/api/customer/notifications", lambda r: r.fulfill(status=200,content_type="application/json",body=json.dumps({"ok":True,"notifications":[{"id":"x","type":"order_status","orderId":"A1-B2","title":"تحديث الطلب","message":"تم قبول طلبك ✅ (طلب #A1-B2)","createdAt":"2026-09-14T02:17:00Z"}],"unreadCount":0,"lastSeenAt":"2026-09-15T00:00:00Z"})))
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item")
    ck("A32 single kind -> no empty/needless categories", not pg.locator("#ncChips").is_visible())
    c.close()

    # ============ B. offline screen ============
    restart()
    c=ctx(b); pg=c.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.add_init_script("window.__ev=[];window.addEventListener('siymon:online',()=>window.__ev.push(Date.now()));")
    pg.goto(B+"/"); pg.wait_for_selector("#nav_bell"); pg.wait_for_timeout(800)
    ck("B1 online: no offline screen", pg.locator(".so-root.on").count()==0)
    pg.evaluate("localStorage.setItem('siymon_cart_v5', JSON.stringify({items:[['p1',2]]}))")
    pg.evaluate("window.scrollTo(0,150)"); y_before=pg.evaluate("window.scrollY")
    # blip shorter than the confirmation time must not flash
    pg.evaluate("window.__seen=false;new MutationObserver(()=>{if(document.querySelector('.so-root.on'))window.__seen=true}).observe(document.documentElement,{subtree:true,attributes:true,childList:true})")
    c.set_offline(True); pg.wait_for_timeout(500); c.set_offline(False); pg.wait_for_timeout(3500)
    ck("B2 brief blip: screen never flashed", pg.evaluate("window.__seen")==False)
    # real outage
    c.set_offline(True)
    pg.wait_for_selector(".so-root.on", timeout=9000)
    ck("B3 offline: screen shown with Arabic title", pg.locator(".so-title").inner_text()=="لا يوجد اتصال بالإنترنت")
    ck("B4 helper text", pg.locator(".so-hint").inner_text()=="يرجى التحقق من اتصالك بالإنترنت")
    ck("B5 retry button", pg.locator(".so-btn").inner_text().strip()=="إعادة المحاولة")
    pg.screenshot(path="u_offline.png"); noscroll(pg,"B6 offline screen")
    pg.click(".so-btn"); pg.wait_for_timeout(1500)
    ck("B7 retry while still offline: stays, explains", pg.locator(".so-root.on").count()==1 and "لا يزال" in pg.locator(".so-msg").inner_text(), pg.locator(".so-msg").inner_text())
    c.set_offline(False)
    pg.click(".so-btn"); pg.wait_for_function("!document.querySelector('.so-root.on')", timeout=9000)
    ck("B8 retry after reconnect: screen gone", True)
    ck("B9 same page, same scroll, cart untouched", pg.url==B+"/" and abs(pg.evaluate("window.scrollY")-y_before)<5 and '"p1"' in pg.evaluate("localStorage.getItem('siymon_cart_v5')"), pg.evaluate("window.scrollY"))
    ck("B10 pages told to reload (siymon:online)", pg.evaluate("window.__ev.length")>=1)
    # automatic hide without pressing the button
    c.set_offline(True); pg.wait_for_selector(".so-root.on", timeout=9000)
    n0=len([x for x in get("/__log") if "/api/menu" in x])
    c.set_offline(False); pg.wait_for_function("!document.querySelector('.so-root.on')", timeout=12000)
    pg.wait_for_timeout(800)
    ck("B11 auto-hides when internet returns", True)
    ck("B12 home data reloaded after reconnect", len([x for x in get("/__log") if "/api/menu" in x])>n0)
    # one request failing (HTTP 500) is NOT an outage
    pg.route("**/api/customer/orders", lambda r: r.fulfill(status=500,body="{}"))
    pg.goto(B+"/orders/"); pg.wait_for_timeout(2500)
    ck("B13 HTTP error of one section: no offline screen", pg.locator(".so-root.on").count()==0)
    pg.unroute("**/api/customer/orders")
    # one request aborted while the server is reachable is NOT an outage either
    pg.route("**/api/customer/orders", lambda r: r.abort())
    pg.goto(B+"/orders/"); pg.wait_for_timeout(5000)
    ck("B14 one failed request, server reachable: no offline screen", pg.locator(".so-root.on").count()==0)
    ck("B15 no JS errors", not [e for e in errs if "Failed to fetch" not in e], errs)
    c.close()

    # offline on a sub page too (shared component)
    c=ctx(b); pg=c.new_page(); pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item"); c.set_offline(True)
    pg.wait_for_selector(".so-root.on", timeout=9000); ck("B16 same screen on /notifications/", True)
    c.set_offline(False); pg.wait_for_function("!document.querySelector('.so-root.on')", timeout=12000)
    ck("B17 back on the same page", pg.url.endswith("/notifications/") and pg.locator(".nc-item").count()==6)
    c.close()

    # ============ C. notification permission sheet ============
    STUB="""
    (function(){
      var perm = localStorage.getItem('__perm') || 'default';
      window.__reqCount = 0;
      Object.defineProperty(Notification,'permission',{configurable:true,get:function(){return localStorage.getItem('__perm')||'default'}});
      Notification.requestPermission = function(){ window.__reqCount++; var r = localStorage.getItem('__next')||'granted'; localStorage.setItem('__perm', r); return Promise.resolve(r); };
      var subs = null;
      if (window.PushManager) {
        PushManager.prototype.getSubscription = function(){ return Promise.resolve(localStorage.getItem('__sub') ? {endpoint:'https://push.example/1', toJSON:function(){return {endpoint:'https://push.example/1',keys:{p256dh:'a',auth:'b'}}}, unsubscribe:function(){localStorage.removeItem('__sub');return Promise.resolve(true)}} : null); };
        PushManager.prototype.subscribe = function(){ localStorage.setItem('__sub','1'); return this.getSubscription(); };
      }
    })();
    """
    def home_ctx(setup=""):
        cc=b.new_context(viewport={"width":393,"height":851},device_scale_factor=2,is_mobile=True,has_touch=True,locale="ar",service_workers="allow")
        cc.add_init_script(SEED); cc.add_init_script(STUB)
        if setup: cc.add_init_script(setup)
        return cc
    restart()
    c=home_ctx(); pg=c.new_page(); pg.goto(B+"/")
    pg.wait_for_selector(".np-root.on", timeout=20000)
    ck("C1 undecided user: intro sheet shown", True)
    ck("C2 title", pg.locator(".np-title").inner_text()=="ابقَ على اطلاع بكل جديد")
    ck("C3 description", pg.locator(".np-desc").inner_text()=="تابع تحديثات طلباتك، وحالة التوصيل، والعروض المهمة مباشرة")
    ck("C4 buttons", pg.locator(".np-primary").inner_text().strip()=="تفعيل الإشعارات" and pg.locator(".np-later").inner_text()=="لاحقًا")
    ck("C5 browser permission NOT requested before the tap", pg.evaluate("window.__reqCount")==0 and pg.evaluate("Notification.permission")=="default")
    ck("C6 not full screen (sheet only)", pg.locator(".np-sheet").bounding_box()["height"]<851*0.7, pg.locator(".np-sheet").bounding_box())
    pg.screenshot(path="u_prompt.png"); noscroll(pg,"C7 prompt")
    pg.click(".np-later"); pg.wait_for_timeout(500)
    ck("C8 'later' closes without asking the browser", pg.locator(".np-root").count()==0 and pg.evaluate("window.__reqCount")==0)
    pg.reload(); pg.wait_for_timeout(11000)
    ck("C9 not shown again on the next visit", pg.locator(".np-root").count()==0)
    ck("C10 snooze stored (count=1)", json.loads(pg.evaluate("localStorage.getItem('siymon_push_prompt_v1')"))["dismissCount"]==1)
    c.close()

    restart()
    c=home_ctx(); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_selector(".np-root.on", timeout=20000)
    pg.click(".np-primary"); pg.wait_for_function("document.querySelector('.np-lbl') && document.querySelector('.np-lbl').textContent.includes('تم تفعيل')", timeout=10000)
    ck("C11 tap enable: permission asked once, subscription saved on the server", pg.evaluate("window.__reqCount")==1 and get("/__state")["pushPosts"]==1)
    ck("C12 success only after server accepted", True)
    pg.wait_for_timeout(2200); ck("C13 sheet closes itself", pg.locator(".np-root").count()==0)
    pg.reload(); pg.wait_for_timeout(11000); ck("C14 already enabled: never asked again", pg.locator(".np-root").count()==0)
    c.close()

    restart()
    c=home_ctx("localStorage.setItem('__perm','denied')"); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_timeout(11000)
    ck("C15 refused earlier: respected, no sheet", pg.locator(".np-root").count()==0 and pg.evaluate("window.__reqCount")==0)
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item"); pg.wait_for_selector("#pushRow:not([hidden])")
    ck("C16 notifications page explains denial (no dead button)", "إعدادات المتصفح" in pg.locator("#pushRow").inner_text() and pg.locator("#pushRow button").count()==0, pg.locator("#pushRow").inner_text())
    c.close()

    restart()
    c=home_ctx("localStorage.setItem('__perm','default');localStorage.setItem('__next','denied')"); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_selector(".np-root.on", timeout=20000)
    pg.click(".np-primary"); pg.wait_for_selector(".np-msg.err", timeout=8000)
    ck("C17 refusing in the browser dialog: message, no retry loop", "لم يتم السماح" in pg.locator(".np-msg").inner_text() and pg.locator(".np-primary").inner_text().strip()=="حسنًا" and get("/__state")["pushPosts"]==0)
    pg.click(".np-primary"); pg.wait_for_timeout(500); ck("C18 closes", pg.locator(".np-root").count()==0)
    c.close()

    restart()
    c=home_ctx("delete window.PushManager;"); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_timeout(11000)
    ck("C19 unsupported platform: no sheet", pg.locator(".np-root").count()==0)
    pg.goto(B+"/notifications/"); pg.wait_for_selector("#pushRow:not([hidden])")
    ck("C20 unsupported: clear message instead of a dead button", "غير مدعومة" in pg.locator("#pushRow").inner_text() and pg.locator("#pushRow button").count()==0)
    c.close()

    restart(); urllib.request.urlopen(B+"/__cfg?push=0").read()
    c=home_ctx(); pg=c.new_page(); pg.goto(B+"/"); pg.wait_for_timeout(11000)
    ck("C21 server push not configured: no sheet, nothing pretended", pg.locator(".np-root").count()==0)
    pg.goto(B+"/notifications/"); pg.wait_for_selector(".nc-item"); pg.wait_for_timeout(800)
    ck("C22 ...and no push row at all", not pg.locator("#pushRow").is_visible())
    c.close()

    # logged-out visitor: nothing
    restart()
    cc=b.new_context(viewport={"width":393,"height":851},is_mobile=True,locale="ar",service_workers="allow"); cc.add_init_script(STUB); pg=cc.new_page(); pg.goto(B+"/"); pg.wait_for_timeout(11000)
    ck("C23 signed-out visitor: no sheet", pg.locator(".np-root").count()==0)
    cc.close()
    b.close()
print("\n%d/%d passed"%(sum(res),len(res)))
if _srv: _srv.terminate()
