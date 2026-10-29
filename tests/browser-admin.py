import subprocess, time, json, urllib.request, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(["node","tests/ui-mock-server.js"], env={"PORT":"4011","PATH":"/usr/bin:/usr/local/bin"})
time.sleep(1.2)
B="http://localhost:4011"
def get(path, tok=None):
    r=urllib.request.Request(B+path, headers={"X-Admin-Token":tok} if tok else {})
    return json.load(urllib.request.urlopen(r))
errs=[]; ok=True
def check(name, cond):
    global ok; print(("PASS " if cond else "FAIL ")+name); ok = ok and bool(cond)
try:
  with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={"width":1280,"height":900})
    ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','test-admin-token');localStorage.setItem('siymon_admin_lang','ar')")
    pg=ctx.new_page()
    pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
    pg.on("console", lambda m: errs.append("console: "+m.text) if m.type=="error" else None)
    pg.goto(B+"/admin/"); pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('menuManageBtn').click()"); pg.wait_for_timeout(500)
    check("menu modal rows rendered", pg.locator("#restaurantsBody tr").count()==4)
    check("status badge shown", pg.locator("#restaurantsBody .st-badge").count()==4)
    check("filter bar present", pg.locator("#storesFilterBar").count()==1)
    # add restaurant
    pg.fill("#restNameAr","مطعم الاختبار"); pg.fill("#restNameEn","Test Place"); pg.fill("#restPhone","0600000000")
    pg.click("#addRestBtn"); pg.wait_for_timeout(1200)
    check("edit modal opens after add", pg.locator("#restEditModal").is_visible())
    check("extra fields built", pg.locator("#stMinOrder").count()==1)
    pg.select_option("#stStatus","active"); pg.fill("#stType","pizza"); pg.fill("#stCity","برشيد")
    pg.fill("#stMinOrder","30"); pg.fill("#stDelFee","10"); pg.fill("#stFreeOver","120"); pg.fill("#stAvgMin","25"); pg.fill("#stSort","5")
    pg.check("#stFeatured"); pg.fill("#stOffer","-15%")
    for d in range(7):
        pg.fill(f"#stOpen{d}","00:00"); pg.fill(f"#stClose{d}","23:59")
    pg.click("#saveRestEditBtn"); pg.wait_for_timeout(1000)
    st=get("/api/admin/restaurants","test-admin-token")["restaurants"]
    new=[r for r in st if r["name"]["en"]=="Test Place"]
    check("restaurant created", len(new)==1)
    r=new[0]
    check("fields persisted", r.get("minOrder")==30 and r.get("deliveryFee")==10 and r.get("freeDeliveryOver")==120 and r.get("type")=="pizza" and r.get("featured") is True and r.get("avgDeliveryMin")==25)
    check("hours persisted", r.get("hours") and r["hours"]["days"]["1"]["open"]=="00:00")
    pub=get("/api/restaurants")["restaurants"]
    check("published store visible to customers", any(x["id"]==r["id"] for x in pub))
    # hide via toggle
    pg.evaluate("document.getElementById('closeRestEditBtn') && document.getElementById('closeRestEditBtn').click()")
    pg.wait_for_timeout(300)
    row=pg.locator(f'#restaurantsBody button[data-action="toggle-rest"][data-id="{r["id"]}"]')
    row.click(); pg.wait_for_timeout(900)
    pub=get("/api/restaurants")["restaurants"]
    check("hidden store disappears from customer API", not any(x["id"]==r["id"] for x in pub))
    # archive
    pg.once("dialog", lambda d: d.accept())
    pg.locator(f'#restaurantsBody button[data-action="archive-rest"][data-id="{r["id"]}"]').click(); pg.wait_for_timeout(900)
    st=get("/api/admin/restaurants","test-admin-token")["restaurants"]
    check("archived status stored", [x for x in st if x["id"]==r["id"]][0]["status"]=="archived")
    check("restore button shown", pg.locator(f'button[data-action="restore-rest"][data-id="{r["id"]}"]').count()==1)
    # filter
    pg.fill("#stFq","Test Place"); pg.wait_for_timeout(300)
    check("search filter works", pg.locator("#restaurantsBody tr").count()==1)
    pg.fill("#stFq","")
    # item edit extras
    pg.evaluate("setMenuTab('items')"); pg.wait_for_timeout(300)
    first=pg.locator('#itemsBody button[data-action="edit-item"]').first
    first.click(); pg.wait_for_timeout(500)
    check("item extra fields built", pg.locator("#stSale").count()==1)
    price=float(pg.input_value("#itemEditPrice") or 0)
    pg.fill("#stSale",str(max(price-1,0))); pg.fill("#stStock","7"); pg.check("#stIFeat")
    pg.click("#saveItemEditBtn"); pg.wait_for_timeout(900)
    items=get("/api/admin/menu","test-admin-token")["items"]
    it=[i for i in items if i.get("stock")==7]
    check("item sale/stock/featured saved", len(it)==1 and it[0]["salePrice"]==max(price-1,0) and it[0]["featured"] is True)
    # home tab
    pg.evaluate("setMenuTab('home')"); pg.wait_for_timeout(600)
    check("home sections listed", pg.locator("#menuPanelHome .st-card").count()>=4)
    pg.click('#menuPanelHome button[data-add="categories"]')
    pg.fill('#menuPanelHome input[data-l="categories"][data-p="name.ar"]',"برغر")
    pg.fill('#menuPanelHome input[data-l="categories"][data-p="name.en"]',"Burger")
    pg.click('#menuPanelHome button[data-add="banners"]')
    pg.click("#stHomeSave"); pg.wait_for_timeout(800)
    c=get("/api/admin/catalog","test-admin-token")
    check("category saved", len(c["categories"])==1 and c["categories"][0]["name"]["en"]=="Burger")
    check("empty banner (no image) not shown publicly", len(get("/api/home")["banners"])==0)
    br.close()
finally:
    srv.terminate()
print("JS ERRORS:", [e for e in errs if "favicon" not in e and "manifest" not in e][:8])
print("ALL PASS" if ok else "SOME FAILED")
