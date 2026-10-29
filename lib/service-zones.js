"use strict";
/**
 * Geographic service areas (spec section 18).
 *
 * A service zone is a polygon drawn by an authorised supervisor on the map, with an optional
 * maximum ROAD distance. This module is the single source of truth for "may this order be delivered
 * here?" and is deliberately independent of H3:
 *
 *   - service zone  -> is the delivery address (and the store) inside an area we serve?   (this file)
 *   - road distance -> how far is the real driving route, and is it within the limit?     (route-service + this file)
 *   - H3 rings      -> which drivers do we search for?                                    (hexgrid / dispatch-*, NOT used here)
 *
 * Nothing here imports H3 or the dispatch code, and the dispatch code does not import this file
 * (tests/service-zones.test.js asserts both directions).
 *
 * Fail-closed: no active zone, a missing pin, or an unavailable routing service all REFUSE the order
 * with an explicit reason. A distance is never invented or substituted by a straight line.
 *
 * Geometry is planar on lng/lat, which is exact enough for a city-sized polygon; areas are computed
 * with an equirectangular projection only to reject degenerate or absurd shapes.
 */

const BOUNDS = Object.freeze({
  maxZones: 50,
  minVertices: 3,
  maxVertices: 200,
  maxRoadKm: [1, 60],
  areaKm2: [0.05, 2500],
  nameLen: 80,
  cityLen: 60,
  noteLen: 200,
});

const LANGS = ["ar", "fr", "en"];
const SCHEMA_VERSION = 1;

const okLL = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const round = (n, d) => { const k = 10 ** d; return Math.round((Number(n) + Number.EPSILON) * k) / k; };

/* ------------------------------------------------------------------ geometry */

/** Is (lat,lng) inside the polygon [[lat,lng],...]? Boundary counts as inside. */
function pointInPolygon(lat, lng, poly) {
  if (!okLL(lat, lng) || !Array.isArray(poly) || poly.length < 3) return false;
  const EPS = 1e-9;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    // on the edge -> inside
    const cross = (lng - xi) * (yj - yi) - (lat - yi) * (xj - xi);
    if (Math.abs(cross) <= EPS &&
        lng >= Math.min(xi, xj) - EPS && lng <= Math.max(xi, xj) + EPS &&
        lat >= Math.min(yi, yj) - EPS && lat <= Math.max(yi, yj) + EPS) return true;
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function orient(a, b, c) {
  const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return Math.abs(v) < 1e-14 ? 0 : v > 0 ? 1 : 2;
}
const onSeg = (a, b, c) => b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orient(p1, q1, p2), o2 = orient(p1, q1, q2), o3 = orient(p2, q2, p1), o4 = orient(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSeg(p1, p2, q1)) || (o2 === 0 && onSeg(p1, q2, q1)) || (o3 === 0 && onSeg(p2, p1, q2)) || (o4 === 0 && onSeg(p2, q1, q2));
}

/** True when two non-adjacent edges cross (a "bow-tie" polygon cannot be evaluated reliably). */
function selfIntersects(poly) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i], a2 = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue; // adjacent edges share a vertex
      if (segmentsIntersect(a1, a2, poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

function bboxOf(poly) {
  let s = 90, n = -90, w = 180, e = -180;
  for (const [la, ln] of poly) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, ln); e = Math.max(e, ln); }
  return { south: s, west: w, north: n, east: e };
}

function areaKm2(poly) {
  const lat0 = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const lng0 = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const xy = poly.map(([la, ln]) => [(ln - lng0) * kx, (la - lat0) * ky]);
  let s = 0;
  for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2 / 1e6;
}

/** Regular polygon approximating a circle (used for the seeded starting zone and tests). */
function circlePolygon(center, radiusM, steps = 36) {
  const out = [];
  const kx = 111320 * Math.cos((center.lat * Math.PI) / 180), ky = 110540;
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    out.push([round(center.lat + (radiusM * Math.sin(t)) / ky, 6), round(center.lng + (radiusM * Math.cos(t)) / kx, 6)]);
  }
  return out;
}

