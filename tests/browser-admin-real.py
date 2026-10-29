import asyncio
from playwright.async_api import async_playwright
errs=[]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1300,"height":850})
        await ctx.add_init_script("localStorage.setItem('siymon_admin_token_v2','adm')")
        pg=await ctx.new_page()
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
        await pg.goto("http://localhost:4010/admin/"); await pg.wait_for_timeout(1200)
        await pg.get_by_role("button", name="المطاعم والوجبات").click(); await pg.wait_for_timeout(500)
        vis=await pg.evaluate("[...document.querySelectorAll('[data-tab],.sb-subitem')].filter(b=>b.offsetParent).map(b=>(b.id||'')+':'+b.textContent.trim().slice(0,20))")
        print("sub items:", vis)
        await pg.screenshot(path="/tmp/shots/a0b.png")
        await pg.locator(".sb-subitem", has_text="المطاعم").first.click(); await pg.wait_for_timeout(400); await pg.wait_for_selector("#restaurantsBody tr", timeout=5000)
        await pg.wait_for_timeout(600)
        print("rows:", await pg.locator("#restaurantsBody tr").count())
        print("profile btns:", await pg.locator("[data-action=store-profile]").count(), "| types btn:", await pg.locator("#stTypesBtn").count())
        # type filter now has the dynamic list
        print("filter options:", await pg.eval_on_selector("#stFt","s=>s.options.length"))
        await pg.screenshot(path="/tmp/shots/a4_real_stores.png")
        # open profile for a store from the real table
        await pg.locator("[data-action=store-profile]").first.click(); await pg.wait_for_selector(".stx-stats")
        print("profile opened from real table")
        await pg.mouse.click(5,5)
        # edit a legacy-type store: type select must keep 'pizza'
        await pg.locator("tr", has_text="مطعم قديم").locator("[data-action=edit-rest]").click()
        await pg.wait_for_selector("#stType", timeout=5000); await pg.wait_for_timeout(300)
        print("legacy type kept:", await pg.input_value("#stType"), "| tag:", await pg.eval_on_selector("#stType","e=>e.tagName"))
        await b.close()
    print("PAGE ERRORS:", errs or "none")
asyncio.run(main())
