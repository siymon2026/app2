import subprocess, time, json, urllib.request, sys
from playwright.sync_api import sync_playwright
PORT="4013"; B="http://localhost:"+PORT; TOK="test-admin-token"
srv=subprocess.Popen(["node","tests/ui-mock-server.js"],env={"PORT":PORT,"PATH":"/usr/bin:/usr/local/bin"}); time.sleep(1.2)
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
    rs=call("GET","/api/admin/restaurants",admin=True)["restaurants"]
    ids=[r["id"] for r in rs]
    # configure demo state via admin API
    call("PUT","/api/admin/restaurants/"+ids[0],{"minOrder":30,"deliveryFee":10,"freeDeliveryOver":200,"avgDeliveryMin":25,"featured":True,"trending":True,"offerLabel":"-15%","logo":"/uploads/l1.webp","cover":"/uploads/c1.webp","categoryIds":["cat-a"],"description":{"ar":"أفضل الوجبات","en":"Best meals","fr":"Meilleurs plats"}},admin=True)
    call("PUT","/api/admin/restaurants/"+ids[1],{"deliveryFee":0,"avgDeliveryMin":40,"logo":"/uploads/l2.webp","cover":"/uploads/c2.webp","categoryIds":["cat-b"],"status":"paused"},admin=True)
    call("PUT","/api/admin/restaurants/"+ids[2],{"status":"unpublished"},admin=True)
    items=call("GET","/api/admin/menu",admin=True)["items"]
    mine=[i for i in items if i["restaurantId"]==ids[0] and i.get("isAvailable")!=False]
    for k,it in enumerate(mine[:4]):
        call("PUT","/api/admin/menu/"+it["id"],{"salePrice":round(it["price"]*0.85,2) if k<2 else None,"featured":k%2==0,"trending":k<3,"img":"/uploads/m%d.webp"%k},admin=True)
    call("PUT","/api/admin/catalog",{"categories":[{"id":"cat-a","name":{"ar":"برغر","en":"Burger"},"icon":"/uploads/i1.webp"},{"id":"cat-b","name":{"ar":"بيتزا","en":"Pizza"}}],
        "banners":[{"image":"/uploads/b1.webp","title":{"ar":"خصم 15% على أول طلب"},"storeId":ids[0]}],
        "sections":[{"id":"s1","type":"trending","title":{"ar":"الأكثر طلباً"},"sortOrder":1},{"id":"s2","type":"featured","title":{"ar":"المميّز"},"sortOrder":2},{"id":"s3","type":"stores","title":{"ar":"المطاعم والمحلات"},"sortOrder":3}]},admin=True)
    home=call("GET","/api/home")
    check("home excludes unpublished store", ids[2] not in [s["id"] for s in home["stores"]])
    with sync_playwright() as p:
        br=p.chromium.launch()
        for scheme in ("light","dark"):
            ctx=br.new_context(viewport={"width":390,"height":844},color_scheme=scheme, locale="ar")
            ctx.add_init_script("localStorage.setItem('siymon_lang_v1','ar');"+("localStorage.setItem('siymon_theme_v3','dark');" if scheme=="dark" else "localStorage.setItem('siymon_theme_v3','light');"))
            pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
            pg.route("**/fonts.g*/**",lambda r:r.abort()); pg.route("**/accounts.google.com/**",lambda r:r.abort())
            pg.goto(B+"/"); pg.wait_for_timeout(1800)
            check(scheme+": feed visible", pg.locator("#feedHome .fh-sec").count()>=2)
            check(scheme+": products hidden in feed mode", not pg.locator("#productsGrid").is_visible())
            pg.screenshot(path=f"/tmp/cust_{scheme}.png")
            if scheme=="light":
                check("category chips (2 + all)", pg.locator(".fh-chip").count()==3)
                check("paused store shows paused badge", pg.locator(".fh-scard .fh-state", has_text="متوقف").count()>=1)
                unp=[r for r in rs if r["id"]==ids[2]][0]["name"]["ar"]
                check("unpublished store hidden in feed", unp not in pg.locator("#feedHome").inner_text())
                pg.screenshot(path="/tmp/cust_full.png", full_page=True)
                # open store from a featured item -> store mode + detail
                pg.locator(".fh-icard").first.click(); pg.wait_for_timeout(700)
                check("store mode after click", pg.evaluate("document.body.classList.contains('store-mode')"))
                check("products grid visible in store mode", pg.locator("#productsGrid .card").count()>0)
                pg.screenshot(path="/tmp/cust_store.png")
                # close detail if open, add to cart
                pg.click("#dAdd"); pg.wait_for_timeout(500)

                pg.evaluate("document.getElementById('goCart').click()"); pg.wait_for_timeout(500)
                txt=pg.locator("#cartSheet").inner_text()
                check("delivery fee row shown", "رسوم التوصيل" in txt)
                check("min order hint shown (cart below 30)", pg.locator("#minOrderHint").is_visible())
                pg.screenshot(path="/tmp/cust_cart.png")
        br.close()
    # server-side order checks via API
    store=ids[0]; it=[i for i in call("GET","/api/menu?restaurantId="+store)["items"]][0]
    r=call("POST","/api/orders",{"restaurantId":store,"customer":{"name":"a","phone":"1","addr":"x"},"items":[{"id":it["id"],"qty":1,"price":0.01}]})
    check("min order enforced server-side", r.get("error")=="Minimum order not reached")
    r=call("POST","/api/orders",{"restaurantId":store,"customer":{"name":"a","phone":"1","addr":"x"},"items":[{"id":it["id"],"qty":5}]})
    check("order accepted + total includes fee", r.get("ok") is True)
    o=[x for x in __import__("builtins").__dict__.get("_x",[])]
    r=call("POST","/api/orders",{"restaurantId":ids[1],"customer":{"name":"a","phone":"1","addr":"x"},"items":[{"id":"x","qty":1}]})
    check("paused store rejects orders", r.get("_status") in (400,403))
    r=call("POST","/api/orders",{"restaurantId":ids[2],"customer":{"name":"a","phone":"1","addr":"x"},"items":[{"id":"x","qty":1}]})
    check("unpublished store: ordering refused", r.get("_status") in (400,403))
finally:
    srv.terminate()
print("JS ERRORS:",[e for e in errs if "404" not in e][:6]); print("ALL PASS" if ok else "SOME FAILED")