/** Validate + normalise a polygon. -> {ok:true, polygon} | {ok:false, code, error}. */
function validatePolygon(input) {
  if (!Array.isArray(input)) return { ok: false, code: "POLYGON_REQUIRED", error: "polygon must be an array of [lat,lng]" };
  let poly = [];
  for (const p of input) {
    const lat = Array.isArray(p) ? Number(p[0]) : Number(p && p.lat);
    const lng = Array.isArray(p) ? Number(p[1]) : Number(p && p.lng);
    if (!okLL(lat, lng)) return { ok: false, code: "POLYGON_INVALID_POINT", error: "polygon contains an invalid coordinate" };
    const pt = [round(lat, 6), round(lng, 6)];
    const prev = poly[poly.length - 1];
    if (prev && prev[0] === pt[0] && prev[1] === pt[1]) continue; // drop consecutive duplicates
    poly.push(pt);
    if (poly.length > BOUNDS.maxVertices + 1) return { ok: false, code: "POLYGON_TOO_LARGE", error: `polygon has more than ${BOUNDS.maxVertices} vertices` };
  }
  if (poly.length > 1 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1]) poly.pop(); // closed ring -> open
  if (poly.length < BOUNDS.minVertices) return { ok: false, code: "POLYGON_TOO_SMALL", error: `polygon needs at least ${BOUNDS.minVertices} distinct points` };
  if (poly.length > BOUNDS.maxVertices) return { ok: false, code: "POLYGON_TOO_LARGE", error: `polygon has more than ${BOUNDS.maxVertices} vertices` };
  if (selfIntersects(poly)) return { ok: false, code: "POLYGON_SELF_INTERSECTS", error: "polygon edges cross each other" };
  const km2 = areaKm2(poly);
  if (km2 < BOUNDS.areaKm2[0]) return { ok: false, code: "POLYGON_AREA_TOO_SMALL", error: `zone area must be at least ${BOUNDS.areaKm2[0]} km²` };
  if (km2 > BOUNDS.areaKm2[1]) return { ok: false, code: "POLYGON_AREA_TOO_LARGE", error: `zone area must be at most ${BOUNDS.areaKm2[1]} km²` };
  return { ok: true, polygon: poly, areaKm2: round(km2, 3) };
}

/* ------------------------------------------------------------------ zone records */

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function cleanName(v) {
  const o = { ar: "", fr: "", en: "" };
  if (v && typeof v === "object") for (const l of LANGS) o[l] = clean(v[l], BOUNDS.nameLen);
  else { const s = clean(v, BOUNDS.nameLen); for (const l of LANGS) o[l] = s; }
  const any = o.ar || o.fr || o.en;
  if (!any) return null;
  for (const l of LANGS) if (!o[l]) o[l] = any;
  return o;
}

/**
 * Validate a create/update body.
 * @param {object} body
 * @param {object|null} existing  current record when updating (omitted fields keep their value)
 * @returns {{ok:true, zone:object}|{ok:false, status:number, code:string, error:string}}
 */
