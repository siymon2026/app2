import subprocess, time, json, urllib.request, sys, os
from playwright.sync_api import sync_playwright
PORT="4014"; B="http://localhost:"+PORT; TOK="test-admin-token"
OUT=os.environ.get("SHOTS","/tmp")
srv=subprocess.Popen(["node","tests/ui-mock-server.js"],env={"PORT":PORT,"PATH":os.environ["PATH"],"SEED_DIR":os.environ.get("SEED_DIR","")}); time.sleep(1.2)
def call(method,path,body=None,admin=False):
    h={"Content-Type":"application/json"}
    if admin: h["X-Admin-Token"]=TOK
    r=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return {"_status":e.code, **json.load(e)}
ok=True; errs=[]
def check(n,c):
    global ok; print(("PASS " if c else "FAIL ")+n); ok=ok and bool(c)
try:
    rs=call("GET","/api/admin/restaurants",admin=True)["restaurants"]; ids=[r["id"] for r in rs]
    call("PUT","/api/admin/restaurants/"+ids[0],{"minOrder":30,"deliveryFee":10,"freeDeliveryOver":500},admin=True)
    items=call("GET","/api/admin/menu",admin=True)["items"]
    mine=[i for i in items if i["restaurantId"]==ids[0] and i.get("isAvailable")!=False]
    store=ids[0]; a,b=mine[0],mine[1]

    # ---- server-side payment enforcement ----
    base={"restaurantId":store,"customer":{"name":"a","phone":"1","addr":"x"},"items":[{"id":a["id"],"qty":5}]}
    for m in ("visa","mastercard","card","paypal","stripe"):
        r=call("POST","/api/orders",{**base,"paymentMethod":m})
        check("server rejects "+m, r.get("_status")==400 and r.get("code")=="PAYMENT_METHOD_NOT_AVAILABLE")
    check("server accepts cod", call("POST","/api/orders",{**base,"paymentMethod":"cod"}).get("ok") is True)
    check("server accepts legacy (no method)", call("POST","/api/orders",base).get("ok") is True)

    with sync_playwright() as p:
        br=p.chromium.launch()
        for scheme,vw in (("light",{"width":390,"height":844}),("dark",{"width":390,"height":844}),("light",{"width":1280,"height":800})):
            tag=f"{scheme}-{vw['width']}"
            ctx=br.new_context(viewport=vw,color_scheme=scheme,locale="ar")
            ctx.add_init_script("localStorage.setItem('siymon_addr_prompted_v1','true');localStorage.setItem('siymon_lang_v1','ar');localStorage.setItem('siymon_theme_v3','%s');"%scheme)
            pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
            pg.route("**/fonts.g*/**",lambda r:r.abort()); pg.route("**/accounts.google.com/**",lambda r:r.abort())
            pg.route("**/api/public-config",lambda r:r.fulfill(status=200,content_type="application/json",body=json.dumps({"restaurantMode":"open","supportPhone":"+212000000000"})))
            posts=[]
            def on_req(rq):
                if rq.method=="POST" and rq.url.endswith("/api/orders"): posts.append(json.loads(rq.post_data or "{}"))
            pg.on("request",on_req)
            dialogs=[]; pg.on("dialog",lambda d:(dialogs.append(d.message),d.dismiss()))
            pg.goto(B+"/"); pg.wait_for_timeout(1500)
            # put items in cart through the app's own functions
            pg.evaluate("selectedRestaurantId=%s; "%json.dumps(store)+"addToCart(%s,2); addToCart(%s,1);"%(json.dumps(a["id"]),json.dumps(b["id"])))
            pg.evaluate("document.getElementById('goCart').click()"); pg.wait_for_timeout(400)
            check(tag+": 2 cart cards", pg.locator("#cartItems .cart-item").count()==2)
            check(tag+": item image or placeholder", pg.locator("#cartItems .ci-img").count()==2)
            check(tag+": sheet title has count", "(3)" in pg.locator("#cartSheet .sheet-head h2").inner_text())
            pg.screenshot(path=f"{OUT}/cart_{tag}_1.png")
            # qty +/-
            first=pg.locator("#cartItems .cart-item").first
            first.locator("[data-act=plus]").click(); pg.wait_for_timeout(100)
            check(tag+": plus -> qty 3", pg.locator("#cartItems .cart-item").first.locator(".qty span").inner_text()=="3")
            pg.locator("#cartItems .cart-item").first.locator("[data-act=minus]").click(); pg.wait_for_timeout(100)
            # totals correct vs app math
            exp=pg.evaluate("cartGrandTotal()")
            check(tag+": bar total == grand total", abs(float(pg.locator("#barTotalValue").inner_text().split()[0])-exp)<0.01)
            check(tag+": subtotal+fee==total", abs(pg.evaluate("cartSubTotal()+cartDeliveryFee()")-exp)<0.001)
            # payments
            opts=pg.locator("#payList .pay-opt")
            check(tag+": 5 payment options", opts.count()==5)
            check(tag+": COD selected", pg.locator("#payList .pay-opt.is-selected").count()==1 and "cod" in pg.locator("#payList .pay-opt.is-selected").get_attribute("data-method"))
            dis=pg.locator("#payList .pay-opt.is-disabled")
            check(tag+": 4 disabled, each says 'لم تُفعّل بعد'", dis.count()==4 and all("لم تُفعّل بعد" in dis.nth(i).inner_text() for i in range(4)))
            for i in range(4): dis.nth(i).click(force=True)
            check(tag+": clicking disabled doesn't select", pg.locator("#payList .pay-opt.is-selected").count()==1 and all(dis.nth(i).get_attribute("aria-checked")=="false" for i in range(4)))
            check(tag+": no card inputs collected", pg.locator("#cartSheet input[type=password], #cartSheet input[autocomplete*=cc-]").count()==0)
            pg.screenshot(path=f"{OUT}/cart_{tag}_2.png")
            # validation: empty fields -> alert, no request
            pg.locator("#placeOrder").click(); pg.wait_for_timeout(200)
            check(tag+": required-field validation, no request", len(posts)==0 and len(dialogs)>=1)
            # fill + double click => exactly one order
            pg.fill("#custName","اختبار"); pg.fill("#custPhone","0612345678"); pg.fill("#custAddr","الدار البيضاء")
            pg.locator("#placeOrder").dblclick(); pg.wait_for_timeout(900)
            check(tag+": double-click -> exactly 1 order request", len(posts)==1)
            check(tag+": payload paymentMethod=cod", posts and posts[0].get("paymentMethod")=="cod")
            check(tag+": success message shown", "تم استلام طلبك" in pg.locator("#orderHint").inner_text())
            check(tag+": cart emptied + empty state", pg.locator("#cartItems .cart-empty").count()==1)
            pg.screenshot(path=f"{OUT}/cart_{tag}_3_empty.png")
            # empty state button closes sheet
            pg.locator("#cartBackShop").click(); pg.wait_for_timeout(200)
            check(tag+": back-to-shop closes sheet", pg.locator("#cartSheet").is_hidden())
            # remove button
            pg.evaluate("addToCart(%s,1); addToCart(%s,4); document.getElementById('goCart').click()"%(json.dumps(b["id"]),json.dumps(a["id"]))); pg.wait_for_timeout(300)
            pg.locator("#cartItems .cart-item").first.locator("[data-act=remove]").click(); pg.wait_for_timeout(500)
            check(tag+": remove deletes the line", pg.locator("#cartItems .cart-item").count()==1)
            ctx.close()
        br.close()
finally:
    srv.terminate()
print("JS ERRORS:",[e for e in errs if "404" not in e and "ERR_FAILED" not in e][:6]); print("ALL PASS" if ok and not [e for e in errs if "404" not in e and "ERR_FAILED" not in e] else "SOME FAILED")
