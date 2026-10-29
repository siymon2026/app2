"use strict";
/** TEST-ONLY: serves /public and a tiny driver API. The rules it applies are the REAL ones
 *  (lib/order-state.js transitions, lib/offline-sync.js queued-update guard and chat de-duplication),
 *  so the browser test exercises the same decisions server.js makes. server.js itself needs express (not installed here). */
const http = require("http"), fs = require("fs"), path = require("path");
const orderState = require("../lib/order-state");
const off = require("../lib/offline-sync");
const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };

const fresh = () => ({
  order: { id: "O1", status: "picked_up", driverId: "D1", total: 55, deliveryFee: 10, items: [], restaurantId: "r1",
    customer: { name: "Zbir", phone: "0611223344", addr: "Hay Salam 12", lat: 33.27, lng: -7.59 }, createdAt: new Date().toISOString() },
  messages: [], transitions: 0, patchCalls: 0, chatPosts: 0, dropNext: "", rejectedQueued: 0,
});
let S = fresh();
const send = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname;
  let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
    let body = {}; try { body = d ? JSON.parse(d) : {}; } catch (_e) {}
    if (p === "/__t/state") return send(res, 200, S);
    if (p === "/__t/reset") { S = fresh(); return send(res, 200, {}); }
    if (p === "/__t/set") { Object.assign(S.order, body); return send(res, 200, S.order); }
    if (p === "/__t/drop") { S.dropNext = body.on || ""; return send(res, 200, {}); }
    if (p === "/api/health") return send(res, 200, { ok: true });
    if (p.startsWith("/api/driver/")) {
      if (p === "/api/driver/me") return send(res, 200, { driver: { id: "D1", name: "Driver", status: "approved", phone: "0600000000" } });
      if (p === "/api/driver/orders" && req.method === "GET") return send(res, 200, { available: [], mine: [{ ...S.order, chatOpen: true, chatUnread: 0 }], stats: {} });
      if (p === "/api/driver/wallet") return send(res, 200, { walletBalance: 100, walletHistory: [], topups: [] });
      if (p === "/api/driver/notifications") return send(res, 200, { notifications: [] });
      if (p === "/api/driver/offers") return send(res, 200, { ok: true, mode: "pull", offers: [] });
      if (p === "/api/driver/orders/O1/chat" && req.method === "GET") return send(res, 200, { ok: true, orderId: "O1", closed: false, messages: S.messages });
      if (p === "/api/driver/orders/O1/chat" && req.method === "POST") {
        S.chatPosts++;
        const dup = off.findDuplicateMessage(S.messages, off.cleanKey(body.clientId));
        let out;
        if (dup) out = { ok: true, message: dup, duplicate: true };
        else {
          const m = { id: "m" + (S.messages.length + 1), from: "driver", text: body.text, createdAt: new Date().toISOString(), ...(off.cleanKey(body.clientId) ? { clientId: off.cleanKey(body.clientId) } : {}) };
          S.messages.push(m); out = { ok: true, message: m };
        }
        if (S.dropNext === "chat") { S.dropNext = ""; return req.socket.destroy(); } // stored, but the answer never arrives
        return send(res, 200, out);
      }
      if (p === "/api/driver/orders/O1" && req.method === "PATCH") {
        S.patchCalls++;
        const qg = off.checkQueuedStatusUpdate(body, Date.now());
        if (!qg.ok) { S.rejectedQueued++; return send(res, qg.status, { error: qg.error, code: qg.code }); }
        const tr = orderState.checkDriverTransition(S.order.status, body.status);
        if (!tr.ok) return send(res, 409, { error: tr.error, code: tr.code });
        if (!tr.noop) { S.order.status = body.status; S.transitions++; }
        if (S.dropNext === "patch") { S.dropNext = ""; return req.socket.destroy(); }
        return send(res, 200, { ok: true, order: S.order });
      }
      return send(res, 200, {});
    }
    // static
    let f = path.normalize(path.join(PUB, p)); if (!f.startsWith(PUB)) return send(res, 403, {});
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) return send(res, 404, { error: "nf" });
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
}).listen(Number(process.env.PORT || 4021));