function sanitizeZone(body, existing, { id, now = new Date(), actor = "" } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const prev = existing || null;
  const bad = (code, error) => ({ ok: false, status: 400, code, error });

  const name = b.name !== undefined || !prev ? cleanName(b.name) : prev.name;
  if (!name) return bad("NAME_REQUIRED", "zone name is required");
  const city = b.city !== undefined || !prev ? clean(b.city, BOUNDS.cityLen) : prev.city;
  if (!city) return bad("CITY_REQUIRED", "city is required");

  let polygon, area;
  if (b.polygon !== undefined || !prev) {
    const pv = validatePolygon(b.polygon);
    if (!pv.ok) return bad(pv.code, pv.error);
    polygon = pv.polygon; area = pv.areaKm2;
  } else { polygon = prev.polygon; area = prev.areaKm2 != null ? prev.areaKm2 : round(areaKm2(prev.polygon), 3); }

  let maxRoadKm = prev ? prev.maxRoadKm : null;
  if (b.maxRoadKm !== undefined) {
    if (b.maxRoadKm === null || b.maxRoadKm === "") maxRoadKm = null;
    else {
      const n = Number(b.maxRoadKm);
      if (!Number.isFinite(n) || n < BOUNDS.maxRoadKm[0] || n > BOUNDS.maxRoadKm[1])
        return bad("MAX_ROAD_KM_OUT_OF_RANGE", `maxRoadKm must be between ${BOUNDS.maxRoadKm[0]} and ${BOUNDS.maxRoadKm[1]} (or null for the global limit)`);
      maxRoadKm = round(n, 2);
    }
  }
  const active = b.active !== undefined ? b.active === true || b.active === "true" : prev ? prev.active !== false : true;
  const note = b.note !== undefined ? clean(b.note, BOUNDS.noteLen) : prev ? prev.note || "" : "";
  const iso = now.toISOString();
  return {
    ok: true,
    zone: {
      id: prev ? prev.id : id,
      name, city, active, maxRoadKm, note, polygon, areaKm2: area,
      seeded: false, // any supervisor edit takes ownership of the zone
      createdAt: prev ? prev.createdAt : iso,
      updatedAt: iso,
      updatedBy: String(actor || "").slice(0, 80),
    },
  };
}

/**
 * Starting boundary for a fresh install: a ~7 km circle around central Berrechid. It is a PLACEHOLDER
 * (flagged `seeded:true`) so the platform launches fail-closed to Berrechid; a supervisor is expected to
 * redraw it on the map. It is never written to disk until a supervisor saves something.
 */
const BERRECHID_CENTER = Object.freeze({ lat: 33.2655, lng: -7.5875 });
function defaultZones(now = new Date()) {
  const iso = now.toISOString();
  return [{
    id: "zone_berrechid",
    name: { ar: "برشيد", fr: "Berrechid", en: "Berrechid" },
    city: "Berrechid",
    active: true,
    maxRoadKm: null,
    note: "Starting boundary (about 7 km around the centre). Redraw it on the map.",
    polygon: circlePolygon(BERRECHID_CENTER, 7000, 36),
    areaKm2: round(areaKm2(circlePolygon(BERRECHID_CENTER, 7000, 36)), 3),
    seeded: true,
    createdAt: iso, updatedAt: iso, updatedBy: "system",
  }];
}

/** Read the stored document defensively; fall back to the seeded zone when nothing has been saved. */
function normalizeDoc(raw, now = new Date()) {
  const zones = raw && Array.isArray(raw.zones) ? raw.zones.filter((z) => z && z.id && validatePolygon(z.polygon).ok) : null;
  if (!zones) return { version: SCHEMA_VERSION, revision: 0, zones: defaultZones(now), persisted: false };
  return { version: SCHEMA_VERSION, revision: Number(raw.revision) || 0, zones, persisted: true };
}

/* ------------------------------------------------------------------ evaluation */

function evaluate({ zones, dropoff, pickup = null }) {
  const lat = Number(dropoff && dropoff.lat), lng = Number(dropoff && dropoff.lng);
  if (!okLL(lat, lng)) return { ok: false, status: 422, code: "LOCATION_REQUIRED", reason: "LOCATION_REQUIRED" };
  const active = (zones || []).filter((z) => z && z.active !== false);
  if (!active.length) return { ok: false, status: 422, code: "OUT_OF_SERVICE_AREA", reason: "NO_ACTIVE_ZONES" };
  const here = active.filter((z) => pointInPolygon(lat, lng, z.polygon));
  if (!here.length) return { ok: false, status: 422, code: "OUT_OF_SERVICE_AREA", reason: "OUTSIDE_SERVICE_AREA", cities: [...new Set(active.map((z) => z.city))] };
  const pLat = Number(pickup && pickup.lat), pLng = Number(pickup && pickup.lng);
  if (okLL(pLat, pLng)) {
    // The store must belong to the same zone as the address (a Berrechid store never serves another city's zone).
    const both = here.find((z) => pointInPolygon(pLat, pLng, z.polygon));
    if (!both) return { ok: false, status: 422, code: "OUT_OF_SERVICE_AREA", reason: "STORE_OUTSIDE_ZONE", cities: [...new Set(here.map((z) => z.city))] };
    return { ok: true, zone: both };
  }
  return { ok: true, zone: here[0], storeUnlocated: true }; // legacy store without coordinates: address check only
}

