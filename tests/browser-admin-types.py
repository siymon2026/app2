import asyncio
from playwright.async_api import async_playwright
errs=[]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={"width":1100,"height":800})).new_page()
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE "+m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:4010/admin-harness")
        # --- types manager
        await pg.click("#stTypesBtn"); await pg.wait_for_selector(".stx-item")
        print("types listed:", await pg.locator(".stx-item").count())
        await pg.screenshot(path="/tmp/shots/a1_types.png")
        # disable cafe
        row=pg.locator(".stx-item", has_text="مقهى")
        await row.locator("input[type=checkbox]").uncheck(); await pg.wait_for_timeout(300)
        print("reloaded hook calls:", await pg.evaluate("window.__reloaded"))
        # new type
        await pg.click("button:has-text('نوع جديد')"); await pg.wait_for_selector(".stx-grid")
        ins=pg.locator(".stx-grid input")
        await ins.nth(0).fill("toys"); await ins.nth(1).fill("🧸"); await ins.nth(2).fill("ألعاب"); await ins.nth(3).fill("Jouets"); await ins.nth(4).fill("Toys")
        await pg.click("button:has-text('＋ حقل')")
        f=pg.locator(".stx-fld").first
        await f.locator("input").nth(0).fill("age"); await f.locator("input").nth(1).fill("العمر")
        await f.locator("select").select_option("number")
        await pg.screenshot(path="/tmp/shots/a2_typeform.png")
        await pg.click("button:has-text('حفظ')"); await pg.wait_for_selector(".stx-item:has-text('ألعاب')")
        print("new type saved")
        # duplicate id -> error shown
        await pg.click("button:has-text('نوع جديد')"); await pg.wait_for_selector(".stx-grid")
        ins=pg.locator(".stx-grid input"); await ins.nth(0).fill("toys"); await ins.nth(2).fill("x")
        await pg.click("button:has-text('حفظ')"); await pg.wait_for_function("document.querySelector('.stx-err').textContent.length>0")
        print("dup error:", await pg.inner_text(".stx-err"))
        await pg.click("button:has-text('رجوع')"); await pg.wait_for_selector(".stx-item")
        # delete custom type
        pg.once("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.locator(".stx-item", has_text="ألعاب").locator("button:has-text('حذف')").click()
        await pg.wait_for_function("!document.body.innerText.includes('ألعاب')")
        print("custom type deleted; builtin has no delete btn:", await pg.locator(".stx-item", has_text="بقالة").locator("button:has-text('حذف')").count()==0)
        await pg.keyboard.press("Escape"); await pg.mouse.click(5,5)
        # --- profile
        await pg.click("#prof"); await pg.wait_for_selector(".stx-stats")
        print("profile:", (await pg.inner_text(".stx-box"))[:160].replace("\n"," | "))
        await pg.screenshot(path="/tmp/shots/a3_profile.png")
        ins=pg.locator(".stx-grid input")
        await ins.nth(0).fill("new@x.com"); await ins.nth(2).fill("secret1")
        await pg.locator(".stx-grid select").select_option("manager")
        await pg.click("button:has-text('إضافة')"); await pg.wait_for_selector("td:has-text('new@x.com')")
        print("account added")
        await ins.nth(0).fill("bad@x.com"); await ins.nth(2).fill("123")
        await pg.click("button:has-text('إضافة')"); await pg.wait_for_function("document.querySelector('.stx-err').textContent.length>0")
        print("short pw error:", await pg.inner_text(".stx-err"))
        await b.close()
    print("ERRORS:", errs or "none")
asyncio.run(main())
