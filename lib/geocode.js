"use strict";
/**
 * Reverse geocoding (coordinates -> readable address) done on the SERVER so no
 * keys/URLs live in the frontend. Default provider: OpenStreetMap Nominatim
 * (free, no API key). Override with GEOCODE_URL for a self-hosted/paid provider
 * that speaks the same JSON format.
 *
 * Nominatim usage policy: max ~1 request/second, send an identifying
 * User-Agent, cache results. Set GEOCODE_CONTACT (e.g. an email) in .env.
 *
 * Privacy: coordinates are never logged here and are sent with POST (not in
 * the URL) by the client, so they don't land in access logs.
 */

const DEFAULT_URL = "https://nominatim.openstreetmap.org/reverse";

function validCoords(lat, lng) {
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

const clean = (v) => String(v == null ? "" : v).replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

/** Map a Nominatim `address` object to our fields. */
function parseNominatim(json) {
  const a = (json && json.address) || {};
  const hood = clean(a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential || a.hamlet || "");
  const street = clean(a.road || a.pedestrian || a.footway || a.path || "");
  const city = clean(a.city || a.town || a.village || a.municipality || "");
  const bldg = clean(a.house_number || "");
  return { hood, street, city, bldg, display: clean(json && json.display_name) };
}

/**
 * @param {{lat:number,lng:number,lang?:string,fetchImpl?:Function,url?:string,contact?:string,timeoutMs?:number}} o
 * @returns {Promise<{ok:true,hood:string,street:string,city:string,bldg:string,display:string}|{ok:false,status:number,error:string}>}
 */
async function reverseGeocode(o) {
  if (!validCoords(o.lat, o.lng)) return { ok: false, status: 400, error: "Invalid coordinates" };
  const f = o.fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) return { ok: false, status: 501, error: "Geocoding unavailable" };
  const base = o.url || process.env.GEOCODE_URL || DEFAULT_URL;
  const lang = ["ar", "fr", "en"].includes(o.lang) ? o.lang : "ar";
  const u = new URL(base);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("lat", String(Number(o.lat)));
  u.searchParams.set("lon", String(Number(o.lng)));
  u.searchParams.set("zoom", "18");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("accept-language", lang);
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), o.timeoutMs || 5000) : null;
  try {
    const r = await f(u.toString(), {
      headers: { "User-Agent": `SiymonApp/1.0 (${o.contact || process.env.GEOCODE_CONTACT || "no-contact"})`, Accept: "application/json" },
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r.ok) return { ok: false, status: 502, error: "Geocoding failed" };
    const j = await r.json();
    if (!j || j.error) return { ok: false, status: 404, error: "No address found" };
    const p = parseNominatim(j);
    if (!p.hood && !p.street && !p.city) return { ok: false, status: 404, error: "No address found" };
    return { ok: true, ...p };
  } catch (_e) {
    return { ok: false, status: 502, error: "Geocoding failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Tiny in-memory cache (4 decimals ≈ 11 m) so repeated lookups don't hit the provider. */
function makeCache(max = 500, ttlMs = 6 * 3600 * 1000) {
  const m = new Map();
  const key = (lat, lng, lang) => `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)},${lang}`;
  return {
    get(lat, lng, lang) {
      const k = key(lat, lng, lang), e = m.get(k);
      if (!e) return null;
      if (Date.now() - e.t > ttlMs) { m.delete(k); return null; }
      return e.v;
    },
    set(lat, lng, lang, v) {
      if (m.size >= max) m.delete(m.keys().next().value);
      m.set(key(lat, lng, lang), { t: Date.now(), v });
    },
  };
}

module.exports = { validCoords, parseNominatim, reverseGeocode, makeCache };