const MESSAGES = {
  LOCATION_REQUIRED: {
    ar: "يرجى تحديد موقع التسليم على الخريطة قبل تأكيد الطلب.",
    fr: "Veuillez placer le point de livraison sur la carte avant de confirmer.",
    en: "Please set the delivery pin on the map before confirming.",
  },
  NO_ACTIVE_ZONES: {
    ar: "خدمة التوصيل غير متاحة حاليًا في أي منطقة.",
    fr: "La livraison n'est actuellement disponible dans aucune zone.",
    en: "Delivery is not currently available in any area.",
  },
  OUTSIDE_SERVICE_AREA: {
    ar: (p) => `عذرًا، عنوان التسليم خارج مناطق الخدمة${p.cities && p.cities.length ? ` (المتاح حاليًا: ${p.cities.join("، ")})` : ""}.`,
    fr: (p) => `Désolé, l'adresse de livraison est hors des zones desservies${p.cities && p.cities.length ? ` (actuellement : ${p.cities.join(", ")})` : ""}.`,
    en: (p) => `Sorry, the delivery address is outside our service areas${p.cities && p.cities.length ? ` (currently: ${p.cities.join(", ")})` : ""}.`,
  },
  STORE_OUTSIDE_ZONE: {
    ar: "هذا المتجر لا يوصّل إلى منطقتك لأنه يقع خارج منطقة الخدمة التي يوجد فيها عنوانك.",
    fr: "Ce commerce ne livre pas votre zone : il se trouve en dehors de la zone de service de votre adresse.",
    en: "This store does not deliver to your area: it is outside the service zone your address is in.",
  },
  ROAD_DISTANCE_EXCEEDED: {
    ar: (p) => `المسافة الطرقية${p.km != null ? ` (${p.km} كم)` : ""} تتجاوز الحد الأقصى المسموح (${p.maxKm} كم).`,
    fr: (p) => `La distance routière${p.km != null ? ` (${p.km} km)` : ""} dépasse le maximum autorisé (${p.maxKm} km).`,
    en: (p) => `The road distance${p.km != null ? ` (${p.km} km)` : ""} exceeds the maximum allowed (${p.maxKm} km).`,
  },
  ROUTING_UNAVAILABLE: {
    ar: "تعذّر حساب المسافة الطرقية الآن. حاول مرة أخرى بعد قليل.",
    fr: "Impossible de calculer la distance routière pour le moment. Réessayez dans un instant.",
    en: "The road distance cannot be calculated right now. Please try again shortly.",
  },
  STORE_LOCATION_MISSING: {
    ar: "موقع المتجر غير مضبوط، لا يمكن حساب المسافة.",
    fr: "La position du commerce n'est pas configurée, la distance ne peut pas être calculée.",
    en: "The store location is not configured, so the distance cannot be calculated.",
  },
};

/** Localised explanation {ar,fr,en} for a reason code. */
function explain(reason, params = {}) {
  const m = MESSAGES[reason];
  if (!m) return null;
  const out = {};
  for (const l of LANGS) out[l] = typeof m[l] === "function" ? m[l](params) : m[l];
  return out;
}

/** Turn a guard/quote failure into the JSON body returned to clients (back-compatible `error` + `code`). */
function failureBody(f) {
  const reason = f.reason || f.code;
  const params = { cities: f.cities, km: f.km, maxKm: f.maxKm };
  const message = explain(reason, params);
  const body = { error: f.code === "OUT_OF_SERVICE_AREA" || f.code === "LOCATION_REQUIRED" ? f.code : f.error || f.code, code: f.code, reason };
  if (message) body.message = message;
  if (f.km != null) body.km = f.km;
  if (f.maxKm != null) body.maxKm = f.maxKm;
  return body;
}

