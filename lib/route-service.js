"use strict";
/**
 * Road routing proxy (Wajbatna-style: OSRM by default, optional ORS key).
 * Runs on the server so clients need no extra CSP origins and their IPs aren't
 * sent to the routing provider. Cached + validated; callers fall back to a
 * straight line when this fails.
 */
const rad = Math.PI / 180;
function haversineM(a, b) {
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const okLL = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

function decimate(coords, max) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1), out = [];
  for (let i = 0; i < max - 1; i++) out.push(coords[Math.round(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}

function createRouteService({ fetchImpl, osrmUrl, orsKey, now, timeoutMs, maxKm, ttlMs, maxPoints } = {}) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  const clock = now || (() => Date.now());
  const base = String(osrmUrl || "https://router.project-osrm.org").replace(/\/+$/, "");
  const TTL = ttlMs || 60_000, LIMIT_M = (maxKm || 60) * 1000, MAXP = maxPoints || 300, TMO = timeoutMs || 6000;
  const cache = new Map();

  async function getJson(url, opt) {
    if (!f) throw new Error("fetch_unavailable");
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), TMO);
    try {
      const r = await f(url, { ...opt, signal: ac.signal });
      if (!r.ok) throw new Error("http_" + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  const providers = [];
  if (orsKey) providers.push(async (a, b) => {
    const j = await getJson("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST", headers: { Authorization: orsKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[a.lng, a.lat], [b.lng, b.lat]] }),
    });
    const x = j.features && j.features[0]; if (!x) throw new Error("ors_empty");
    return { coords: x.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: x.properties.summary.distance, duration: x.properties.summary.duration, provider: "ors" };
  });
  providers.push(async (a, b) => {
    const j = await getJson(`${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
    const x = j.routes && j.routes[0]; if (!x) throw new Error("osrm_empty");
    return { coords: x.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: x.distance, duration: x.duration, provider: "osrm" };
  });

  async function route(a, b) {
    if (!okLL(a) || !okLL(b)) { const e = new Error("invalid_coordinates"); e.status = 400; throw e; }
    if (haversineM(a, b) > LIMIT_M) { const e = new Error("too_far"); e.status = 400; throw e; }
    const key = [a.lat, a.lng, b.lat, b.lng].map((v) => v.toFixed(4)).join(",");
    const hit = cache.get(key);
    if (hit && clock() - hit.at < TTL) return hit.value;
    let last;
    for (const p of providers) {
      try {
        const r = await p(a, b);
        if (!r.coords || r.coords.length < 2) throw new Error("empty");
        const value = { coords: decimate(r.coords, MAXP), distance: Math.round(r.distance), duration: Math.round(r.duration), provider: r.provider };
        cache.set(key, { at: clock(), value });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return value;
      } catch (e) { last = e; }
    }
    const err = new Error("route_unavailable"); err.status = 502; err.cause = last; throw err;
  }
  return { route };
}

module.exports = { createRouteService, decimate, haversineM };
