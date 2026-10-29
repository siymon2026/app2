/* Shared address helpers (UMD): used by the browser (window.SiymonAddr) and by
   the server/tests (require("./lib/addresses")). Pure functions, no I/O.

   Address shape:
   { id, label, city, hood, street, bldg, hint, lat, lng, isDefault, updatedAt } */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SiymonAddr = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MAX_ADDRESSES = 10;
  const strip = (v, n) => String(v == null ? "" : v).replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const num = (v, lim) => {
    if (v === null || v === undefined || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) && Math.abs(x) <= lim ? Math.round(x * 1e6) / 1e6 : null;
  };
  
  /** @returns cleaned address or null when it has no usable location text */
  function sanitizeAddress(a) {
    if (!a || typeof a !== "object") return null;
    const hood = strip(a.hood, 80), street = strip(a.street, 120);
    if (hood.length < 2 && street.length < 2) return null; // empty / invalid
    let lat = num(a.lat, 90), lng = num(a.lng, 180);
    if (lat === null || lng === null) { lat = null; lng = null; }
    const id = strip(a.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
    return {
      id: id || "A" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: strip(a.label, 40),
      city: strip(a.city, 60),
      hood, street,
      bldg: strip(a.bldg, 80),
      hint: strip(a.hint, 200),
      lat, lng,
      isDefault: !!a.isDefault,
      updatedAt: Number.isFinite(Number(a.updatedAt)) ? Number(a.updatedAt) : Date.now(),
    };
  }
  
  /** Clean a list: drop invalid, dedupe by id, cap size, force exactly one default. */
  function sanitizeList(list) {
    const seen = new Set(), out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const a = sanitizeAddress(raw);
      if (!a || seen.has(a.id)) continue;
      seen.add(a.id); out.push(a);
      if (out.length >= MAX_ADDRESSES) break;
    }
    let d = out.findIndex((x) => x.isDefault);
    if (d < 0 && out.length) d = 0;
    out.forEach((x, i) => (x.isDefault = i === d));
    return out;
  }
  
  const sig = (a) => [a.hood, a.street, a.bldg, a.lat, a.lng].map((x) => String(x == null ? "" : x).toLowerCase()).join("|");
  
  /**
   * Merge a guest/local list with the account list without losing or duplicating
   * entries: union by id, then by content signature; newest updatedAt wins.
   * The local default wins when present (it is what the user is using right now).
   */
  function mergeLists(local, remote) {
    const all = [...sanitizeList(remote), ...sanitizeList(local)];
    const byId = new Map(), bySig = new Map();
    for (const a of all) {
      const prev = byId.get(a.id) || bySig.get(sig(a));
      if (prev) {
        if (a.updatedAt > prev.updatedAt) Object.assign(prev, a, { id: prev.id });
        continue;
      }
      byId.set(a.id, a); bySig.set(sig(a), a);
    }
    const merged = Array.from(byId.values()).sort((x, y) => y.updatedAt - x.updatedAt).slice(0, MAX_ADDRESSES);
    const localDef = sanitizeList(local).find((x) => x.isDefault);
    const defId = localDef && merged.find((m) => m.id === localDef.id || sig(m) === sig(localDef));
    merged.forEach((m) => (m.isDefault = defId ? m === defId : false));
    if (!merged.some((m) => m.isDefault) && merged.length) {
      const r = sanitizeList(remote).find((x) => x.isDefault);
      const pick = (r && merged.find((m) => m.id === r.id)) || merged[0];
      pick.isDefault = true;
    }
    return merged;
  }

  return { MAX_ADDRESSES: MAX_ADDRESSES, sanitizeAddress: sanitizeAddress, sanitizeList: sanitizeList, mergeLists: mergeLists };
});
