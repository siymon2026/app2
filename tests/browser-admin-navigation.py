#!/usr/bin/env python3
"""Exercise the admin shell against a disposable instance of the real server.

Prerequisites: npm ci, Python Playwright and its Chromium browser. Run from any
working directory with `python tests/browser-admin-navigation.py`. Nothing in the
repository's data directory is used or modified. If node_modules/leaflet exists,
its real JS/CSS are used; otherwise the existing test stub is used. External map
images and external product photos are replaced with a tiny local image, so
live tile/image delivery is NOT tested.
"""
import base64
import json
import os
import re
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PIXEL = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yfO0AAAAASUVORK5CYII=")
EMAIL = "admin@example.test"
PASSWORD = "NavigationTest2026!"
SUPPORT_EMAIL = "support@example.test"
SUPPORT_PASSWORD = "SupportTest2026!"


def request(base, path, *, method="GET", body=None, token=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["X-Admin-Token"] = token
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}, resp.headers
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            payload = raw.decode(errors="replace")
        return err.code, payload, err.headers


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    print("PASS", label, flush=True)


def setup_server(tmp):
    root = Path(tmp)
    for name in ("server.js", "logger.js", "notifications-core.js", "package.json"):
        shutil.copy2(ROOT / name, root / name)
    shutil.copytree(ROOT / "lib", root / "lib")
    (root / "public").symlink_to(ROOT / "public", target_is_directory=True)
    (root / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    for name in ("data", "uploads", "logs", "backups"):
        (root / name).mkdir()
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    env = dict(os.environ, PORT=str(port), NODE_ENV="test", DATA_DIR=str(root / "data"),
               UPLOAD_DIR=str(root / "uploads"), LOG_DIR=str(root / "logs"), BACKUP_DIR=str(root / "backups"),
               JWT_SECRET="temporary-navigation-test-only-secret")
    log = (root / "server.log").open("w+")
    proc = subprocess.Popen(["node", "server.js"], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    base = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            log.seek(0)
            raise RuntimeError("Test server exited:\n" + log.read())
        try:
            urllib.request.urlopen(base + "/admin/", timeout=1).close()
            return proc, base, log
        except OSError:
            time.sleep(0.1)
    proc.terminate()
    raise RuntimeError("Test server did not start")


def seed(base, root):
    status, signup, _ = request(base, "/api/admin/signup", method="POST", body={
        "email": EMAIL, "phone": "0612345678", "password": PASSWORD, "password2": PASSWORD,
    })
    assert status == 200, signup
    token = signup["token"]
    status, stores, _ = request(base, "/api/admin/restaurants", token=token)
    assert status == 200 and stores["restaurants"]
    store_id = stores["restaurants"][0]["id"]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    order = {"id": "E2E-ORDER-1", "createdAt": now, "updatedAt": now, "status": "new", "restaurantId": store_id,
             "customer": {"name": "Navigation Customer", "phone": "0600001234", "addr": "Berrechid"},
             "items": [{"name": "Test meal", "qty": 1, "price": 35}], "subtotal": 35, "deliveryFee": 5, "total": 40}
    rated = dict(order, id="E2E-RATED-1", status="delivered", deliveredAt=now,
                 customerRating={"stars": 4, "comment": "Navigation test review", "storeId": store_id,
                                 "createdAt": now, "updatedAt": now, "commentStatus": "pending"})
    rated_reject = dict(rated, id="E2E-RATED-2")
    (root / "data" / "orders.json").write_text(json.dumps({"orders": [order, rated, rated_reject]}))
    complaint = {"id": "CP-NAV00001", "orderId": order["id"], "customerId": "customer-test", "storeId": store_id,
                 "driverId": "", "against": "platform", "category": "other", "text": "Navigation test complaint",
                 "clientId": None, "status": "escalated", "responsible": {"role": "supervisor", "id": ""},
                 "respondBy": None, "replyBy": None, "exceptionCaseId": None, "resolution": None,
                 "createdAt": now, "updatedAt": now,
                 "timeline": [{"at": now, "kind": "filed", "actor": {"role": "customer", "id": "customer-test", "name": ""},
                               "text": "Navigation test complaint", "visibility": "all"}]}
    (root / "data" / "complaints.json").write_text(json.dumps({"complaints": [complaint], "settings": {}}))
    time.sleep(0.35)  # The server's JSON reader caches disk reads briefly.
    return token


def check_csp(base):
    for path in ("/admin/zones/", "/admin/zones/index.html", "/store/", "/store/index.html", "/restaurant/", "/restaurant/index.html"):
        status, _, headers = request_html(base, path)
        assert status == 200 and "frame-ancestors 'self'" in headers.get("Content-Security-Policy", ""), path
    for path in ("/admin/", "/orders/", "/store/store.js"):
        status, _, headers = request_html(base, path)
        assert status == 200 and "frame-ancestors 'none'" in headers.get("Content-Security-Policy", ""), path
    check("CSP permits only the required same-origin documents to be framed", True)


def request_html(base, path):
    with urllib.request.urlopen(base + path, timeout=8) as resp:
        return resp.status, resp.read(), resp.headers


def exercise(base, admin_token):
    vendor = ROOT / "node_modules" / "leaflet" / "dist"
    real_leaflet = (vendor / "leaflet.js").is_file() and os.environ.get("SIYMON_USE_LEAFLET_STUB") != "1"
    js = (vendor / "leaflet.js").read_text() if real_leaflet else (ROOT / "tests" / "leaflet-stub.js").read_text()
    css = (vendor / "leaflet.css").read_text() if real_leaflet else ""
    errors, failed, dialogs, network_failed = [], [], [], []
    with sync_playwright() as pw:
        options = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_PATH"):
            options["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_PATH"]
        browser = pw.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 950}, service_workers="block")
        context.route("**/leaflet.min.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=js))
        context.route("**/leaflet.min.css", lambda route: route.fulfill(status=200, content_type="text/css", body=css))
        context.route("**/tile.openstreetmap.org/**", lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL))
        # The sandbox cannot reach these image hosts; the real product records are still used.
        context.route("**/images.unsplash.com/**", lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL))
        context.route("**/uploads.onecompiler.io/**", lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL))
        context.add_init_script("""(() => {
          if (!localStorage.getItem('siymon_admin_lang_v1')) localStorage.setItem('siymon_admin_lang_v1','en');
          localStorage.setItem('siymon_admin_sound_v1','0');
          if (!localStorage.getItem('siymon_store_token')) localStorage.setItem('siymon_store_token','standalone-store-session');
          if (!localStorage.getItem('siymon_restaurant_token_v1')) localStorage.setItem('siymon_restaurant_token_v1','standalone-restaurant-session');
        })();""")
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append("console: " + m.text + " " + str(m.location)) if m.type == "error" else None)
        page.on("response", lambda r: failed.append((r.status, r.url)) if r.status >= 400 else None)
        page.on("requestfailed", lambda r: network_failed.append((r.url, r.failure)))
        page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
        page.goto(base + "/admin/", wait_until="domcontentloaded")
        expect(page.locator("#authModal.show")).to_be_visible()
        page.fill("#loginId", EMAIL)
        page.fill("#loginPassword", PASSWORD)
        page.click("#loginBtn")
        page.wait_for_function("() => window.adminPerms && window.adminPerms.perms() && !document.querySelector('#authModal').classList.contains('show')")
        page.evaluate("() => window.__shellForTest=[document.querySelector('.app-header'),document.querySelector('#sideNav'),document.querySelector('#adminPages')]")
        check("real login succeeds and the Orders page is present", page.locator("#ordersTable").is_visible())
        page.click("#allBtn")
        page.fill("#searchInput", "E2E-ORDER-1")
        expect(page.locator("#ordersBody")).to_contain_text("E2E-ORDER-1")
        page.fill("#searchInput", "no-such-order-123")
        expect(page.locator("#ordersBody")).not_to_contain_text("E2E-ORDER-1")
        page.fill("#searchInput", "E2E-ORDER-1")
        page.locator('[data-action="view"][data-id="E2E-ORDER-1"]').click()
        expect(page.locator("#detailsBox")).to_contain_text("Test meal")
        with page.expect_response(lambda r: r.url.endswith("/api/orders/E2E-ORDER-1") and r.request.method == "PATCH") as accepted:
            page.locator('[data-action="accept"][data-id="E2E-ORDER-1"]').click()
        assert accepted.value.status == 200 and accepted.value.json()["status"] == "admin_accepted"
        status, orders, _ = request(base, "/api/orders", token=admin_token)
        assert status == 200 and any(o["id"] == "E2E-ORDER-1" and o["status"] == "admin_accepted" for o in orders["orders"])
        page.fill("#searchInput", "")
        check("Orders data, search, detail and acceptance use the real backend", True)

        routes = [
            ("drivers", "driversModal", "drivers"), ("dispatch", "dispatchModal", "dispatch"),
            ("customers", "customersModal", "customers"), ("support", "supportModal", "support"),
            ("storeSupport", "storeSupportModal", "store-support"), ("exceptions", "exceptionsModal", "exceptions"),
            ("feedback", "feedbackModal", "feedback"), ("reports", "reportsModal", "reports"),
            ("notifications", "notificationsModal", "notifications"), ("system", "systemModal", "system"),
            ("audit", "systemModal", "audit"), ("settings", "settingsModal", "settings"),
            ("topups", "topupsModal", "topups"), ("zones", "zonesModal", "zones"),
            ("storeEnter", "storeEnterModal", "store-enter"), ("portal", "portalModal", "portal"),
            ("staff", "staffModal", "staff"), ("promos", "promosModal", "promos"), ("payments", "paymentsModal", "payments"),
        ]
        route_map = {key: (modal, slug) for key, modal, slug in routes}

        def nav(key):
            modal, slug = route_map[key]
            page.locator(f'.sb-item[data-key="{key}"]').click()
            expect(page.locator(f"#{modal}.show")).to_be_visible(timeout=10000)
            page.wait_for_function("slug => location.hash === '#/' + slug", arg=slug)
            expect(page.locator(f'.sb-item[data-key="{key}"]')).to_have_class(re.compile(r"\bactive\b"))
            assert page.evaluate("() => __shellForTest.every((n,i)=>n === [document.querySelector('.app-header'),document.querySelector('#sideNav'),document.querySelector('#adminPages')][i])")
            assert page.locator(".app-header").is_visible() and page.locator("#sideNav").is_visible()
            assert page.locator("#adminPages .page-view.show").count() == 1 and len(context.pages) == 1

        for key, _, _ in routes:
            nav(key)
        check("all sidebar destinations render within the unchanged shell, active/hash correct, one tab", True)
        page.locator('.sb-item[data-key="menuManage"]').click()
        expect(page.locator("#menuModal.show")).to_be_visible()
        expect(page.locator("#sbSubMenu")).to_be_visible()
        assert page.locator('.sb-item[data-key="menuManage"]').get_attribute("aria-expanded") == "true"
        for subkey, slug, tab in (("subRest", "menu/restaurants", "menuTabRestaurants"), ("subMeals", "menu/meals", "menuTabItems")):
            page.locator(f'.sb-subitem[data-key="{subkey}"]').click()
            page.wait_for_function("slug => location.hash === '#/' + slug", arg=slug)
            expect(page.locator(f'.sb-subitem[data-key="{subkey}"]')).to_have_attribute("aria-current", "page")
            expect(page.locator(f"#{tab}")).to_have_class(re.compile(r"\bactive\b"))
        check("the management group opens, expands and highlights its subpages", True)
        nav("promos")
        page.locator("#promosModal .sen-x").click()
        page.wait_for_function("() => location.hash === '#/'")
        expect(page.locator("#ordersTable")).to_be_visible()
        check("closing a section returns to Orders inside the same shell", True)

        # Staff: add a restricted user through the actual form and read it back.
        nav("staff")
        form = page.locator("#staffModal > .sen-box")
        form.locator("input[type=text]").fill("Navigation Support")
        form.locator("input[type=email]").fill(SUPPORT_EMAIL)
        form.locator("input[type=tel]").fill("0698765432")
        form.locator("input[type=password]").fill(SUPPORT_PASSWORD)
        form.locator(":scope > select").select_option("support")
        with page.expect_response(lambda r: r.url.endswith("/api/admin/staff") and r.request.method == "POST") as result:
            form.locator("button.sen-btn.primary").click()
        assert result.value.status == 200 and result.value.json()["staff"]["role"] == "support"
        nav("promos")
        form = page.locator("#promosModal > .sen-box")
        form.locator('input[maxlength="24"]').fill("NAVTEST10")
        form.locator("input[type=number]").first.fill("10")
        with page.expect_response(lambda r: r.url.endswith("/api/admin/promos") and r.request.method == "POST") as result:
            form.locator("button.sen-btn.primary").click()
        assert result.value.status == 200 and result.value.json()["promo"]["code"] == "NAVTEST10"
        nav("payments")
        page.locator("#paymentsModal .sen-row button").first.click()
        editor = page.locator("[data-payment-editor]")
        expect(editor).to_be_visible()
        editor.locator("input[type=number]").last.fill("57")
        with page.expect_response(lambda r: "/api/admin/payment-methods/" in r.url and r.request.method == "PUT") as result:
            editor.locator("button.sen-btn.primary").click()
        saved_payment = result.value.json()["method"]
        assert result.value.status == 200 and saved_payment["sortOrder"] == 57
        page.go_back()
        expect(page.locator("#promosModal.show .sen-row").first).to_contain_text("NAVTEST10")
        nav("payments")
        payment_row = page.locator("#paymentsModal .sen-row", has_text=saved_payment["name"]["en"])
        payment_row.locator("button").click()
        editor = page.locator("[data-payment-editor]")
        assert editor.locator("input[type=number]").last.input_value() == "57"
        page.go_back()
        expect(page.locator("#promosModal.show")).to_be_visible()
        assert page.locator("[data-payment-editor]").count() == 0
        nav("storeSupport")
        page.click("#ssTabChannels")
        page.click("#ssAddCh")
        page.fill("#ssfAr", "Navigation support")
        page.fill("#ssfValue", "+212612345678")
        with page.expect_response(lambda r: r.url.endswith("/api/admin/support-channels") and r.request.method == "POST") as result:
            page.click("#ssfSave")
        assert result.value.status in (200, 201)
        status, items, _ = request(base, "/api/admin/support-channels", token=admin_token)
        assert status == 200 and any(c["value"] == "+212612345678" for c in items["channels"])
        assert any(x["email"] == SUPPORT_EMAIL for x in request(base, "/api/admin/staff", token=admin_token)[1]["staff"])
        assert any(x["code"] == "NAVTEST10" for x in request(base, "/api/admin/promos", token=admin_token)[1]["promos"])
        assert any(x["id"] == saved_payment["id"] and x["sortOrder"] == 57 for x in request(base, "/api/admin/payment-methods", token=admin_token)[1]["methods"])
        nav("staff")
        nav("storeSupport")
        page.click("#ssTabChannels")
        expect(page.locator("#ssChannels")).to_contain_text("Navigation support")
        check("staff, promos, payment configuration and store-support forms persist and re-read", True)

        # Exception linked to a real fixture order.
        nav("exceptions")
        page.click("#exNew")
        ex = page.locator("#exDetail .ex-form")
        ex.locator("select").first.select_option("unassigned_order")
        ex.locator("input").fill("E2E-ORDER-1")
        ex.locator("textarea").fill("Navigation test exception")
        with page.expect_response(lambda r: r.url.endswith("/api/admin/exceptions") and r.request.method == "POST") as result:
            ex.locator("button.pri").click()
        assert result.value.status in (200, 201), result.value.text()
        exception_id = result.value.json()["case"]["id"]
        page.fill("#exSearch", exception_id)
        expect(page.locator("#exItems")).to_contain_text("Navigation test exception")
        page.locator("#exItems .ex-item").first.click()
        expect(page.locator("#exDetail")).to_contain_text(exception_id)
        page.get_by_role("button", name="Log a contact").click()
        page.locator("#exDetail .ex-form textarea").fill("Contact draft survives search refresh")
        page.fill("#exSearch", "E2E-ORDER-1")
        page.wait_for_timeout(650)
        assert page.locator("#exDetail .ex-form textarea").input_value() == "Contact draft survives search refresh"
        with page.expect_response(lambda r: "/api/admin/exceptions/" + exception_id + "/contact" in r.url and r.request.method == "POST") as result:
            page.locator("#exDetail .ex-form button.pri").click()
        assert result.value.status == 200
        saved_case = request(base, "/api/admin/exceptions/" + exception_id, token=admin_token)[1]["case"]
        assert saved_case["orderId"] == "E2E-ORDER-1" and any("Contact draft survives" in t["text"] for t in saved_case["timeline"])
        check("exception search keeps an in-progress contact form and persists the order-linked case", True)

        nav("feedback")
        held_complaint_search = []
        def hold_complaint_search(route):
            if not held_complaint_search: held_complaint_search.append(route)
            else: route.continue_()
        page.route("**/api/admin/complaints?**", hold_complaint_search)
        page.fill("#fbSearch", "CP-NAV00001")
        page.wait_for_timeout(400)  # allow the debounced search to reach the held request
        assert held_complaint_search
        expect(page.locator("#fbItems")).to_contain_text("CP-NAV00001")
        page.locator('#fbItems [data-id="CP-NAV00001"]').click()
        expect(page.locator("#fbDetail")).to_contain_text("Navigation test complaint")
        page.get_by_role("button", name="Internal note").click()
        page.locator("#fbDetail .ex-form textarea").fill("Private navigation test note")
        with page.expect_response(lambda r: "/api/admin/complaints/CP-NAV00001" in r.url and r.request.method == "GET") as refreshed:
            held_complaint_search[0].continue_()
        assert refreshed.value.status == 200
        page.unroute("**/api/admin/complaints?**", hold_complaint_search)
        assert page.locator("#fbDetail .ex-form textarea").input_value() == "Private navigation test note"
        for language in ("fr", "ar", "en"):
            page.click("#adminLangToggle")
            expect(page.locator("html")).to_have_attribute("lang", language)
            assert page.locator("#fbDetail .ex-form textarea").input_value() == "Private navigation test note"
        with page.expect_response(lambda r: "/api/admin/complaints/CP-NAV00001/note" in r.url and r.request.method == "POST") as result:
            page.locator("#fbDetail .ex-form button.pri").click()
        assert result.value.status == 200
        complaint = request(base, "/api/admin/complaints/CP-NAV00001", token=admin_token)[1]["complaint"]
        assert any(e["text"] == "Private navigation test note" for e in complaint["timeline"])
        page.click("#fbTab_moderation")
        reject_card = page.locator('.fb-card[data-order="E2E-RATED-2"][data-kind="store"]')
        expect(reject_card).to_be_visible()
        reject_card.get_by_role("button", name="Reject").click()
        reject_card.locator("textarea").fill("Rating rejection draft")
        held_moderation = []
        def hold_moderation(route):
            held_moderation.append(route)
        page.route("**/api/admin/feedback/moderation?**", hold_moderation)
        page.click("#fbRefresh")
        page.wait_for_timeout(200)
        assert held_moderation
        with page.expect_response(lambda r: "/api/admin/feedback/moderation?" in r.url and r.request.method == "GET"):
            held_moderation[0].continue_()
        page.unroute("**/api/admin/feedback/moderation?**", hold_moderation)
        assert reject_card.locator("textarea").input_value() == "Rating rejection draft"
        for language in ("fr", "ar", "en"):
            page.click("#adminLangToggle")
            expect(page.locator("html")).to_have_attribute("lang", language)
            assert reject_card.locator("textarea").input_value() == "Rating rejection draft"
        with page.expect_response(lambda r: r.url.endswith("/api/admin/feedback/moderation") and r.request.method == "POST") as result:
            reject_card.locator(".ex-form button").click()
        assert result.value.status == 200 and result.value.json()["item"]["commentStatus"] == "rejected"
        expect(reject_card).to_have_count(0)
        card = page.locator('.fb-card[data-order="E2E-RATED-1"][data-kind="store"]')
        expect(card).to_be_visible()
        with page.expect_response(lambda r: r.url.endswith("/api/admin/feedback/moderation") and r.request.method == "POST") as result:
            card.locator("button.pri").click()
        assert result.value.status == 200 and result.value.json()["item"]["commentStatus"] == "published"
        check("complaint search/note and rating moderation persist", True)

        nav("system")
        group = page.locator("#sysBody .sys-group").first
        group.locator("select").select_option("distance")
        group.locator("input[type=number]").first.fill("7")
        for language in ("fr", "ar", "en"):
            page.click("#adminLangToggle")
            expect(page.locator("html")).to_have_attribute("lang", language)
            assert group.locator("input[type=number]").first.input_value() == "7"
        with page.expect_response(lambda r: "/api/admin/settings/" in r.url and r.request.method == "PUT") as result:
            group.locator("button.pri").click()
        assert result.value.status == 200 and dialogs
        groups = request(base, "/api/admin/settings", token=admin_token)[1]["groups"]
        pricing = next(g for g in groups if g["id"] == "delivery_pricing")
        assert pricing["values"]["pricePerKm"] == 7 and pricing["values"]["mode"] == "distance"
        nav("audit")
        expect(page.locator(".sys-row").first).to_be_visible()
        page.fill("#sysFAction", "settings.*")
        for language in ("fr", "ar", "en"):
            page.click("#adminLangToggle")
            expect(page.locator("html")).to_have_attribute("lang", language)
            assert page.locator("#sysFAction").input_value() == "settings.*"
        page.locator("#sysBody .ex-row button.pri").first.click()
        expect(page.locator(".sys-row").first).to_be_visible()
        page.locator(".sys-row").first.click()
        expect(page.locator(".sys-det:not([hidden]) pre").first).to_be_visible()
        page.get_by_role("button", name="Verify integrity").click()
        expect(page.locator("#sysVer.good")).to_be_visible()
        with page.expect_download() as downloaded:
            page.get_by_role("button", name="Export CSV").click()
        assert downloaded.value.suggested_filename == "audit-log.csv"
        assert "settings." in Path(downloaded.value.path()).read_text(encoding="utf-8-sig")
        page.click("#sysTabS")
        page.wait_for_function("() => location.hash === '#/system'")
        page.click("#sysTabA")
        page.wait_for_function("() => location.hash === '#/audit'")
        check("system settings, audit filters/details/integrity and tab/hash synchronization", True)

        # The actual zone editor remains mounted when switching sections. Its
        # map is resized after becoming visible and an unsaved draft survives.
        nav("zones")
        zone = page.frame_locator("#zonesFrame")
        expect(zone.locator("#znList li button").first).to_be_visible()
        zone.locator("#znList li button").first.click()
        expect(zone.locator("#znForm")).to_be_visible()
        zone.locator("#fMax").fill("5.5")
        page.evaluate("() => window.__zoneFrameForTest = document.querySelector('#zonesFrame')")
        page.locator("#sbHome").click()
        page.wait_for_function("() => location.hash === '#/'")
        nav("zones")
        assert page.evaluate("() => window.__zoneFrameForTest === document.querySelector('#zonesFrame')")
        assert zone.locator("#fMax").input_value() == "5.5"
        box = zone.locator("#znMap").bounding_box()
        assert box and box["width"] > 100 and box["height"] > 100
        zone.locator("#znLang").select_option("fr")
        page.wait_for_function("() => document.documentElement.lang === 'fr' && document.documentElement.dir === 'ltr'")
        assert zone.locator("#fMax").input_value() == "5.5"
        zone.locator("#znLang").select_option("en")
        page.wait_for_function("() => document.documentElement.lang === 'en'")
        with page.expect_response(lambda r: "/api/admin/service-zones/" in r.url and r.request.method == "PUT") as result:
            zone.locator("#znSave").click()
        assert result.value.status == 200, result.value.text()
        saved_zone = request(base, "/api/admin/service-zones", token=admin_token)[1]
        assert any(z["maxRoadKm"] == 5.5 for z in saved_zone["zones"])
        zone.locator("#znBack").click()
        page.wait_for_function("() => location.hash === '#/'")
        assert len(context.pages) == 1
        check("zone draft survives navigation, map resizes, language sync, save and Back", True)

        # Owner impersonation stays in the embedded tab, without changing the
        # independent store/restaurant sessions in localStorage.
        nav("storeEnter")
        page.locator("#storeEnterModal input[type=search]").fill("siymon")
        row = page.locator("#storeEnterModal .sen-row").first
        expect(row).to_be_visible()
        row.locator("button").first.click()
        store = page.frame_locator("#storeEnterModal iframe")
        expect(store.locator("#shell")).to_be_visible(timeout=10000)
        store.locator('[data-k="products"]').click()
        expect(store.locator('[data-k="products"]')).to_have_class(re.compile(r"\bon\b"))
        assert page.evaluate("() => sessionStorage.getItem('siymon_store_token')")
        nav("portal")
        assert page.evaluate("() => !sessionStorage.getItem('siymon_store_token')")
        page.locator("#portalModal .sen-row button").last.click()
        portal = page.frame_locator("#portalModal iframe")
        expect(portal.locator("#appPanel")).to_be_visible(timeout=10000)
        portal.locator("#refreshBtn").click()
        assert page.evaluate("() => sessionStorage.getItem('siymon_restaurant_token_v1')")
        page.locator('.sb-theme button[data-set="dark"]').click()
        expect(portal.locator("html")).to_have_attribute("data-theme", "dark")
        assert page.evaluate("() => localStorage.getItem('siymon_store_token')") == "standalone-store-session"
        assert page.evaluate("() => localStorage.getItem('siymon_restaurant_token_v1')") == "standalone-restaurant-session"
        nav("staff")
        assert page.locator("#portalModal iframe").count() == 0
        assert page.evaluate("() => !sessionStorage.getItem('siymon_restaurant_token_v1')")
        check("real store/restaurant applications are embedded and their standalone sessions remain intact", True)

        # Browser history and refresh retain the route; direct URLs use the same
        # router rather than opening independent admin pages.
        nav("promos")
        nav("exceptions")
        page.go_back()
        expect(page.locator("#promosModal.show")).to_be_visible()
        page.go_back()
        expect(page.locator("#staffModal.show")).to_be_visible()
        page.go_forward()
        expect(page.locator("#promosModal.show")).to_be_visible()
        page.reload(wait_until="domcontentloaded")
        expect(page.locator("#promosModal.show")).to_be_visible(timeout=10000)
        for key in ("storeSupport", "exceptions", "feedback", "system", "audit", "zones", "storeEnter", "portal", "staff", "promos", "payments"):
            modal, slug = route_map[key]
            page.goto(base + "/admin/#/" + slug, wait_until="domcontentloaded")
            expect(page.locator(f"#{modal}.show")).to_be_visible(timeout=10000)
            expect(page.locator(f'.sb-item[data-key="{key}"]')).to_have_class(re.compile(r"\bactive\b"))
            assert len(context.pages) == 1 and page.locator(".app-header").is_visible()
        page.goto(base + "/admin/#/menu/meals", wait_until="domcontentloaded")
        expect(page.locator("#menuModal.show")).to_be_visible(timeout=10000)
        expect(page.locator('#sbSubMenu .sb-subitem[data-key="subMeals"]')).to_have_attribute("aria-current", "page")
        expect(page.locator("#sbSubMenu")).to_be_visible()
        page.evaluate("() => window.__shellForTest=[document.querySelector('.app-header'),document.querySelector('#sideNav'),document.querySelector('#adminPages')]")
        check("back/forward, refresh and direct links restore the selected page", True)

        # Hold the first response past the router timeout, retry, and release the
        # old response only after the user has moved elsewhere.
        held, hits = [], []
        pattern = "**/api/admin/exceptions?status=active"
        def delay_first(route):
            hits.append(route.request.url)
            if len(hits) == 1:
                held.append(route)
            else:
                route.continue_()
        page.route(pattern, delay_first)
        page.locator('.sb-item[data-key="exceptions"]').click()
        page.wait_for_function("() => !document.querySelector('#adminPageLoading').hidden")
        page.wait_for_function("() => location.hash === '#/' && document.querySelector('#adminPageLoading').hidden", timeout=11000)
        nav("exceptions")
        assert len(hits) >= 2
        nav("staff")
        held[0].continue_()
        page.wait_for_timeout(500)
        assert page.url.endswith("#/staff") and page.locator("#staffModal.show").is_visible()
        assert not page.locator("#exceptionsModal.show").count()
        page.unroute(pattern, delay_first)
        check("a timed-out load can be retried and its late response cannot hijack navigation", True)

        # Sidebar search/scroll/collapse, themes and all supported directions.
        sc = page.locator("#sbScroll").evaluate("e => ({scroll:e.scrollHeight, height:e.clientHeight, overflow:getComputedStyle(e).overflowY})")
        assert sc["scroll"] > sc["height"] and sc["overflow"] == "auto"
        footer = page.locator(".sb-bottom").bounding_box()
        side = page.locator("#sideNav").bounding_box()
        assert footer and side and footer["y"] + footer["height"] <= side["y"] + side["height"] + 1
        page.locator("#sbToggle").click()
        expect(page.locator("body")).to_have_class(re.compile(r"\bsb-collapsed\b"))
        assert page.locator("#sbLogout").is_visible()
        page.locator("#sbToggle").click()
        page.fill("#sbSearch", "Payment")
        page.press("#sbSearch", "Enter")
        expect(page.locator("#paymentsModal.show")).to_be_visible()
        page.fill("#sbSearch", "")
        page.locator('.sb-theme button[data-set="light"]').click()
        expect(page.locator('.sb-theme button[data-set="light"]')).to_have_attribute("aria-pressed", "true")
        assert page.locator("html").get_attribute("data-theme") != "dark"
        for lang, direction, heading in (("fr", "ltr", "Moyens de paiement"), ("ar", "rtl", "طرق الدفع"), ("en", "ltr", "Payment methods")):
            page.click("#adminLangToggle")
            expect(page.locator("html")).to_have_attribute("lang", lang)
            expect(page.locator("html")).to_have_attribute("dir", direction)
            expect(page.locator("#paymentsModal .sen-head h3")).to_contain_text(heading)
        nav("staff")
        page.locator("#staffModal input[type=text]").fill("Unsubmitted draft")
        page.click("#adminLangToggle")
        expect(page.locator("#staffModal .sen-head h3")).to_have_text("Équipe et rôles")
        assert page.locator("#staffModal input[type=text]").input_value() == "Unsubmitted draft"
        nav("promos")
        page.locator('#promosModal input[maxlength="24"]').fill("DRAFT10")
        page.click("#adminLangToggle")
        expect(page.locator("#promosModal .sen-head h3")).to_have_text("أكواد الخصم")
        assert page.locator('#promosModal input[maxlength="24"]').input_value() == "DRAFT10"
        page.click("#adminLangToggle")  # restore English
        check("scrolling footer, collapse, search, theme and live Arabic/French/English labels without losing drafts", True)

        # Exercise every named destination as a system administrator on a phone,
        # including both embedded applications, while the drawer scrolls independently.
        page.set_viewport_size({"width": 320, "height": 520})
        page.click("#navBurger")
        page.locator("#sbScroll").evaluate("e => { e.scrollTop = e.scrollHeight; }")
        assert page.locator("#sbScroll").evaluate("e => e.scrollTop") > 0
        logout_box = page.locator("#sbLogout").bounding_box()
        assert logout_box and logout_box["y"] >= 0 and logout_box["y"] + logout_box["height"] <= 520
        page.keyboard.press("Escape")
        page.set_viewport_size({"width": 390, "height": 740})
        for key in ("storeSupport", "exceptions", "feedback", "system", "audit", "zones", "storeEnter", "portal", "staff", "promos", "payments"):
            modal, slug = route_map[key]
            page.click("#navBurger")
            page.locator(f'.sb-item[data-key="{key}"]').click()
            expect(page.locator(f"#{modal}.show")).to_be_visible(timeout=10000)
            page.wait_for_function("slug => location.hash === '#/' + slug", arg=slug)
            assert "sb-open" not in (page.locator("body").get_attribute("class") or "")
            assert page.locator(".app-header").is_visible() and len(context.pages) == 1
            if key == "storeEnter":
                page.locator("#storeEnterModal .sen-row button").first.click()
                expect(page.frame_locator("#storeEnterModal iframe").locator("#shell")).to_be_visible(timeout=10000)
            if key == "portal":
                page.locator("#portalModal .sen-row button").last.click()
                expect(page.frame_locator("#portalModal iframe").locator("#appPanel")).to_be_visible(timeout=10000)
        page.set_viewport_size({"width": 1440, "height": 950})
        page.evaluate("() => window.scrollTo(0, 0)")
        check("all named sections and embedded applications open on mobile; footer stays visible at 320×520", True)

        # Hold the original account's identity response across a logout/login.
        # The perms loader includes Authorization; the sidebar identity request does not.
        admin_session = page.evaluate("() => localStorage.getItem('siymon_admin_token_v2')")
        old_identity_response = []
        def hold_admin_identity(route):
            headers = route.request.headers
            if headers.get("x-admin-token") == admin_session and not headers.get("authorization"):
                old_identity_response.append((route, route.fetch()))
            else:
                route.continue_()
        page.route("**/api/admin/me", hold_admin_identity)
        page.reload()
        page.wait_for_function("() => window.adminPerms && window.adminPerms.perms() && !document.querySelector('#authModal').classList.contains('show')")
        page.wait_for_timeout(200)
        assert old_identity_response
        page.evaluate("() => window.__shellForTest=[document.querySelector('.app-header'),document.querySelector('#sideNav'),document.querySelector('#adminPages')]")

        # Logout and a different staff login on the SAME tab must not expose a
        # previous account's page or cached privileged form contents.
        nav("staff")
        expect(page.locator("#staffModal")).to_contain_text(SUPPORT_EMAIL)
        nav("promos")
        old_staff_response = []
        def hold_staff(route):
            if route.request.method == "GET": old_staff_response.append(route)
            else: route.continue_()
        page.route("**/api/admin/staff", hold_staff)
        nav("staff")
        page.wait_for_timeout(150)
        assert old_staff_response
        old_exception_response, exception_requests = [], []
        def hold_old_exception(route):
            exception_requests.append(route.request.url)
            if len(exception_requests) == 1: old_exception_response.append(route)
            else: route.continue_()
        page.route("**/api/admin/exceptions?status=active", hold_old_exception)
        page.locator('.sb-item[data-key="exceptions"]').click()
        page.wait_for_function("() => !document.querySelector('#adminPageLoading').hidden")
        page.wait_for_timeout(100)
        assert old_exception_response
        page.click("#sbLogout")
        expect(page.locator("#authModal.show")).to_be_visible()
        page.wait_for_function("() => !document.querySelector('#staffModal').children.length")
        assert not page.evaluate("() => localStorage.getItem('siymon_admin_token_v2')")
        page.fill("#loginId", SUPPORT_EMAIL)
        page.fill("#loginPassword", SUPPORT_PASSWORD)
        page.click("#loginBtn")
        page.wait_for_function("() => window.adminPerms && window.adminPerms.perms() && !document.querySelector('#authModal').classList.contains('show')")
        support_token = page.evaluate("() => localStorage.getItem('siymon_admin_token_v2')")
        # The new account can load the same section while the old request hangs.
        expect(page.locator("#exceptionsModal.show")).to_be_visible(timeout=10000)
        expect(page.locator("#sbUserMail")).to_have_text(SUPPORT_EMAIL)
        old_staff_response[0].continue_()
        old_exception_response[0].continue_()
        old_identity_response[0][0].fulfill(response=old_identity_response[0][1])
        page.unroute("**/api/admin/me", hold_admin_identity)
        page.unroute("**/api/admin/staff", hold_staff)
        page.unroute("**/api/admin/exceptions?status=active", hold_old_exception)
        page.wait_for_timeout(300)
        assert page.locator("#staffModal").evaluate("e => e.children.length") == 0
        expect(page.locator("#sbUserMail")).to_have_text(SUPPORT_EMAIL)
        assert "Navigation test exception" not in page.locator("#exItems").inner_text()
        assert all(c["id"] != exception_id for c in request(base, "/api/admin/exceptions?status=active", token=support_token)[1]["cases"])
        assert "*" not in page.evaluate("() => window.adminPerms.perms()")
        restricted_requests = []
        page.on("request", lambda r: restricted_requests.append(r.url))
        for key in ("staff", "promos", "payments", "storeEnter", "portal", "zones", "audit", "system"):
            assert not page.locator(f'.sb-item[data-key="{key}"]').is_visible(), key
            slug = route_map[key][1]
            page.evaluate("slug => { location.hash = '#/' + slug; }", slug)
            page.wait_for_function("() => location.hash === '#/'")
            assert not page.locator(f"#{route_map[key][0]}.show").count()
        nav("storeSupport")
        nav("exceptions")
        nav("feedback")
        for path in ("/api/admin/staff", "/api/admin/promos", "/api/admin/payment-methods", "/api/admin/service-zones", "/api/admin/audit-logs"):
            assert request(base, path, token=support_token)[0] == 403, path
        assert not any("/api/admin/staff" in url or "/api/admin/payment-methods" in url for url in restricted_requests)
        assert request(base, "/api/admin/stores/REST-1/enter", method="POST", body={}, token=support_token)[0] == 403
        check("logout, delayed previous-account response, direct-link guards and server-side restrictions", True)

        # A read-only order supervisor can see the map but cannot edit it.
        status, supervisor, _ = request(base, "/api/admin/staff", method="POST", token=admin_token, body={
            "name": "Read-only supervisor", "email": "supervisor@example.test", "phone": "0699991111",
            "password": "SupervisorTest2026!", "role": "order_supervisor",
        })
        assert status == 200 and supervisor["staff"]["role"] == "order_supervisor"
        page.click("#sbLogout")
        expect(page.locator("#authModal.show")).to_be_visible()
        page.fill("#loginId", "supervisor@example.test")
        page.fill("#loginPassword", "SupervisorTest2026!")
        page.click("#loginBtn")
        page.wait_for_function("() => window.adminPerms && window.adminPerms.perms() && !document.querySelector('#authModal').classList.contains('show')")
        supervisor_token = page.evaluate("() => localStorage.getItem('siymon_admin_token_v2')")
        nav("zones")
        read_only_zone = page.frame_locator("#zonesFrame")
        expect(read_only_zone.locator("#znList li button").first).to_be_visible()
        assert not read_only_zone.locator("#znNew").is_visible()
        read_only_zone.locator("#znList li button").first.click()
        assert not read_only_zone.locator("#znForm").is_visible()
        assert request(base, "/api/admin/service-zones/zone_berrechid", method="PUT", body={"revision": 1}, token=supervisor_token)[0] == 403
        page.click("#sbLogout")
        expect(page.locator("#authModal.show")).to_be_visible()
        page.wait_for_function("() => !document.querySelector('#zonesFrame')")
        page.fill("#loginId", SUPPORT_EMAIL)
        page.fill("#loginPassword", SUPPORT_PASSWORD)
        page.click("#loginBtn")
        page.wait_for_function("() => window.adminPerms && window.adminPerms.perms() && !document.querySelector('#authModal').classList.contains('show')")
        check("read-only supervisor sees zones, server rejects writes, logout removes the embedded frame", True)

        # Smaller screen: the navigation drawer closes after a choice, footer
        # remains available and the content stays inside the same shell.
        page.set_viewport_size({"width": 390, "height": 740})
        page.click("#navBurger")
        expect(page.locator("body")).to_have_class(re.compile(r"\bsb-open\b"))
        assert page.locator("#sbLogout").is_visible()
        page.locator('.sb-item[data-key="storeSupport"]').click()
        expect(page.locator("#storeSupportModal.show")).to_be_visible()
        assert "sb-open" not in (page.locator("body").get_attribute("class") or "")
        assert page.locator(".app-header").is_visible() and len(context.pages) == 1
        page.click("#navBurger")
        page.locator('.sb-item[data-key="exceptions"]').click()
        expect(page.locator("#exceptionsModal.show")).to_be_visible()
        check("mobile drawer, footer and page navigation", True)

        context.close()

        # Repeat an online direct link with the real service worker enabled.
        # A stale v82 cache is planted first, then must be replaced by v83.
        sw = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="allow")
        sw.route("**/leaflet.min.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=js))
        sw.route("**/leaflet.min.css", lambda route: route.fulfill(status=200, content_type="text/css", body=css))
        sw_page = sw.new_page()
        sw_page.on("pageerror", lambda e: errors.append("SW page: " + str(e)))
        sw_page.goto(base + "/admin/admin.css")
        sw_page.evaluate("""async token => {
          localStorage.setItem('siymon_admin_token_v2', token);
          localStorage.setItem('siymon_admin_lang_v1', 'en');
          localStorage.setItem('siymon_admin_sound_v1', '0');
          const c = await caches.open('siymon-cache-v82');
          await c.put('/admin/admin-nav.js?v=20261029', new Response('stale navigation asset'));
        }""", admin_token)
        sw_page.goto(base + "/admin/#/staff", wait_until="domcontentloaded")
        sw_page.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=20000)
        expect(sw_page.locator("#staffModal.show")).to_be_visible(timeout=15000)
        nav_asset = sw_page.evaluate("""async () => {
          await navigator.serviceWorker.ready;
          for (let i = 0; i < 200; i++) {
            const keys = await caches.keys();
            const c = keys.includes('siymon-cache-v83') && await caches.open('siymon-cache-v83');
            const asset = c && await c.match('/admin/admin-nav.js?v=20261029');
            if (!keys.includes('siymon-cache-v82') && asset) return asset.text();
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          throw new Error('Updated service-worker cache did not become ready');
        }""")
        assert "abandoned" in nav_asset and "stale navigation asset" not in nav_asset
        sw_page.evaluate("""async () => {
          const c = await caches.open('siymon-cache-v83');
          await c.put('/admin/', new Response('STALE HTML', {headers: {'Content-Type': 'text/html'}}));
        }""")
        sw_page.reload(wait_until="domcontentloaded")
        expect(sw_page.locator("#staffModal.show")).to_be_visible(timeout=10000)
        sw_page.locator('.sb-item[data-key="storeEnter"]').click()
        sw_page.locator("#storeEnterModal .sen-row button").first.click()
        expect(sw_page.frame_locator("#storeEnterModal iframe").locator("#shell")).to_be_visible(timeout=10000)
        sw.close()
        check("service worker replaces stale assets, serves fresh HTML online and permits the embedded store", True)
        browser.close()
    if errors: print("Browser errors:", errors, flush=True)
    if failed: print("HTTP errors:", failed, flush=True)
    if network_failed: print("Network failures:", network_failed, flush=True)
    check("no unhandled JavaScript/console errors", not errors)
    check("no unexpected HTTP errors", not failed)
    check("no unexpected network failures", not [(url, reason) for url, reason in network_failed if reason != "net::ERR_ABORTED"])
    print("Leaflet:", "real local library" if real_leaflet else "test stub (drawing not verified)", "; tile and external product images stubbed", flush=True)


def main():
    if not (ROOT / "node_modules").is_dir():
        raise SystemExit("Run npm ci before this test")
    with tempfile.TemporaryDirectory(prefix="siymon-admin-navigation-") as tmp:
        proc, base, log = setup_server(tmp)
        try:
            token = seed(base, Path(tmp))
            check_csp(base)
            exercise(base, token)
        except Exception:
            log.flush()
            log.seek(0)
            print("\n--- disposable server log ---\n" + log.read()[-6000:], flush=True)
            raise
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            log.close()
    print("ALL PASS")


if __name__ == "__main__":
    main()
