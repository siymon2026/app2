"use strict";
/* The sandbox cannot run server.js (express and the other dependencies cannot be installed here), so these checks read the source:
   they make sure every path that creates or prices an order goes through the service-zone gate, in the right order, and that the
   routes are registered. They are a regression guard, NOT a substitute for running the server (see docs/SERVICE-ZONES.md). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

const fnBody = (startRe, endRe) => {
  const a = src.search(startRe); assert.ok(a >= 0, "missing " + startRe);
  const rest = src.slice(a); const b = rest.slice(10).search(endRe);
  return b < 0 ? rest : rest.slice(0, b + 10);
};

test("server.js loads the zone library and the zones file", () => {
  assert.match(src, /require\("\.\/lib\/service-zones"\)/);
  assert.match(src, /SERVICE_ZONES_FILE = path\.join\(DATA_DIR, "service_zones\.json"\)/);
});

test("order creation: the zone gate runs BEFORE any pricing, in both flat and distance mode", () => {
  const mw = fnBody(/async function deliveryQuoteMw\(/, /\napp\.post\(\s*"\/api\/orders"/);
  const guardAt = mw.indexOf("zoneGuard("), quoteAt = mw.indexOf("deliveryPricing.quote(");
  const flatExit = mw.indexOf('settings.mode !== "distance") return next()');
  assert.ok(guardAt > 0, "middleware must call zoneGuard");
  assert.ok(quoteAt > guardAt, "zone check precedes road pricing");
  assert.ok(flatExit > guardAt, "the flat-mode early exit must come AFTER the zone check (flat orders are zone-checked too)");
  assert.match(mw, /serviceZones\.failureBody\(g\)/, "refusals carry the localised explanation");
  assert.match(mw, /settings: g\.settings/, "pricing uses the zone's own road limit");
  assert.match(src, /\.\.\.\(req\.serviceZoneSnapshot \? \{ serviceZone: req\.serviceZoneSnapshot \} : \{\}\)/, "the order keeps a snapshot of the zone check");
  const route = src.slice(src.indexOf('"/api/orders",'), src.indexOf('"/api/orders",') + 120);
  assert.match(route, /deliveryQuoteMw/);
});

test("delivery quote endpoint and pharmacy acceptance use the same gate", () => {
  const q = fnBody(/app\.post\("\/api\/delivery\/quote"/, /\n\}\);/);
  assert.ok(q.indexOf("zoneGuard(") > 0 && q.indexOf("zoneGuard(") < q.indexOf("deliveryPricing.quote("));
  const ph = fnBody(/async function pharmacyDeliveryFor\(/, /\nfunction createOrderFromPharmacyRequest/);
  assert.ok(ph.indexOf("zoneGuard(") > 0 && ph.indexOf("zoneGuard(") < ph.indexOf("deliveryPricing.quote("));
  assert.match(src, /serviceZone = null, payment, total \}\) \{/, "pharmacy orders also store the snapshot");
});

test("zone routes are registered with the real admin guard and the audit log", () => {
  const reg = fnBody(/registerServiceZoneRoutes\(app, \{/, /\}\);/);
  for (const k of ["requireAdmin", "readJson", "writeJson", "SERVICE_ZONES_FILE", "appendAuditLog", "adminRoles", "geocodeLimiter"])
    assert.ok(reg.includes(k), "missing dependency " + k);
});

test("no other code path creates customer orders without the gate", () => {
  // Orders are inserted in exactly two places: POST /api/orders (inside the wallet
  // transaction, `store.orders.orders.unshift`) and the pharmacy acceptance
  // (`data.orders.unshift`). Both are covered above.
  const direct = src.match(/(?<!store\.)\bdata\.orders\.unshift\(order\)/g) || [];
  const inWalletTx = src.match(/store\.orders\.orders\.unshift\(order\)/g) || [];
  assert.equal(direct.length, 1, "a new order-creation path must be added to the zone gate and to this test");
  assert.equal(inWalletTx.length, 1, "the /api/orders insert must stay inside the financial transaction");
});
