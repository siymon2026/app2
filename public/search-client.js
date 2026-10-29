/* Siymon customer search: live suggestions under the search box + the shared /api/search client.
   Server does the matching (Arabic letter variants, accents, several words, small typos, all published stores);
   this file only asks, shows price + availability, and opens the store/product. Loaded after home-feed.js. */
(function () {
  "use strict";
  var input = document.getElementById("searchInput");
  var label = input && input.closest("label.search");
  if (!input || !label) return;

  var T = {
    ar: { stores: "المتاجر", items: "المنتجات", na: "غير متوفر", out: "نفد", low: "ينفد قريباً", closed: "المتجر مغلق", none: "لا نتائج مطابقة", all: "عرض كل النتائج", askPh: "اطلبه من الصيدلية", askPhAny: "لم تجد دواءك؟ اطلبه من الصيدلية", unavailable: "غير متاح حالياً" },
    fr: { stores: "Magasins", items: "Produits", na: "Indisponible", out: "Épuisé", low: "Bientôt épuisé", closed: "Magasin fermé", none: "Aucun résultat", all: "Voir tous les résultats", askPh: "Demander à la pharmacie", askPhAny: "Introuvable ? Demandez à la pharmacie", unavailable: "Indisponible" },
    en: { stores: "Stores", items: "Products", na: "Unavailable", out: "Out of stock", low: "Low stock", closed: "Store closed", none: "No matching results", all: "See all results", askPh: "Ask the pharmacy", askPhAny: "Can't find it? Ask the pharmacy", unavailable: "Unavailable" }
  };
  function t(k) { var d = T[window.lang] || T[typeof lang !== "undefined" ? lang : "ar"] || T.ar; return d[k] != null ? d[k] : T.ar[k]; }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tx(o) { return (typeof textForLang === "function" ? textForLang(o) : (o && (o.ar || o.en || o.fr)) || "") || ""; }
  function mny(n) { return typeof money === "function" ? money(n) : String(n); }

  /* ---- shared client: one request at a time per consumer, stale answers dropped ---- */
  var cache = Object.create(null), seq = 0;
  function query(q, limit, signal) {
    q = String(q || "").trim();
    var key = limit + "|" + q;
    if (cache[key] && Date.now() - cache[key].at < 20000) return Promise.resolve(cache[key].v);
    return fetch("/api/search?limit=" + limit + "&q=" + encodeURIComponent(q), { signal: signal })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) { cache[key] = { at: Date.now(), v: d }; return d; });
  }
  function badge(it) {
    if (!it.available) return { cls: "na", text: it.reason === "out_of_stock" ? t("out") : t("na") };
    if (it.lowStock) return { cls: "low", text: t("low") };
    if (it.storeOpen === false) return { cls: "closed", text: t("closed") };
    return null;
  }
  function priceNode(it) {
    var w = h("span", "sg-price");
    w.appendChild(h("b", null, mny(it.unitPrice)));
    if (it.onSale) w.appendChild(h("s", null, mny(it.price)));
    return w;
  }
  function askPharmacyUrl(it) { return "/pharmacy/?store=" + encodeURIComponent(it.storeId) + "&q=" + encodeURIComponent(tx(it.name)); }
  window.siymonSearch = { query: query, badge: badge, priceNode: priceNode, askPharmacyUrl: askPharmacyUrl, t: t };

  /* ---- dropdown ---- */
  var box = h("div", "sg-box"); box.id = "sgBox"; box.setAttribute("role", "listbox"); box.hidden = true;
  label.style.position = "relative"; label.appendChild(box);
  input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", "sgBox"); input.setAttribute("aria-autocomplete", "list");
  var rows = [], active = -1, timer = null, ctl = null;

  function close() { box.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; }
  function setActive(i) {
    rows.forEach(function (r, k) { r.el.classList.toggle("on", k === i); r.el.setAttribute("aria-selected", k === i ? "true" : "false"); });
    active = i;
    if (i >= 0) { input.setAttribute("aria-activedescendant", rows[i].el.id); rows[i].el.scrollIntoView({ block: "nearest" }); } else input.removeAttribute("aria-activedescendant");
  }
  function go(row) {
    close();
    if (!row || !window.siymonFeed) return;
    row.open();
  }
  function addRow(parent, el, open) {
    var r = { el: el, open: open };
    el.id = "sg" + rows.length; el.setAttribute("role", "option"); el.setAttribute("aria-selected", "false");
    rows.push(r); parent.appendChild(el);
    el.addEventListener("mousedown", function (e) { e.preventDefault(); });
    el.addEventListener("click", function () { go(r); });
  }

  function render(d) {
    box.replaceChildren(); rows = []; active = -1;
    var ms = d.stores || [], mi = d.items || [];
    if (!ms.length && !mi.length) {
      box.appendChild(h("div", "sg-none", t("none")));
      var ph = phStore();
      if (ph) { var a = h("a", "sg-ask", t("askPhAny")); a.href = "/pharmacy/?store=" + encodeURIComponent(ph.id) + "&q=" + encodeURIComponent(input.value.trim()); box.appendChild(a); }
      box.hidden = false; input.setAttribute("aria-expanded", "true"); return;
    }
    if (ms.length) {
      box.appendChild(h("div", "sg-h", t("stores")));
      ms.slice(0, 3).forEach(function (s) {
        var b = h("button", "sg-row"); b.type = "button";
        b.appendChild(h("span", "sg-ico", "🏪")); var m = h("span", "sg-main"); m.appendChild(h("b", null, tx(s.name))); b.appendChild(m);
        if (!s.isOpen) b.appendChild(h("span", "sg-b closed", t("closed")));
        addRow(box, b, function () { window.siymonFeed.openStore(s.id); });
      });
    }
    if (mi.length) {
      box.appendChild(h("div", "sg-h", t("items")));
      mi.slice(0, 6).forEach(function (it) {
        var b = h("button", "sg-row" + (it.available ? "" : " off")); b.type = "button";
        if (it.img && /^(\/uploads\/|https:\/\/)/.test(it.img)) { var im = h("img", "sg-img"); im.alt = ""; im.loading = "lazy"; im.src = it.img; b.appendChild(im); } else b.appendChild(h("span", "sg-ico", "🛍️"));
        var m = h("span", "sg-main"); m.appendChild(h("b", null, tx(it.name))); m.appendChild(h("small", null, tx(it.storeName))); b.appendChild(m);
        var bd = badge(it); var right = h("span", "sg-r");
        if (it.available) right.appendChild(priceNode(it)); if (bd) right.appendChild(h("span", "sg-b " + bd.cls, bd.text));
        b.appendChild(right);
        addRow(box, b, function () { window.siymonFeed.openStore(it.storeId, it.available ? it.id : undefined); });
      });
    }
    var all = h("button", "sg-all", t("all")); all.type = "button";
    all.addEventListener("mousedown", function (e) { e.preventDefault(); });
    all.addEventListener("click", close); box.appendChild(all);
    box.hidden = false; input.setAttribute("aria-expanded", "true");
  }
  function phStore() { return (typeof RESTAURANTS !== "undefined" ? RESTAURANTS : []).filter(function (r) { return r && r.type === "pharmacy" && r.isActive !== false; })[0] || null; }

  function onInput() {
    clearTimeout(timer);
    var q = input.value.trim();
    if (q.length < 2) { if (ctl) ctl.abort(); close(); return; }
    timer = setTimeout(function () {
      var my = ++seq; if (ctl) ctl.abort(); ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      query(q, 8, ctl && ctl.signal).then(function (d) { if (my === seq && document.activeElement === input) render(d); }).catch(function () { /* keep the full-results panel; suggestions are optional */ });
    }, 180);
  }
  input.addEventListener("input", onInput);
  input.addEventListener("focus", function () { if (input.value.trim().length >= 2 && !rows.length) onInput(); else if (rows.length) { box.hidden = false; input.setAttribute("aria-expanded", "true"); } });
  input.addEventListener("blur", function () { setTimeout(close, 120); });
  input.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(rows.length ? (active + 1) % rows.length : -1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(rows.length ? (active <= 0 ? rows.length - 1 : active - 1) : -1); }
    else if (e.key === "Enter") { if (active >= 0) { e.preventDefault(); go(rows[active]); } else close(); }
    else if (e.key === "Escape") { close(); }
  });
})();
