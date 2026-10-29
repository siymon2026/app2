import subprocess, time, json, urllib.request, os
from playwright.sync_api import sync_playwright
PORT="4015"; B="http://localhost:"+PORT; OUT=os.environ.get("SHOTS","/tmp")
srv=subprocess.Popen(["node","tests/ui-mock-server.js"],env={"PORT":PORT,"PATH":os.environ["PATH"],"SEED_DIR":os.environ.get("SEED_DIR","")}); time.sleep(1.2)
def call(method,path,body=None):
    r=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers={"Content-Type":"application/json"},method=method)
    return json.load(urllib.request.urlopen(r))
ok=True; errs=[]
def check(n,c):
    global ok; print(("PASS " if c else "FAIL ")+n); ok=ok and bool(c)
BER={"latitude":33.2655,"longitude":-7.5853}; BER2={"latitude":33.2701,"longitude":-7.5902}
def newpage(br,vw=None,geo=True,pos=BER,token=None,local=None,lang="ar"):
    ctx=br.new_context(viewport=vw or {"width":390,"height":844},locale="ar",permissions=["geolocation"] if geo else [],geolocation=pos if geo else None)
    init="localStorage.setItem('siymon_lang_v1','%s');"%lang
    if token: init+="localStorage.setItem('siymon_customer_token_v1','cust-token');"
    if local: init+="if(!localStorage.getItem('siymon_addresses_v1'))localStorage.setItem('siymon_addresses_v1',%s);"%json.dumps(json.dumps(local))
    ctx.add_init_script(init)
    pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.route("**/fonts.g*/**",lambda r:r.abort()); pg.route("**/accounts.google.com/**",lambda r:r.abort())
    pg.route("**/api/public-config",lambda r:r.fulfill(status=200,content_type="application/json",body=json.dumps({"restaurantMode":"open","supportPhone":"+212000000000"})))
    posts=[]; pg.on("request",lambda rq: posts.append(json.loads(rq.post_data or "{}")) if rq.method=="POST" and rq.url.endswith("/api/orders") else None)
    pg.posts=posts
    return ctx,pg
