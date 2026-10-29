const CACHE = "siymon-cache-v33";
const ASSETS = [
  "/",
  "/index.html",
  "/brand.css",
  "/styles.css",
  "/home.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/admin/index.html",
  "/admin/admin.css",
  "/admin/admin-nav.css",
  "/admin/admin-support.css",
  "/admin/admin-login.css",
  "/admin/admin-orders.css",
  "/admin/admin-customers.css",
  "/admin/admin-notifications.css",
  "/admin/admin-login.js",
  "/admin/admin-support.js",
  "/admin/admin-nav.js",
  "/admin/admin-notifications.js",
  "/admin/admin.js",

  "/orders/index.html",
  "/orders/orders.css",
  "/orders/orders.js",

  "/policy/index.html",
  "/policy/policy.css",
  "/policy/policy.js",

  "/driver/index.html",
  "/driver/driver.css",
  "/driver/driver.js",

  "/restaurant/index.html",
  "/restaurant/restaurant.css",
  "/restaurant/restaurant.js",
  "/sounds/order.mp3"
];


self.addEventListener("message", (event) => {
  const d = event.data;
  if(d === "SKIP_WAITING" || (d && d.type === "SKIP_WAITING")){
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
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
  // Network-first for API
  if (req.url.includes("/api/")) return;
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
  const url = String(data.url || "/orders/?open=notifications");
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
  const url = (data && data.url) ? String(data.url) : "/orders/?open=notifications";
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          if (client && client.url && client.url.includes("/orders")) {
            await client.focus();
            client.postMessage({ type: "OPEN_NOTIFICATIONS" });
            return;
          }
        } catch (_e) {}
      }
      await self.clients.openWindow(url);
    })()
  );
});
