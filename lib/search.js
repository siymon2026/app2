"use strict";
/**
 * Public product / medicine / store search (pure, no I/O) — unit-tested in tests/search.test.js.
 *
 * Why it exists: the home search only filtered the restaurants' NAMES and, once a store was selected, that single
 * store's items with a plain `includes` (no Arabic letter variants, no accents, no multi-word queries, no typos, no
 * price/availability, no suggestions, and unavailable medicines simply vanished). Here every published store is
 * searched, the text is normalised (Arabic أ/ا ة/ه ى/ي + tashkeel, Latin accents, Arabic digits), every word of the
 * query must match, results are ranked, and each result carries price + availability + store so the UI can show them.
 */
const catalogLib = require("./catalog");

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩", FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function norm(v) {
  let s = String(v == null ? "" : v).toLowerCase();
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");                 // é -> e
  s = s.replace(/[ً-ٰٟۖ-ۭـ]/g, "");         // tashkeel + tatweel
  s = s.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return s.replace(/\s+/g, " ");
}
const words = (s) => (s ? s.split(" ") : []);

/** Levenshtein distance <= 1 (insert/delete/substitute/transpose) — cheap typo tolerance. */
function within1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let d = 0, i0 = -1;
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) { d++; if (d === 1) i0 = i; if (d > 2) return false; }
    if (d === 1) return true;
    return d === 2 && a[i0] === b[i0 + 1] && a[i0 + 1] === b[i0];   // swapped neighbours
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0; while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

/** Score one query token against the words of a field. 0 = no match. */
function tokenScore(tok, ws) {
  let best = 0;
  for (const w of ws) {
    if (w === tok) best = Math.max(best, 100);
    else if (w.startsWith(tok)) best = Math.max(best, 70);
    else if (tok.length >= 3 && w.includes(tok)) best = Math.max(best, 40);
    else if (tok.length >= 4 && w.length >= 4 && within1(tok, w)) best = Math.max(best, 25);
    else if (tok.length >= 5 && w.length > tok.length && within1(tok, w.slice(0, tok.length))) best = Math.max(best, 20);
  }
  return best;
}

const i18nValues = (v) => (v && typeof v === "object" ? [v.ar, v.fr, v.en] : [v]).filter(Boolean);

/**
 * @param {{q:string, items:object[], stores:object[], limit?:number, storeId?:string, now?:Date}} o
 * `stores` must already be the PUBLISHED stores. Items of other stores are ignored. Archived items are never shown;
 * unavailable / out-of-stock items ARE returned (flagged) so a customer sees "not available" instead of "no result".
 */
function search({ q, items, stores, limit = 12, storeId = "", now = new Date() }) {
  const nq = norm(String(q || "").slice(0, 60));
  const toks = words(nq).slice(0, 6);
  if (!toks.length || nq.length < 2) return { query: nq, items: [], stores: [] };
  const byStore = new Map();
  for (const s of stores || []) if (s && catalogLib.isPublic(s)) byStore.set(String(s.id), s);
  limit = Math.max(1, Math.min(30, Math.floor(Number(limit) || 12)));

  const out = [];
  for (const it of items || []) {
    if (!it || it.archived === true) continue;
    const st = byStore.get(String(it.restaurantId || ""));
    if (!st) continue;
    if (storeId && String(st.id) !== String(storeId)) continue;
    const nameWs = words(norm(i18nValues(it.name).join(" ")));
    const extraWs = words(norm([...i18nValues(it.desc), ...i18nValues(it.catLabel), it.cat, it.attrs && it.attrs.brand, it.attrs && it.attrs.generic, it.sku, it.barcode].filter(Boolean).join(" ")));
    const storeWs = words(norm(i18nValues(st.name).join(" ")));
    let total = 0, ok = true;
    for (const t of toks) {
      const a = tokenScore(t, nameWs), b = Math.round(tokenScore(t, extraWs) * 0.5), c = Math.round(tokenScore(t, storeWs) * 0.3);
      const m = Math.max(a, b, c);
      if (!m) { ok = false; break; }
      total += m;
    }
    if (!ok) continue;
    const fullName = norm(i18nValues(it.name).join(" "));
    if (fullName === nq) total += 60; else if (fullName.startsWith(nq)) total += 25;
    const orderable = catalogLib.itemOrderable(it);
    const storeOpen = catalogLib.isOpenNow(st, now);
    if (!orderable) total -= 30;           // still listed, but after the ones the customer can actually order
    if (!storeOpen) total -= 8;
    const unit = catalogLib.unitPrice(it);
    out.push({
      score: total,
      item: {
        id: it.id, name: it.name, img: it.img || "", storeId: st.id, storeName: st.name, storeType: st.type || "restaurant",
        price: Number(it.price) || 0, unitPrice: unit, onSale: unit !== (Number(it.price) || 0),
        available: orderable,
        reason: orderable ? null : it.archived ? "archived" : it.isAvailable === false ? "unavailable" : "out_of_stock",
        lowStock: orderable && it.stock != null && Number(it.stock) <= 5,
        storeOpen,
      },
    });
  }
  out.sort((a, b) => b.score - a.score || Number(b.item.available) - Number(a.item.available) || a.item.unitPrice - b.item.unitPrice);

  const storeHits = [];
  if (!storeId) {
    for (const st of byStore.values()) {
      const ws = words(norm(i18nValues(st.name).join(" ") + " " + (st.city || "") + " " + (st.area || "")));
      let total = 0, ok = true;
      for (const t of toks) { const m = tokenScore(t, ws); if (!m) { ok = false; break; } total += m; }
      if (ok) storeHits.push({ score: total, store: { id: st.id, name: st.name, type: st.type || "restaurant", logo: st.logo || "", isOpen: catalogLib.isOpenNow(st, now) } });
    }
    storeHits.sort((a, b) => b.score - a.score);
  }
  return { query: nq, items: out.slice(0, limit).map((x) => x.item), stores: storeHits.slice(0, 5).map((x) => x.store), totalItems: out.length };
}

module.exports = { norm, within1, search };