/**
 * The single gate used by quote, order creation and the pharmacy accept flow.
 *
 * @param {object} a
 * @param {object[]} a.zones       stored zones
 * @param {object}   a.settings    delivery-pricing settings ({mode, maxKm, ...})
 * @param {object}   a.store       store with lat/lng
 * @param {object}   a.dropoff     {lat,lng}
 * @param {object}   a.routeService  {route(a,b)} -> {distance(m)} (only used when a road limit applies in flat mode)
 * @returns {Promise<{ok:true, zone, settings, snapshot}|{ok:false, status, code, reason, ...}>}
 *   `settings` is the pricing settings with maxKm replaced by the zone's own limit when it has one.
 */
async function guard({ zones, settings, store, dropoff, routeService, now = new Date() }) {
  const pickup = store ? { lat: Number(store.lat), lng: Number(store.lng) } : null;
  const ev = evaluate({ zones, dropoff, pickup });
  if (!ev.ok) return ev;
  const z = ev.zone;
  const eff = z.maxRoadKm != null ? z.maxRoadKm : settings && settings.mode === "distance" ? settings.maxKm : null;
  const outSettings = settings ? { ...settings, ...(eff != null ? { maxKm: eff } : {}) } : settings;
  const snapshot = {
    zoneId: z.id, zoneName: z.name && (z.name.en || z.name.fr || z.name.ar) || "", city: z.city,
    maxRoadKm: eff != null ? eff : null, checkedAt: now.toISOString(),
  };
  // Distance mode: delivery-pricing.quote() measures the road distance and applies `maxKm` itself.
  // Flat mode: a road limit only applies when the zone defines one, and then we must measure it here.
  if (settings && settings.mode !== "distance" && z.maxRoadKm != null) {
    const p = { lat: Number(store && store.lat), lng: Number(store && store.lng) };
    if (!okLL(p.lat, p.lng)) return { ok: false, status: 422, code: "STORE_LOCATION_MISSING", reason: "STORE_LOCATION_MISSING", error: "Store location is not configured" };
    if (!routeService || typeof routeService.route !== "function")
      return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", reason: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
    let r;
    try { r = await routeService.route(p, { lat: Number(dropoff.lat), lng: Number(dropoff.lng) }); }
    catch (e) {
      if (e && e.message === "too_far") return { ok: false, status: 422, code: "OUT_OF_RANGE", reason: "ROAD_DISTANCE_EXCEEDED", error: "Delivery address is too far", maxKm: z.maxRoadKm };
      return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", reason: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
    }
    const m = Number(r && r.distance);
    if (!Number.isFinite(m) || m <= 0) return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", reason: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
    const km = round(m / 1000, 2);
    snapshot.roadKm = km;
    if (km > z.maxRoadKm) return { ok: false, status: 422, code: "OUT_OF_RANGE", reason: "ROAD_DISTANCE_EXCEEDED", error: "Delivery address is too far", km, maxKm: z.maxRoadKm };
  }
  return { ok: true, zone: z, settings: outSettings, snapshot };
}

/** Public, read-only view of the active zones (no audit fields). */
function publicView(zones) {
  const active = (zones || []).filter((z) => z.active !== false);
  const first = active[0];
  const bb = first ? bboxOf(first.polygon) : null;
  return {
    enforce: true,
    city: first ? first.city : "",
    center: bb ? { lat: round((bb.south + bb.north) / 2, 6), lng: round((bb.west + bb.east) / 2, 6) } : null,
    polygon: first ? first.polygon : null, // back-compat with the first client version (single polygon)
    zones: active.map((z) => ({ id: z.id, name: z.name, city: z.city, polygon: z.polygon, maxRoadKm: z.maxRoadKm, bbox: bboxOf(z.polygon) })),
  };
}

module.exports = {
  BOUNDS, LANGS, BERRECHID_CENTER, SCHEMA_VERSION,
  pointInPolygon, selfIntersects, validatePolygon, areaKm2, bboxOf, circlePolygon,
  sanitizeZone, defaultZones, normalizeDoc,
  evaluate, guard, explain, failureBody, publicView,
};