def addrs(pg): return json.loads(pg.evaluate("localStorage.getItem('siymon_addresses_v1')") or "[]")
sheet_open=lambda pg: pg.locator("#addrSheet").is_visible() if pg.locator("#addrSheet").count() else False
try:
    with sync_playwright() as p:
        br=p.chromium.launch()
        # ===== 1. first visit + allow location =====
        ctx,pg=newpage(br); pg.goto(B+"/"); pg.wait_for_timeout(1800)
        check("first visit: welcome sheet shows (no navigation away)", sheet_open(pg) and pg.url.rstrip("/")==B)
        check("first visit: intro text + later button", pg.locator(".addr-intro").count()==1 and pg.locator("#addrLater").count()==1)
        h=pg.evaluate("document.querySelector('#addrSheet .sheet-card').getBoundingClientRect().height/innerHeight")
        check("sheet is compact (<60% of screen)", h<0.6)
        pg.screenshot(path=f"{OUT}/addr_1_welcome.png")
        pg.click("#addrLocate"); pg.wait_for_selector("#adHood",timeout=8000)
        check("allowed: form opens prefilled from reverse geocode", pg.input_value("#adHood")=="حي السلام" and pg.input_value("#adStreet")=="شارع محمد الخامس" and pg.input_value("#adBldg")=="12")
        check("allowed: success message shown", pg.locator(".addr-msg.ok").count()==1)
        pg.fill("#adBldg","12 / ط2 / ش4"); pg.fill("#adHint","الباب الأزرق"); pg.click(".addr-chip >> nth=0")
        pg.screenshot(path=f"{OUT}/addr_2_form.png")
        pg.click("#addrSave"); pg.wait_for_timeout(500)
        check("saved: sheet closes automatically", not sheet_open(pg))
        a=addrs(pg)
        check("saved: stored with coords, label, default", len(a)==1 and a[0]["lat"] and a[0]["isDefault"] and a[0]["label"]=="المنزل")
        check("bar shows saved address", "حي السلام" in pg.locator("#addrBar .addr-val").inner_text())
        check("custAddr (cart) uses saved address", "حي السلام" in pg.input_value("#custAddr") and "الباب الأزرق" in pg.input_value("#custAddr"))
        pg.screenshot(path=f"{OUT}/addr_3_home.png")
        # ===== 2. reopen app =====
        pg.reload(); pg.wait_for_timeout(1800)
        check("reopen: no prompt again", not sheet_open(pg))
        check("reopen: address persists in bar", "حي السلام" in pg.locator("#addrBar .addr-val").inner_text())
        check("reopen: cart address still the saved one", "حي السلام" in pg.input_value("#custAddr"))
        # ===== 3. refresh button -> new fresh location =====
        pg.evaluate("1"); ctx.set_geolocation(BER2)
        pg.click("#addrRefresh"); pg.wait_for_selector("#adHood",timeout=8000)
        check("refresh: sheet opens + relocates with NEW coords", abs(call("GET","/api/__state")["geocodeCalls"][-1]["lat"]-BER2["latitude"])<1e-6)
        pg.fill("#adHood","حي النصر"); pg.fill("#adLabel","العمل"); pg.click("#addrSave"); pg.wait_for_timeout(400)
        a=addrs(pg)
        check("2 addresses saved, newest default, old kept", len(a)==2 and a[0]["hood"]=="حي النصر" and a[0]["isDefault"] and sum(x["isDefault"] for x in a)==1)
        # ===== 4. choose saved / edit / delete =====
        pg.click("#addrMain"); pg.wait_for_timeout(300)
        check("manage: lists 2 saved addresses", pg.locator(".addr-row").count()==2)
        pg.screenshot(path=f"{OUT}/addr_4_list.png")
        pg.locator(".addr-row .addr-pick").nth(1).click(); pg.wait_for_timeout(300)
        check("choose older address -> bar + cart update", "حي السلام" in pg.locator("#addrBar .addr-val").inner_text() and "حي السلام" in pg.input_value("#custAddr"))
        pg.click("#addrMain"); pg.locator(".addr-row >> nth=0").locator(".addr-act >> nth=0").click(); pg.wait_for_selector("#adHood")
        pg.fill("#adStreet","شارع جديد"); pg.click("#addrSave"); pg.wait_for_timeout(300)
        check("edit keeps id (no duplicate)", len(addrs(pg))==2 and any(x["street"]=="شارع جديد" for x in addrs(pg)))
        pg.click("#addrMain"); pg.locator(".addr-del").first.click(); pg.wait_for_timeout(200)
        check("delete removes one and keeps a default", len(addrs(pg))==1 and addrs(pg)[0]["isDefault"])
        pg.keyboard.press("Escape")
        # ===== 5. checkout uses selected address =====
        pg.evaluate("selectedRestaurantId=RESTAURANTS[0].id; addToCart(products.find(p=>p.restaurantId===RESTAURANTS[0].id).id,5)")
        pg.evaluate("document.getElementById('goCart').click()"); pg.wait_for_timeout(300)
        check("cart shows the same address", "برشيد" in pg.input_value("#custAddr"))
        pg.fill("#custName","اختبار"); pg.fill("#custPhone","0612345678"); pg.click("#placeOrder"); pg.wait_for_timeout(900)
        o=pg.posts[-1] if pg.posts else {}
        sel=addrs(pg)[0]
        check("order carries chosen address + coordinates", sel["hood"] in o.get("customer",{}).get("addr","") and o["customer"].get("lat")==sel["lat"])
        check("after order address still selected (coords re-applied)", pg.evaluate("exactLat")==sel["lat"])
        ctx.close()
        # ===== 6. deny permission -> manual =====
        ctx,pg=newpage(br,geo=False); pg.goto(B+"/"); pg.wait_for_timeout(1800)
        pg.click("#addrLocate"); pg.wait_for_timeout(1200)
        check("denied: clear error, no crash, stays usable", "لم يتم السماح" in pg.locator("#addrMsg").inner_text() and pg.locator("#addrManual").is_enabled())
        pg.click("#addrManual"); pg.wait_for_selector("#adHood")
        pg.click("#addrSave"); check("empty address is rejected", "اكتب الحي" in pg.locator("#addrErr").inner_text() and len(addrs(pg))==0)
        pg.fill("#adHood","a"); pg.click("#addrSave"); check("1-char address rejected", len(addrs(pg))==0)
        pg.fill("#adHood","<b>حي الوفاء</b>"); pg.fill("#adStreet","زنقة 5"); pg.click("#addrSave"); pg.wait_for_timeout(300)
        a=addrs(pg); check("manual address saved without coords, markup stripped", len(a)==1 and a[0]["lat"] is None and "<" not in a[0]["hood"])
        check("manual: sheet closed, bar updated", not sheet_open(pg) and "حي الوفاء" in pg.locator("#addrBar .addr-val").inner_text())
        ctx.close()
        # ===== 7. geocode failure =====
        ctx,pg=newpage(br,pos={"latitude":10.0,"longitude":-7.58}); pg.goto(B+"/"); pg.wait_for_timeout(1800)
        pg.click("#addrLocate"); pg.wait_for_selector("#adHood",timeout=8000)
        check("geocode failure: form opens empty with explanatory message", pg.input_value("#adHood")=="" and "تعذّر تحويله" in pg.locator(".addr-msg").inner_text())
        pg.fill("#adHood","حي الأمل"); pg.click("#addrSave"); pg.wait_for_timeout(300)
        a=addrs(pg); check("geocode failure: manual completion keeps GPS coords", len(a)==1 and a[0]["lat"]==10.0)
        ctx.close()
        # ===== 8. offline =====
        ctx,pg=newpage(br); pg.goto(B+"/"); pg.wait_for_timeout(1800)
        ctx.set_offline(True); pg.click("#addrLocate"); pg.wait_for_timeout(300)
        check("offline: friendly message", "لا يوجد اتصال" in pg.locator("#addrMsg").inner_text())
        ctx.set_offline(False); ctx.close()
        # ===== 9. account sync (guest local + account merge, no loss/dupes) =====
        call("POST","/api/__seed_account",{"addresses":[{"id":"acc1","hood":"حي الحسن","street":"ش9","updatedAt":100,"isDefault":True},{"id":"acc2","hood":"حي الأمل","updatedAt":50}]})
        local=[{"id":"loc1","hood":"حي الورد","street":"ش3","updatedAt":500,"isDefault":True}]
        ctx,pg=newpage(br,token=True,local=local); pg.goto(B+"/"); pg.wait_for_timeout(2200)
        a=addrs(pg)
        check("sync: merged 3 addresses, no duplicates", len(a)==3 and len({x["id"] for x in a})==3)
        check("sync: local default kept", [x["id"] for x in a if x["isDefault"]]==["loc1"])
        pg.wait_for_timeout(800)
        st=call("GET","/api/__state")
        check("sync: account updated on server", len(st["accountAddresses"])==3)
        check("logged-in with addresses: no first-run prompt", not sheet_open(pg))
        pg.reload(); pg.wait_for_timeout(1800)
        check("sync: reload does not duplicate", len(addrs(pg))==3)
        ctx.close()
        # ===== 10. small phone + dark + English =====
        for tag,vw,sch,lg in (("320",{"width":320,"height":568},"light","ar"),("dark",{"width":390,"height":844},"dark","ar"),("en",{"width":390,"height":844},"light","en")):
            ctx,pg=newpage(br,vw=vw,lang=lg)
            if sch=="dark": pg.add_init_script("localStorage.setItem('siymon_theme_v3','dark')")
            pg.goto(B+"/"); pg.wait_for_timeout(1800)
            pg.screenshot(path=f"{OUT}/addr_5_{tag}_welcome.png")
            pg.click("#addrManual"); pg.wait_for_selector("#adHood")
            vis=pg.evaluate("(()=>{const b=document.getElementById('addrSave').getBoundingClientRect();return b.bottom<=innerHeight+1&&b.top>=0})()")
            check(tag+": save button visible within viewport", vis)
            check(tag+": no horizontal overflow", pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
            pg.screenshot(path=f"{OUT}/addr_5_{tag}_form.png")
            ctx.close()
        br.close()
finally:
    srv.terminate()
bad=[e for e in errs if "404" not in e and "ERR_FAILED" not in e and "Failed to load resource" not in e]
print("JS ERRORS:",bad[:6]); print("ALL PASS" if ok and not bad else "SOME FAILED")
