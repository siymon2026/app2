/* =========================================================
   SiyMap — tiny dependency-free slippy map (OSM-style raster tiles).
   Static, auto-fitted view; items drawn on an SVG overlay.
   Tile URL comes from /api/map-config (server-side MAP_TILE_URL).
   If tiles can't load, the overlay still draws (graceful fallback).
   ========================================================= */
(function () {
  "use strict";
  const TS = 256, MAXZ = 18, MINZ = 3;
  const DEFAULT_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  /* ---------- pure math (unit-tested) ---------- */
  const lngX = (lng, z) => ((lng + 180) / 360) * TS * 2 ** z;
  const latY = (lat, z) => {
    const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * 2 ** z;
  };
  /** Largest zoom whose pixel extent of `b` fits inside (W-2pad)x(H-2pad). */
  function fitZoom(b, W, H, pad, maxZ) {
    for (let z = maxZ || MAXZ; z >= MINZ; z--) {
      const w = lngX(b.maxLng, z) - lngX(b.minLng, z), h = latY(b.minLat, z) - latY(b.maxLat, z);
      if (w <= W - 2 * pad && h <= H - 2 * pad) return z;
    }
    return MINZ;
  }
  function viewFor(b, W, H, pad, maxZ) {
    const z = fitZoom(b, W, H, pad, maxZ);
    const cx = (lngX(b.minLng, z) + lngX(b.maxLng, z)) / 2, cy = (latY(b.minLat, z) + latY(b.maxLat, z)) / 2;
    return { z, ox: cx - W / 2, oy: cy - H / 2 };
  }
  function tilesFor(v, W, H) {
    const n = 2 ** v.z, out = [];
    for (let ty = Math.floor(v.oy / TS); ty <= Math.floor((v.oy + H) / TS); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(v.ox / TS); tx <= Math.floor((v.ox + W) / TS); tx++) {
        out.push({ x: ((tx % n) + n) % n, y: ty, left: tx * TS - v.ox, top: ty * TS - v.oy });
      }
    }
    return out;
  }
  function boundsOf(pts, minSpanDeg) {
    let b = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
    pts.forEach((p) => { b.minLat = Math.min(b.minLat, p[0]); b.maxLat = Math.max(b.maxLat, p[0]); b.minLng = Math.min(b.minLng, p[1]); b.maxLng = Math.max(b.maxLng, p[1]); });
    const s = minSpanDeg || 0.0006; // ~65 m: never zoom past street level on identical points
    if (b.maxLat - b.minLat < s) { const c = (b.minLat + b.maxLat) / 2; b.minLat = c - s / 2; b.maxLat = c + s / 2; }
    if (b.maxLng - b.minLng < s) { const c = (b.minLng + b.maxLng) / 2; b.minLng = c - s / 2; b.maxLng = c + s / 2; }
    return b;
  }

  /* ---------- config ---------- */
  let cfgPromise = null;
  function loadConfig() {
    if (!cfgPromise) {
      cfgPromise = fetch("/api/map-config", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((c) => ({ tileUrl: (c && c.tileUrl) || DEFAULT_TILE, attribution: (c && c.attribution) || "© OpenStreetMap contributors", pickup: (c && c.pickup) || null }));
    }
    return cfgPromise;
  }

  /* ---------- styles (injected once; CSP allows inline styles) ---------- */
  (function css() {
    if (document.getElementById("siymap-css")) return;
    const s = document.createElement("style"); s.id = "siymap-css";
    s.textContent = ".sm{position:relative;overflow:hidden;border-radius:10px;background:#e8e6df;direction:ltr;touch-action:manipulation;isolation:isolate}" +
      ".sm-tiles,.sm-ov{position:absolute;inset:0}.sm-tiles img{position:absolute;width:256px;height:256px;max-width:none;user-select:none;-webkit-user-drag:none}" +
      ".sm-dark .sm-tiles{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9)}" +
      ".sm-ov{width:100%;height:100%}.sm-attr{position:absolute;bottom:0;inset-inline-end:0;font:10px/1.4 sans-serif;padding:1px 5px;background:rgba(255,255,255,.75);color:#333;border-top-left-radius:6px;z-index:2}";
    document.head.appendChild(s);
  })();

  const NS = "http://www.w3.org/2000/svg";
  const sv = (tag, a) => { const n = document.createElementNS(NS, tag); for (const k in a || {}) n.setAttribute(k, a[k]); return n; };
  const isDark = (opt) => opt === true || (opt === "auto" && (document.documentElement.getAttribute("data-theme") === "dark" || (!document.documentElement.getAttribute("data-theme") && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches)));

  /**
   * create(container, {height, dark:true|false|"auto", pad, maxZoom})
   * draw(items): items = [
   *   {kind:"poly", pts:[[lat,lng]...], fill, stroke, title}
   *   {kind:"line", from:{lat,lng}, to:{lat,lng}, color, width}   // white border + color
   *   {kind:"dot", lat,lng, r, color, ring, title, onClick, dim}
   *   {kind:"pin", lat,lng, color, title}   (destination)
   *   {kind:"tri", lat,lng, color, title}   (restaurant)
   *   {kind:"sq",  lat,lng, color, title}   (order)
   * ]
   */
  function createBasic(container, opt) {
    opt = opt || {};
    container.textContent = "";
    const root = document.createElement("div"); root.className = "sm"; root.style.height = (opt.height || 220) + "px";
    const tiles = document.createElement("div"); tiles.className = "sm-tiles";
    const ov = sv("svg", { class: "sm-ov", role: "img" });
    const attr = document.createElement("div"); attr.className = "sm-attr";
    root.append(tiles, ov, attr); container.appendChild(root);
    const imgs = new Map(); let last = null, tileUrl = DEFAULT_TILE;
    if (isDark(opt.dark === undefined ? "auto" : opt.dark)) root.classList.add("sm-dark");

    loadConfig().then((c) => { tileUrl = c.tileUrl; attr.textContent = c.attribution; if (last) draw(last); });

    function size() { return { W: Math.max(200, root.clientWidth || container.clientWidth || 320), H: opt.height || 220 }; }

    function draw(items) {
      last = items; const { W, H } = size();
      const pts = [];
      items.forEach((i) => { if (i.kind === "poly") i.pts.forEach((p) => pts.push(p)); else if (i.kind === "line") { pts.push([i.from.lat, i.from.lng], [i.to.lat, i.to.lng]); } else if (Number.isFinite(i.lat)) pts.push([i.lat, i.lng]); });
      ov.setAttribute("viewBox", `0 0 ${W} ${H}`); ov.textContent = "";
      if (!pts.length) return;
      const v = viewFor(boundsOf(pts, opt.minSpan), W, H, opt.pad == null ? 34 : opt.pad, opt.maxZoom || 17);
      const P = (lat, lng) => [lngX(lng, v.z) - v.ox, latY(lat, v.z) - v.oy];

      // tiles (reuse <img> nodes to avoid flicker)
      const want = new Set();
      tilesFor(v, W, H).forEach((t) => {
        const key = `${v.z}/${t.x}/${t.y}`; want.add(key);
        let im = imgs.get(key);
        if (!im) {
          im = document.createElement("img"); im.alt = ""; im.decoding = "async"; im.referrerPolicy = "strict-origin-when-cross-origin"; im.draggable = false;
          im.src = tileUrl.replace("{z}", v.z).replace("{x}", t.x).replace("{y}", t.y);
          im.onerror = () => { im.style.display = "none"; };
          tiles.appendChild(im); imgs.set(key, im);
        }
        im.style.left = Math.round(t.left) + "px"; im.style.top = Math.round(t.top) + "px";
      });
      imgs.forEach((im, k) => { if (!want.has(k)) { im.remove(); imgs.delete(k); } });

      // overlay: polygons, lines, then markers (drivers last = on top)
      const order = { poly: 0, line: 1, sq: 2, tri: 2, pin: 3, dot: 4 };
      items.slice().sort((a, b) => order[a.kind] - order[b.kind]).forEach((i) => {
        let g;
        if (i.kind === "poly") g = sv("polygon", { points: i.pts.map((p) => P(p[0], p[1]).map((n) => n.toFixed(1)).join(",")).join(" "), fill: i.fill || "rgba(63,174,28,.15)", stroke: i.stroke || "rgba(63,174,28,.6)", "stroke-width": 1 });
        else if (i.kind === "line") {
          const a = P(i.from.lat, i.from.lng), b = P(i.to.lat, i.to.lng);
          g = sv("g"); const at = { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "stroke-linecap": "round" };
          g.appendChild(sv("line", { ...at, stroke: "#fff", "stroke-width": (i.width || 5) + 4 }));
          g.appendChild(sv("line", { ...at, stroke: i.color || "#3fae1c", "stroke-width": i.width || 5 }));
        } else {
          const [x, y] = P(i.lat, i.lng); g = sv("g");
          if (i.kind === "dot") {
            g.appendChild(sv("circle", { cx: x, cy: y, r: i.r || 8, fill: i.color || "#3fae1c", stroke: i.ring || "#fff", "stroke-width": 3, opacity: i.dim ? 0.55 : 1 }));
            if (i.inner) g.appendChild(sv("circle", { cx: x, cy: y, r: 3, fill: "#fff" }));
          } else if (i.kind === "pin") {
            g.appendChild(sv("path", { d: `M${x} ${y} l-7 -13 a8 8 0 1 1 14 0 z`, fill: i.color || "#ef4444", stroke: "#fff", "stroke-width": 1.5 }));
            g.appendChild(sv("circle", { cx: x, cy: y - 17, r: 3, fill: "#fff" }));
          } else if (i.kind === "tri") g.appendChild(sv("path", { d: `M${x} ${y - 12} l8 14 h-16 z`, fill: i.color || "#111", stroke: "#fff", "stroke-width": 1.5 }));
          else if (i.kind === "sq") g.appendChild(sv("rect", { x: x - 6, y: y - 6, width: 12, height: 12, rx: 2, fill: i.color || "#ef4444", stroke: "#fff", "stroke-width": 1.5 }));
          if (i.onClick) { g.style.cursor = "pointer"; g.addEventListener("click", i.onClick); }
        }
        if (i.title) { const t = sv("title"); t.textContent = i.title; g.appendChild(t); }
        ov.appendChild(g);
      });
    }
    if (window.ResizeObserver) { let w = 0; new ResizeObserver(() => { const nw = root.clientWidth; if (nw && nw !== w) { w = nw; if (last) draw(last); } }).observe(root); }
    return { draw, el: root };
  }


  /* =========================================================
     Leaflet engine (same approach as the Wajbatna project):
     Leaflet + OSM tiles + live road route (OSRM via /api/route),
     straight line as the fallback. Falls back to createBasic()
     if Leaflet couldn't be loaded.
     ========================================================= */
  const rad = Math.PI / 180;
  const hav = (a, b) => { const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))); };
  const ROUTE_MIN_MOVE_M = 40, ROUTE_MIN_MS = 15000;
  const routeCache = new Map();

  /** Road route between two points via our proxy; resolves null on failure. */
  async function fetchRoute(a, b) {
    const k = [a.lat, a.lng, b.lat, b.lng].map((v) => v.toFixed(4)).join(",");
    if (routeCache.has(k)) return routeCache.get(k);
    try {
      const r = await fetch(`/api/route?fromLat=${a.lat}&fromLng=${a.lng}&toLat=${b.lat}&toLng=${b.lng}`, { credentials: "same-origin" });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.ok || !Array.isArray(j.coords) || j.coords.length < 2) return null;
      routeCache.set(k, j); if (routeCache.size > 60) routeCache.delete(routeCache.keys().next().value);
      return j;
    } catch (_e) { return null; }
  }

  (function lcss() {
    if (document.getElementById("siymap-lf-css")) return;
    const s = document.createElement("style"); s.id = "siymap-lf-css";
    s.textContent = ".sm-lf{border-radius:10px;overflow:hidden;background:#e8e6df;direction:ltr;z-index:0}" +
      ".sm-lf.sm-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9)}" +
      ".sm-ic{background:none!important;border:0!important}.sm-msg{position:absolute;inset-inline:8px;top:8px;z-index:1000;font:12px/1.4 sans-serif;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,.9);color:#7a1f1f;display:none}";
    document.head.appendChild(s);
  })();

  const circleHtml = (bg, inner) => `<div style="width:30px;height:30px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 3px 8px #0006;display:flex;align-items:center;justify-content:center">${inner || ""}</div>`;
  function iconFor(i) {
    const L = window.L;
    if (i.kind === "dot") {
      const r = (i.r || 8) * 2 + 8;
      return L.divIcon({ className: "sm-ic", iconSize: [r, r], iconAnchor: [r / 2, r / 2],
        html: `<div style="width:${r}px;height:${r}px;border-radius:50%;background:${i.color || "#3fae1c"};border:3px solid ${i.ring || "#fff"};box-shadow:0 2px 6px #0006;opacity:${i.dim ? 0.55 : 1};display:flex;align-items:center;justify-content:center">${i.inner ? '<i style="width:7px;height:7px;border-radius:50%;background:#fff"></i>' : ""}</div>` });
    }
    if (i.kind === "pin") return L.divIcon({ className: "sm-ic", iconSize: [34, 34], iconAnchor: [17, 17], html: circleHtml(i.color || "#ef4444", '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>') });
    if (i.kind === "tri") return L.divIcon({ className: "sm-ic", iconSize: [34, 34], iconAnchor: [17, 17], html: circleHtml(i.color || "#111", '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M4 10V9l2-5h12l2 5v1a3 3 0 0 1-2 2.8V20H6v-7.2A3 3 0 0 1 4 10Zm6 10v-5h4v5Z"/></svg>') });
    return L.divIcon({ className: "sm-ic", iconSize: [16, 16], iconAnchor: [8, 8], html: `<div style="width:16px;height:16px;border-radius:3px;background:${i.color || "#ef4444"};border:2px solid #fff;box-shadow:0 2px 6px #0006"></div>` });
  }

  function createLeaflet(container, opt) {
    const L = window.L;
    container.textContent = "";
    const box = document.createElement("div"); box.className = "sm-lf"; box.style.height = (opt.height || 220) + "px"; box.style.position = "relative";
    const msg = document.createElement("div"); msg.className = "sm-msg"; box.appendChild(msg);
    container.appendChild(box);
    if (isDark(opt.dark === undefined ? "auto" : opt.dark)) box.classList.add("sm-dark");
    const interactive = opt.interactive === true;
    const map = L.map(box, {
      zoomControl: interactive, attributionControl: true, scrollWheelZoom: interactive,
      dragging: interactive || !L.Browser.mobile, touchZoom: true, doubleClickZoom: interactive, boxZoom: false, keyboard: false, tap: false,
    }).setView([33.2655, -7.5875], 13);
    const ov = L.layerGroup().addTo(map), rt = L.layerGroup().addTo(map);
    const routes = new Map(); // key -> {cas, line, last, lastAt, busy}
    let fitted = false, errs = 0, lastItems = null;

    loadConfig().then((c) => {
      const layer = L.tileLayer(c.tileUrl, { maxZoom: 19, attribution: c.attribution });
      layer.on("tileerror", () => { if (++errs === 4) { msg.textContent = "تعذّر تحميل الخريطة / Map tiles blocked"; msg.style.display = "block"; } });
      layer.on("tileload", () => { if (errs) { errs = 0; msg.style.display = "none"; } });
      layer.addTo(map);
    });
    const fitTo = (pts) => {
      if (!pts.length) return;
      const b = L.latLngBounds(pts), pad = opt.pad == null ? 34 : opt.pad;
      if (fitted && map.getBounds().pad(-0.05).contains(b)) return; // everything still in view: don't jump around
      map.fitBounds(b, { padding: [pad, pad], maxZoom: opt.maxZoom || 17, animate: false }); fitted = true;
    };
    setTimeout(() => map.invalidateSize(), 250);
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe(box);

    function updateRoute(i) {
      let r = routes.get(i.key);
      const from = i.from, to = i.to;
      if (!r) {
        r = { cas: L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#fff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(rt), last: null, lastAt: 0, busy: false };
        r.line = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: i.color || "#3fae1c", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(rt);
        routes.set(i.key, r);
        if (i.onInfo) { const d = hav(from, to); i.onInfo({ distance: d, duration: d / 8, fallback: true, pending: true }); }
      }
      const moved = !r.last || hav(r.last.from, from) > ROUTE_MIN_MOVE_M || hav(r.last.to, to) > ROUTE_MIN_MOVE_M;
      if (!moved || r.busy || (r.last && Date.now() - r.lastAt < ROUTE_MIN_MS)) return;
      r.busy = true;
      fetchRoute(from, to).then((res) => {
        r.last = { from: { ...from }, to: { ...to } }; r.lastAt = Date.now();
        if (!routes.has(i.key)) return;
        if (res) { r.line.setLatLngs(res.coords); r.cas.setLatLngs(res.coords); i.onInfo && i.onInfo({ distance: res.distance, duration: res.duration, fallback: false }); }
        else { const d = hav(from, to); r.line.setLatLngs([[from.lat, from.lng], [to.lat, to.lng]]); r.cas.setLatLngs([[from.lat, from.lng], [to.lat, to.lng]]); i.onInfo && i.onInfo({ distance: d, duration: d / 8, fallback: true }); }
      }).finally(() => { r.busy = false; });
    }

    function draw(items) {
      lastItems = items; ov.clearLayers();
      const pts = [], keep = new Set();
      items.forEach((i) => {
        if (i.kind === "route") {
          keep.add(i.key); pts.push([i.from.lat, i.from.lng], [i.to.lat, i.to.lng]); updateRoute(i);
        } else if (i.kind === "line") {
          pts.push([i.from.lat, i.from.lng], [i.to.lat, i.to.lng]);
          L.polyline([[i.from.lat, i.from.lng], [i.to.lat, i.to.lng]], { color: "#fff", weight: (i.width || 5) + 4, lineCap: "round" }).addTo(ov);
          L.polyline([[i.from.lat, i.from.lng], [i.to.lat, i.to.lng]], { color: i.color || "#3fae1c", weight: i.width || 5, lineCap: "round" }).addTo(ov);
        } else if (i.kind === "poly") {
          i.pts.forEach((p) => pts.push(p));
          const pg = L.polygon(i.pts, { color: i.stroke || "rgba(63,174,28,.6)", weight: 1, fillColor: i.fill || "rgba(63,174,28,.15)", fillOpacity: 1 }).addTo(ov);
          if (i.title) pg.bindTooltip(i.title);
        } else if (Number.isFinite(i.lat)) {
          pts.push([i.lat, i.lng]);
          const mk = L.marker([i.lat, i.lng], { icon: iconFor(i), title: i.title || "", zIndexOffset: i.kind === "dot" ? 500 : 0, interactive: !!(i.onClick || i.title) }).addTo(ov);
          if (i.onClick) mk.on("click", i.onClick);
        }
      });
      routes.forEach((r, k) => { if (!keep.has(k)) { rt.removeLayer(r.cas); rt.removeLayer(r.line); routes.delete(k); } });
      fitTo(pts);
    }
    return { draw, el: box, map, engine: "leaflet" };
  }

  function create(container, opt) {
    opt = opt || {};
    return window.L && window.L.map ? createLeaflet(container, opt) : createBasic(container, opt);
  }

  window.addEventListener("securitypolicyviolation", (e) => {
    if (/tile|leaflet|cdnjs/i.test(e.blockedURI || "")) console.warn("[SiyMap] blocked by CSP:", e.blockedURI, e.violatedDirective);
  });

  window.SiyMap = { create, loadConfig, fetchRoute, _math: { lngX, latY, fitZoom, viewFor, tilesFor, boundsOf } };
})();
