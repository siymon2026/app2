"use strict";
/** TEST-ONLY: serves /public + the store<->customer chat endpoints using the SAME lib/stores.js message logic as
 *  lib/store-routes.js (appendMessage / messagesAfter / markRead), with switches to simulate a flaky network. */
const http = require("http"), fs = require("fs"), path = require("path");
const S = require("../lib/stores");
const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const conv = { id: "c", orderId: "O1", messages: [] };
let n = 0; const makeId = () => "m" + ++n;
const ctl = { failNext: 0, dropResponseNext: 0, posts: 0 };
const send = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname;
  if (p === "/__t/state") return send(res, 200, { messages: conv.messages, ctl });
  if (p === "/__t/set") { for (const [k, v] of u.searchParams) ctl[k] = Number(v); return send(res, 200, ctl); }
  if (p === "/__t/store-says") { const m = S.newMessage({ id: makeId(), from: "store", text: u.searchParams.get("text") }); S.appendMessage(conv, m); return send(res, 200, m); }
  if (p === "/api/customer/store-chats/O1") {
    if (req.headers.authorization !== "Bearer tok") return send(res, 401, { error: "Unauthorized" });
    if (req.method === "GET") {
      S.markRead(conv, "customer");
      const { messages, reset } = S.messagesAfter(conv, u.searchParams.get("after"));
      return send(res, 200, { ok: true, messages, reset, lastId: conv.messages.length ? conv.messages[conv.messages.length - 1].id : null, store: { id: "g1", name: "بقالة الحي" } });
    }
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      ctl.posts++;
      if (ctl.failNext > 0) { ctl.failNext--; return send(res, 503, { error: "down" }); }
      const b = JSON.parse(d || "{}");
      const m = S.newMessage({ id: makeId(), from: "customer", text: b.text, clientId: b.clientId });
      if (!m) return send(res, 400, { error: "Empty message" });
      const r = S.appendMessage(conv, m);
      if (ctl.dropResponseNext > 0) { ctl.dropResponseNext--; return req.socket.destroy(); } // stored, but the client never hears back
      send(res, 200, { ok: true, message: r.msg, duplicate: r.duplicate });
    });
    return;
  }
  if (p.startsWith("/api/")) return send(res, 200, {});
  let f = path.join(PUB, p); if (p.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(f));
}).listen(4022, "127.0.0.1", () => console.log("chat mock on 4022"));
