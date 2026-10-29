const CACHE = "siymon-cache-v82";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/home.css",
  "/app.js",
  "/home-v2.js",
  "/addresses-core.js",
  "/home-feed.js",
  "/search-client.js",
  "/theme-boot.js?v=1",
  "/home-feed.css",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons-driver/icon-192.png",
  "/icons-driver/icon-512.png",
  "/icons-driver/apple-touch-icon.png",
  "/driver/manifest.webmanifest",
  "/admin/index.html",
  "/admin/admin.css",
  "/admin/admin-nav.css",
  "/admin/admin-nav.js",
  "/admin/admin-dispatch.js",
  "/admin/admin-dispatch.css",
  "/admin/admin.js",
  "/admin/admin-stores.js",
  "/admin/admin-stores.css",
  "/admin/admin-enter.js",
  "/admin/admin-staff.js",
  "/admin/admin-promos.js",
  "/admin/admin-payments.js",
  "/admin/admin-perms.js",
  "/admin/admin-refresh.js",
  "/admin/admin-enter.css",
  "/admin/admin-feedback.js?v=1",
  "/admin/admin-feedback.css?v=1",
  "/admin/admin-system.js?v=1",
  "/admin/admin-system.css?v=1",

  "/siymon-page.js?v=36",
  "/page.css?v=36",
  "/subnav.css?v=36",
  "/subnav.js?v=36",
  "/offline.js?v=37",
  "/offline.css?v=37",
  "/notif-logic.js?v=36",
  "/notif-center.css?v=36",
  "/push-prompt.js?v=36",
  "/push-prompt.css?v=36",
  "/chat-ui.css?v=36",
  "/brand.css",

  "/orders/index.html",
  "/orders/orders.css?v=38",
  "/orders/orders.js?v=39",
  "/shared/minimap.js?v=2",
  "/orders/orders-extras.js?v=4",
  "/orders/feedback.js?v=1",
  "/orders/account-extras.js?v=1",
  "/orders/legacy-redirect.js?v=36",

  "/notifications/index.html",
  "/notifications/notifications.js?v=36",


  "/pharmacy/index.html",
  "/pharmacy/pharmacy.css?v=1",
  "/pharmacy/pharmacy.js?v=1",
  "/chat/index.html",
  "/chat/chat.js?v=38",
  "/support/index.html",
  "/support/support.js?v=1",
  "/support/support.css?v=1",

  "/policy/index.html",
  "/policy/policy.css",
  "/policy/policy.js",

  "/driver/index.html",
  "/driver/driver.css",
  "/driver/driver.js",
  "/driver/dispatch.js",
  "/driver/offline-driver.js?v=1",
  "/shared/sync-queue.js?v=1",
  "/driver/extras.js",

  "/restaurant/index.html",
  "/restaurant/restaurant.css",
  "/restaurant/restaurant.js?v=20261023",
  "/sounds/order.mp3"
];


self.addEventListener("message", (event) => {
  const d = event.data;
  if(d === "SKIP_WAITING" || (d && d.type === "SKIP_WAITING")){
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    // cache:"reload" -> always fetch fresh copies, never a 7-day-old one from the HTTP cache
    Promise.all(ASSETS.map(u => cache.add(new Request(u, { cache: "reload" })).catch(() => {})))
  ));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Cross-origin (map tiles, Leaflet CDN, ...): let the browser load them directly.
  // Going through the SW would apply connect-src to them and block the tiles.
  if (new URL(req.url).origin !== self.location.origin) return;
  // Network-first for API
  if (req.url.includes("/api/")) return;
  // Pages (HTML): network-first, so a cached old page can never override a fix; cache only as offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match("/index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=> cached))
  );
});

// -------------------------
// Web Push Notifications
// -------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    try {
      const txt = event.data ? event.data.text() : "";
      data = { title: "siymon", body: txt };
    } catch (_e2) {
      data = { title: "siymon", body: "" };
    }
  }

  const title = String(data.title || "siymon");
  const body = String(data.body || data.message || "");
  const url = String(data.url || "/notifications/");
  const image = data.image ? String(data.image) : null;

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url, id: data.id || null },
  };
  if (image) options.image = image;

event.waitUntil((async ()=>{
  await self.registration.showNotification(title, options);
  // Notify open clients (in-app sound / badge updates)
  try{
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      try{
        client.postMessage({ type: "PUSH_NOTIFICATION", payload: { title, body, url, id: data.id || null, createdAt: data.createdAt || null } });
      }catch(_e){}
    }
  }catch(_e){}
})());
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification && event.notification.data ? event.notification.data : {};
  let url = (data && data.url) ? String(data.url) : "/notifications/";
  // notifications sent before the redirect to standalone pages still carry the old pop-up link
  if (/^\/orders\/?\?(?:.*&)?(open=notifications|notifications=1)/.test(url)) url = "/notifications/";
  else if (/^\/orders\/?\?(?:.*&)?support=1/.test(url)) url = "/chat/";
  event.notification.close();

  event.waitUntil(
    (async () => {
      const target = new URL(url, self.location.origin);
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // already open on exactly that page -> just focus it and let it refresh
      for (const client of allClients) {
        try {
          const cu = new URL(client.url);
          if (cu.origin === target.origin && cu.pathname === target.pathname) {
            await client.focus();
            client.postMessage({ type: "OPEN_NOTIFICATIONS" });
            return;
          }
        } catch (_e) {}
      }
      // an app window is open somewhere else -> take it straight to the page
      for (const client of allClients) {
        try {
          if (new URL(client.url).origin === target.origin && "navigate" in client) {
            const c = await client.focus();
            await (c || client).navigate(target.href);
            return;
          }
        } catch (_e) {}
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
