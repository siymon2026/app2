/* Siymon home feed: categories, banners, admin-managed sections, store search.
   Loaded after app.js and home-v2.js. Uses app.js globals: RESTAURANTS, products, lang, money,
   textForLang, openDetail, renderAll, updateOpenStatus, renderCart; home-v2: siymonSelectRestaurant. */
(function () {
  "use strict";
  var HOME = null, HOME_ERR = false, mode = "feed", activeCat = "";
  var $ = function (id) { return document.getElementById(id); };
  var main = document.querySelector("main.wrap");
  if (!main) return;

  var T = {
    ar: { all: "الكل", back: "الرئيسية", open: "مفتوح", closed: "مغلق", paused: "متوقف مؤقتاً", free: "توصيل مجاني", min: "الحد الأدنى", mins: "د",
      none: "لا توجد مطاعم أو متاجر منشورة الآن.", noRes: "لا توجد نتائج مطابقة.", err: "تعذر تحميل الصفحة الرئيسية.", retry: "إعادة المحاولة",
      stores: "المتاجر", dishes: "الأطباق والمنتجات", catRes: "نتائج التصنيف", sr: "بحث", items: "منتج" },
    fr: { all: "Tout", back: "Accueil", open: "Ouvert", closed: "Fermé", paused: "En pause", free: "Livraison gratuite", min: "Minimum", mins: "min",
      none: "Aucun restaurant ou magasin publié.", noRes: "Aucun résultat.", err: "Impossible de charger l’accueil.", retry: "Réessayer",
      stores: "Magasins", dishes: "Plats et produits", catRes: "Résultats", sr: "Rechercher", items: "articles" },
    en: { all: "All", back: "Home", open: "Open", closed: "Closed", paused: "Paused", free: "Free delivery", min: "Min", mins: "min",
      none: "No restaurants or shops are published right now.", noRes: "No matching results.", err: "Couldn’t load the home page.", retry: "Retry",
      stores: "Stores", dishes: "Dishes & products", catRes: "Results", sr: "Search", items: "items" }
  };
  function t(k) { var d = T[lang] || T.ar; return d[k] != null ? d[k] : T.ar[k]; }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tx(o) { return (typeof textForLang === "function" ? textForLang(o) : (o && (o.ar || o.en || o.fr)) || "") || ""; }
  function avatar(name) {
    var ch = (name || "?").trim().charAt(0).toUpperCase().replace(/[<>&"']/g, "");
    return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#5DD62C"/><text x="48" y="62" font-size="44" text-anchor="middle" fill="#fff" font-family="sans-serif">' + ch + "</text></svg>");
  }
  function img(src, cls, alt, fallback) {
    var i = h("img", cls); i.alt = alt || ""; i.loading = "lazy"; i.decoding = "async";
    i.src = src || fallback || ""; if (fallback) i.onerror = function () { i.onerror = null; i.src = fallback; };
    return i;
  }
  function pct(it) { return it.salePrice != null && it.price > 0 ? Math.round((1 - it.salePrice / it.price) * 100) : 0; }
  function storeById(id) { return (RESTAURANTS || []).find(function (r) { return String(r.id) === String(id); }) || null; }

  /* ---------- mode ---------- */
  function setMode(m) {
    mode = m;
    document.body.classList.toggle("feed-mode", m === "feed");
    document.body.classList.toggle("store-mode", m === "store");
  }
  function showFeed() {
    if (mode === "feed") return;
    setMode("feed");
    var si = $("searchInput"); if (si && si.value) { si.value = ""; si.dispatchEvent(new Event("input", { bubbles: true })); }
    render(); window.scrollTo({ top: 0 });
  }
  function showStores() { showFeed(); var a = $("fhStores"); if (a) a.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function openStore(id, itemId) {
    if (!window.siymonSelectRestaurant) return;
    if (!window.siymonSelectRestaurant(String(id))) return; // user declined switching with a non-empty cart
    setMode("store"); window.scrollTo({ top: 0 });
    if (itemId && typeof openDetail === "function" && getProduct(itemId)) openDetail(itemId);
  }
  window.siymonFeed = { showFeed: showFeed, showStores: showStores, openStore: openStore };
  /* connection came back (offline screen closed): reload only what failed, keep the cart and the page as they are */
  window.addEventListener("siymon:online", function () {
    var needCatalog = typeof RESTAURANTS !== "undefined" && !RESTAURANTS.length;
    var p = needCatalog && typeof loadCatalog === "function"
      ? loadCatalog().then(function () { if (typeof renderAll === "function") renderAll(); }).catch(function () {})
      : Promise.resolve();
    p.then(function () { if (HOME_ERR || !HOME) loadHome(); else refreshStores(); });
  });

  /* ---------- builders ---------- */
  function metaRow(s) {
    var m = h("div", "fh-meta");
    m.appendChild(h("span", null, "⏱ " + (s.avgDeliveryMin || 30) + " " + t("mins")));
    var fee = Number(s.deliveryFee || 0);
    m.appendChild(h("span", fee > 0 ? null : "free", fee > 0 ? "🛵 " + money(fee) : t("free")));
    if (Number(s.minOrder) > 0) m.appendChild(h("span", null, t("min") + " " + money(s.minOrder)));
    return m;
  }
  function stateLabel(s) { return s.status === "paused" ? t("paused") : s.isOpen ? t("open") : t("closed"); }
  function storeCard(s) {
    var name = tx(s.name) || String(s.id);
    var c = h("button", "fh-scard" + (s.isOpen ? "" : " closed")); c.type = "button";
    var cv = h("div", "cv"); if (s.cover) cv.appendChild(img(s.cover, null, "", ""));
    cv.appendChild(h("span", "fh-state" + (s.isOpen ? "" : " closed"), stateLabel(s)));
    if (s.offerLabel) cv.appendChild(h("span", "disc", s.offerLabel));
    cv.appendChild(img(s.logo, "lg", name, avatar(name)));
    c.appendChild(cv);
    var bd = h("div", "bd"); bd.appendChild(h("b", null, name));
    bd.appendChild(h("p", null, tx(s.description) || [s.area, s.city].filter(Boolean).join(" · ") || s.address || ""));
    bd.appendChild(metaRow(s)); c.appendChild(bd);
    c.addEventListener("click", function () { openStore(s.id); });
    return c;
  }
  function itemCard(it, tall) {
    var st = it.store || storeById(it.restaurantId) || {}, sname = tx(st.name);
    var c = h("button", "fh-icard " + (tall ? "tall" : "wide") + (st.isOpen === false ? " closed" : "")); c.type = "button";
    var im = h("div", "im"); im.appendChild(img(it.img, "pic", tx(it.name), ""));
    if (st.logo || sname) im.appendChild(img(st.logo, "logo", sname, avatar(sname)));
    var d = pct(it); if (d > 0) im.appendChild(h("span", "disc", "-" + d + "%"));
    var price = it.salePrice != null ? it.salePrice : it.price;
    if (tall) {
      var ov = h("div", "ov"); ov.appendChild(h("span", null, tx(it.name)));
      ov.appendChild(h("small", null, "⏱ " + (st.avgDeliveryMin || 30) + " " + t("mins") + " · " + money(price)));
      im.appendChild(ov); c.appendChild(im);
    } else {
      c.appendChild(im);
      var x = h("div", "tx"); x.appendChild(h("b", null, tx(it.name)));
      var line = h("span"); var p = h("span", "fh-price", money(price)); line.appendChild(p);
      if (it.salePrice != null) line.appendChild(h("s", null, money(it.price)));
      line.appendChild(h("span", null, "  ·  ⏱ " + (st.avgDeliveryMin || 30) + " " + t("mins"))); x.appendChild(line); c.appendChild(x);
    }
    c.setAttribute("aria-label", tx(it.name) + " — " + sname);
    c.addEventListener("click", function () { openStore(it.restaurantId, it.id); });
    return c;
  }
  function section(title, id) {
    var s = h("section", "fh-sec"); if (id) s.id = id; s.appendChild(h("h2", null, title)); return s;
  }
  function note(text, retry) {
    var n = h("div", "fh-note", text);
    if (retry) { var b = h("button", "btn", t("retry")); b.type = "button"; b.addEventListener("click", function () { loadHome(); }); n.appendChild(b); }
    return n;
  }

  /* ---------- render ---------- */
  function visibleStores() { return (RESTAURANTS || []).filter(function (r) { return r && r.isActive !== false; }); }
  function render() {
    var host = $("feedHome");
    if (!host) { host = h("div"); host.id = "feedHome"; var anchor = $("restTitle"); main.insertBefore(host, anchor || null); }
    host.replaceChildren();
    var q = (($("searchInput") || {}).value || "").trim().toLowerCase();
    if (HOME_ERR && !HOME) { host.appendChild(note(t("err"), true)); return; }
    if (!HOME) { for (var i = 0; i < 3; i++) host.appendChild(h("div", "fh-skel")); return; }
    var stores = visibleStores();
    if (!stores.length) { host.appendChild(note(t("none"))); return; }

    if (q) { renderSearch(host, q); return; }
    searchSeq++;

    var cats = (HOME.categories || []).filter(function (c) { return c.kind !== "dish"; });
    if (cats.length) {
      var row = h("div", "fh-row fh-cats"); row.setAttribute("aria-label", "Categories");
      var all = h("button", "fh-chip", t("all")); all.type = "button"; all.setAttribute("aria-pressed", activeCat ? "false" : "true");
      all.addEventListener("click", function () { activeCat = ""; render(); }); row.appendChild(all);
      cats.forEach(function (c) {
        var b = h("button", "fh-chip"); b.type = "button"; b.setAttribute("aria-pressed", activeCat === c.id ? "true" : "false");
        if (c.icon) b.appendChild(img(c.icon, null, "", ""));
        b.appendChild(document.createTextNode(tx(c.name))); b.addEventListener("click", function () { activeCat = activeCat === c.id ? "" : c.id; render(); });
        row.appendChild(b);
      });
      host.appendChild(row);
    }
    if (activeCat) {
      var res = stores.filter(function (s) { return (s.categoryIds || []).indexOf(activeCat) >= 0; });
      var sec = section(t("catRes"), "fhStores"); var list = h("div", "fh-list");
      res.forEach(function (s) { list.appendChild(storeCard(s)); });
      sec.appendChild(res.length ? list : note(t("noRes"))); host.appendChild(sec); return;
    }
    if ((HOME.banners || []).length) {
      var br = h("div", "fh-row fh-banners");
      HOME.banners.forEach(function (b) {
        var s = h("button", "fh-slide"); s.type = "button"; s.appendChild(img(b.image, null, tx(b.title), ""));
        if (tx(b.title)) { var cap = h("div", "cap", tx(b.title)); if (tx(b.subtitle)) cap.appendChild(h("small", null, tx(b.subtitle))); s.appendChild(cap); }
        s.setAttribute("aria-label", tx(b.title) || "offer");
        if (b.storeId && storeById(b.storeId)) s.addEventListener("click", function () { openStore(b.storeId); }); else s.style.cursor = "default";
        br.appendChild(s);
      });
      host.appendChild(br);
    }
    var firstStores = true;
    (HOME.sections || []).forEach(function (sc) {
      var sec = section(tx(sc.title) || "", sc.type === "stores" && firstStores ? "fhStores" : null);
      var hasItems = (sc.items || []).length;
      if (hasItems && sc.type !== "stores") {
        var r = h("div", "fh-row"); sc.items.forEach(function (it) { r.appendChild(itemCard(it, sc.type === "trending")); }); sec.appendChild(r);
      } else if (sc.type === "stores") {
        var l = h("div", "fh-list"); (sc.stores || []).forEach(function (s) { l.appendChild(storeCard(storeById(s.id) || s)); }); sec.appendChild(l); firstStores = false;
      } else {
        var r2 = h("div", "fh-row"); (sc.stores || []).forEach(function (s) { r2.appendChild(storeCard(storeById(s.id) || s)); }); sec.appendChild(r2);
      }
      host.appendChild(sec);
    });
    if (!host.querySelector(".fh-sec")) { // admin hid every section: still show the published stores
      var sec3 = section(t("stores"), "fhStores"), l3 = h("div", "fh-list");
      stores.forEach(function (s) { l3.appendChild(storeCard(s)); }); sec3.appendChild(l3); host.appendChild(sec3);
    }
  }
  var searchSeq = 0;
  function resultCard(it) {
    var S = window.siymonSearch, bd = S.badge(it);
    var c = h("button", "fh-rcard" + (it.available ? "" : " off")); c.type = "button";
    c.appendChild(img(it.img, "pic", tx(it.name), ""));
    var x = h("div", "tx"); x.appendChild(h("b", null, tx(it.name))); x.appendChild(h("small", null, tx(it.storeName)));
    if (it.available) x.appendChild(S.priceNode(it));
    if (!it.available && it.storeType === "pharmacy") { var a = h("a", "ask", S.t("askPh")); a.href = S.askPharmacyUrl(it); a.addEventListener("click", function (e) { e.stopPropagation(); }); x.appendChild(a); }
    c.appendChild(x);
    if (bd) c.appendChild(h("span", "sg-b " + bd.cls, bd.text));
    c.addEventListener("click", function () { openStore(it.storeId, it.available ? it.id : undefined); });
    return c;
  }
  // Search is answered by the server (all published stores, Arabic/accent variants, several words, small typos,
  // price + availability). Stale answers are dropped so fast typing never shows an older query's results.
  function renderSearch(host, q) {
    var my = ++searchSeq;
    if (!window.siymonSearch) { host.appendChild(note(t("noRes"))); return; }
    host.appendChild(h("div", "fh-skel"));
    window.siymonSearch.query(q, 30).then(function (d) {
      if (my !== searchSeq || mode !== "feed") return;
      host.replaceChildren();
      var ms = (d.stores || []).map(function (s) { return storeById(s.id); }).filter(Boolean), mi = d.items || [];
      if (!ms.length && !mi.length) {
        host.appendChild(note(t("noRes")));
        var ph = visibleStores().filter(function (s) { return s.type === "pharmacy"; })[0];
        if (ph) { var ask = h("a", "fh-ask", window.siymonSearch.t("askPhAny")); ask.href = "/pharmacy/?store=" + encodeURIComponent(ph.id) + "&q=" + encodeURIComponent(q); host.appendChild(ask); }
        return;
      }
      if (ms.length) { var a = section(t("stores") + " (" + ms.length + ")"), l = h("div", "fh-list"); ms.forEach(function (s) { l.appendChild(storeCard(s)); }); a.appendChild(l); host.appendChild(a); }
      if (mi.length) { var b2 = section(t("dishes") + " (" + (d.totalItems || mi.length) + ")"); mi.forEach(function (it) { b2.appendChild(resultCard(it)); }); host.appendChild(b2); }
    }).catch(function () { if (my === searchSeq) { host.replaceChildren(); host.appendChild(note(t("err"))); } });
  }

  /* ---------- data ---------- */
  function loadHome() {
    HOME_ERR = false; render();
    return fetch("/api/home").then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (d) { HOME = d; render(); })
      .catch(function () { HOME_ERR = true; render(); });
  }
  function refreshStores() { // keep open/closed state fresh while the page stays open
    fetch("/api/restaurants").then(function (r) { return r.json(); }).then(function (d) {
      if (!Array.isArray(d.restaurants)) return;
      RESTAURANTS.splice(0, RESTAURANTS.length); d.restaurants.forEach(function (x) { RESTAURANTS.push(x); });
      if (typeof updateOpenStatus === "function") updateOpenStatus();
      if (typeof renderCart === "function") renderCart();
      render();
    }).catch(function () { /* keep previous state */ });
  }

  /* ---------- wire up ---------- */
  var back = h("button", "fh-back"); back.type = "button";
  back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var backTxt = h("span", null, t("back")); back.appendChild(backTxt);
  back.addEventListener("click", showFeed); main.insertBefore(back, main.firstChild);

  var lbl = document.querySelector("label.search");
  if (lbl && !lbl.querySelector(".fh-sbtn")) {
    var sb = h("button", "fh-sbtn"); sb.type = "button"; sb.setAttribute("aria-label", t("sr"));
    sb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3a1 1 0 0 1-1.4 1.4l-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>';
    sb.addEventListener("click", function () { var i = $("searchInput"); if (i) i.focus(); });
    lbl.appendChild(sb);
  }
  var si = $("searchInput");
  var rt = null;
  if (si) si.addEventListener("input", function () { if (mode !== "feed") return; clearTimeout(rt); rt = setTimeout(render, si.value.trim() ? 220 : 0); });

  if (typeof renderAll === "function") {
    var _ra = renderAll;
    renderAll = function () { _ra(); backTxt.textContent = t("back"); render(); };
  }
  setMode("feed");
  var wantStore = new URLSearchParams(location.search).get("store");
  loadHome().then(function () { if (wantStore) setTimeout(function () { if (storeById(wantStore)) openStore(wantStore); }, 400); });
  setInterval(refreshStores, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshStores(); });
})();
