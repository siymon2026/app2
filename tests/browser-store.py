import asyncio, json
from playwright.async_api import async_playwright
BASE="http://localhost:4010/store/"
errs=[]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={"width":1280,"height":800}, locale="ar")
        pg=await ctx.new_page()
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE "+m.text) if m.type=="error" else None)
        await pg.goto(BASE); await pg.wait_for_selector("#li")
        await pg.screenshot(path="/tmp/shots/01_login.png")
        # wrong password
        await pg.fill("#li","boss@x.com"); await pg.fill("#lp","bad"); await pg.click("button[type=submit]")
        await pg.wait_for_function("document.getElementById('lmsg').textContent.length>0")
        print("bad login msg:", await pg.inner_text("#lmsg"))
        await pg.fill("#lp","pw"); await pg.click("button[type=submit]")
        await pg.wait_for_selector(".picker")
        await pg.screenshot(path="/tmp/shots/02_picker.png")
        await pg.click(".picker .btn >> nth=0")
        await pg.wait_for_selector(".stats")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path="/tmp/shots/03_dashboard.png")
        print("nav:", await pg.eval_on_selector_all(".nav a","els=>els.map(e=>e.innerText.replace(/\\n/g,' '))"))
        # orders_new
        await pg.click('.nav a[data-k=orders_new]'); await pg.wait_for_selector(".item")
        await pg.screenshot(path="/tmp/shots/04_orders_new.png")
        await pg.click(".item"); await pg.wait_for_selector(".modal")
        await pg.screenshot(path="/tmp/shots/05_order_modal.png")
        await pg.click(".modal .btn.primary >> nth=0")   # accept
        await pg.wait_for_selector(".modal h2:has-text('تأكيد')")
        await pg.click(".modal .foot .btn.primary")
        await pg.wait_for_function("document.querySelector('.toast.show')")
        print("accept toast:", await pg.inner_text("#toast"))
        # open again -> should be preparing
        await pg.click('.nav a[data-k=orders]'); await pg.wait_for_selector(".item")
        txt=await pg.inner_text(".list"); print("orders list has preparing:", "قيد التحضير" in txt)
        # products: add
        await pg.click('.nav a[data-k=products]'); await pg.wait_for_selector("table.tbl")
        await pg.click("button:has-text('إضافة')"); await pg.wait_for_selector(".modal")
        inputs=await pg.query_selector_all(".modal input.input")
        await inputs[0].fill("طماطم"); await inputs[1].fill("Tomate")
        await pg.fill(".modal input[type=number] >> nth=0","9.5")
        await pg.screenshot(path="/tmp/shots/06_product_form.png")
        await pg.select_option(".modal select","kg")
        await pg.click(".modal .btn.primary")
        await pg.wait_for_selector("td:has-text('طماطم')")
        print("product added")
        # pricing inline: sale price >= price => error toast
        await pg.click('.nav a[data-k=pricing]'); await pg.wait_for_selector("table.tbl")
        await pg.screenshot(path="/tmp/shots/07_pricing.png")
        # inventory
        await pg.click('.nav a[data-k=inventory]'); await pg.wait_for_selector("table.tbl")
        await pg.screenshot(path="/tmp/shots/08_inventory.png")
        # customers -> chat
        await pg.click('.nav a[data-k=customers]'); await pg.wait_for_selector("table.tbl")
        await pg.screenshot(path="/tmp/shots/09_customers.png")
        await pg.click("table.tbl tbody tr >> nth=0 >> button")
        await pg.wait_for_selector(".msgs")
        await pg.fill(".chat input.input","مرحبا، طلبك قيد التحضير"); await pg.keyboard.press("Enter")
        await pg.wait_for_selector(".msg.me")
        await pg.screenshot(path="/tmp/shots/10_chat.png")
        # settings/hours/delivery
        for k in ["settings","hours","delivery","reports","notifications","categories","help"]:
            await pg.click(f'.nav a[data-k={k}]'); await pg.wait_for_timeout(300)
        await pg.click('.nav a[data-k=hours]'); await pg.wait_for_selector(".hours-row")
        await pg.screenshot(path="/tmp/shots/11_hours.png")
        # switch language
        await pg.click("button:has-text('FR')"); await pg.wait_for_timeout(300)
        await pg.click('.nav a[data-k=dashboard]'); await pg.wait_for_selector(".stats")
        print("fr dir:", await pg.evaluate("document.documentElement.dir"))
        await pg.screenshot(path="/tmp/shots/12_fr.png")
        await ctx.close()

        # mobile, cashier (phone login)
        m=await b.new_context(viewport={"width":390,"height":780}, locale="ar", is_mobile=True)
        mp=await m.new_page()
        mp.on("pageerror", lambda e: errs.append("M-PAGEERROR "+str(e)))
        mp.on("console", lambda x: errs.append("M-CONSOLE "+x.text) if x.type=="error" else None)
        await mp.goto(BASE); await mp.wait_for_selector("#li")
        await mp.fill("#li","0600000009"); await mp.fill("#lp","pw"); await mp.click("button[type=submit]")
        await mp.wait_for_selector(".top")
        await mp.screenshot(path="/tmp/shots/13_mobile_cashier.png")
        await mp.click(".menu-btn"); await mp.wait_for_timeout(300)
        await mp.screenshot(path="/tmp/shots/14_mobile_drawer.png")
        print("cashier nav:", await mp.eval_on_selector_all(".nav a","els=>els.map(e=>e.dataset.k)"))
        await mp.click('.nav a[data-k=orders]'); await mp.wait_for_selector(".item")
        await mp.click(".item"); await mp.wait_for_selector(".modal")
        print("cashier phone:", await mp.inner_text(".modal"))
        await mp.screenshot(path="/tmp/shots/15_mobile_order.png")
        await b.close()
    print("ERRORS:", errs or "none")
asyncio.run(main())
