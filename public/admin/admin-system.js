/* System settings center + audit log (admin, spec 19). The SERVER validates, authorises and audits every call
   (lib/system-settings.js, lib/settings-routes.js); the UI only hides what a role cannot use and shows the server's refusal.
   Loaded after admin.js (uses: api, lang, toast, token, showAuth). All server text goes through textContent. */
"use strict";
(function () {
  const T = {
    ar: { title: "إعدادات النظام وسجل التدقيق", tabS: "الإعدادات", tabA: "سجل التدقيق", refresh: "تحديث", close: "إغلاق", save: "حفظ", saved: "تم الحفظ", failed: "تعذّر التنفيذ",
      sure: "تغيير حساس سيُسجَّل في سجل التدقيق. تأكيد؟", none: "لا توجد بيانات", loading: "جارٍ التحميل…", ro: "للعرض فقط (لا تملك صلاحية التعديل)", nochange: "لا تغييرات",
      range: "الحدود", search: "بحث", verify: "فحص سلامة السجل", export: "تصدير CSV", prev: "السابق", next: "التالي", all: "الكل", from: "من", to: "إلى",
      fAction: "الإجراء (مثال settings.*)", fActor: "رقم الفاعل", fQ: "بحث نصي", intact: "السجل سليم", broken: "تلاعب أو فقد في السجل", records: "سجل",
      time: "الوقت", actor: "الفاعل", action: "الإجراء", target: "الهدف", result: "النتيجة", details: "التفاصيل", total: "المجموع",
      g: { delivery_pricing: "سعر التوصيل (لكل كم)", driver_earnings: "أجر السائق", dispatch: "قواعد التوزيع (H3)", exceptions: "مهل التحضير والتنبيه وإعادة التسليم", complaints: "مهل الشكاوى", limits: "حدود الأمان والتشغيل", i18n: "اللغات والنص العام" },
      f: { mode: "النمط", pricePerKm: "سعر الكم", baseFee: "رسوم أساسية", maxKm: "أقصى مسافة (كم)", base: "مبلغ أساسي للتوصيل", perKm: "للسائق عن كل كم", auto: "تعيين تلقائي", ttlSec: "مهلة العرض (ثانية)", rings: "حلقات بحث H3",
        prepDelayMin: "دقائق قبل اعتبار التحضير متأخراً", unassignedMin: "دقائق قبل اعتبار الطلب بلا سائق", maxRedeliveryAttempts: "أقصى محاولات إعادة التسليم", urgentAfterMin: "دقائق قبل رفع الأولوية",
        partyResponseHours: "مهلة رد الطرف (ساعة)", customerReplyHours: "مهلة رد الزبون (ساعة)", adminRateLimitMax: "حد طلبات الإدارة / 15 د", apiRateLimitMax: "حد طلبات API / 15 د", loginMaxAttempts: "محاولات الدخول / 15 د",
        supportedLanguages: "اللغات المدعومة", defaultLanguage: "اللغة الافتراضية", announcement: "إعلان عام" } },
    fr: { title: "Paramètres système et journal d'audit", tabS: "Paramètres", tabA: "Journal d'audit", refresh: "Actualiser", close: "Fermer", save: "Enregistrer", saved: "Enregistré", failed: "Échec",
      sure: "Modification sensible, enregistrée dans le journal d'audit. Confirmer ?", none: "Aucune donnée", loading: "Chargement…", ro: "Lecture seule (pas de droit de modification)", nochange: "Aucun changement",
      range: "Bornes", search: "Chercher", verify: "Vérifier l'intégrité", export: "Exporter CSV", prev: "Précédent", next: "Suivant", all: "Tous", from: "Du", to: "Au",
      fAction: "Action (ex. settings.*)", fActor: "ID acteur", fQ: "Recherche texte", intact: "Journal intact", broken: "Altération ou perte détectée", records: "entrées",
      time: "Heure", actor: "Acteur", action: "Action", target: "Cible", result: "Résultat", details: "Détails", total: "Total",
      g: { delivery_pricing: "Tarif de livraison (par km)", driver_earnings: "Rémunération livreur", dispatch: "Règles de dispatch (H3)", exceptions: "Délais de préparation, alertes, relivraison", complaints: "Délais des réclamations", limits: "Limites de sécurité et d'exploitation", i18n: "Langues et texte global" },
      f: { mode: "Mode", pricePerKm: "Prix par km", baseFee: "Frais de base", maxKm: "Distance max (km)", base: "Base par livraison", perKm: "Par km (livreur)", auto: "Assignation auto", ttlSec: "Délai de l'offre (s)", rings: "Anneaux H3",
        prepDelayMin: "Min avant « préparation en retard »", unassignedMin: "Min avant « sans livreur »", maxRedeliveryAttempts: "Tentatives de relivraison max", urgentAfterMin: "Min avant priorité urgente",
        partyResponseHours: "Délai de réponse partie (h)", customerReplyHours: "Délai réponse client (h)", adminRateLimitMax: "Limite requêtes admin / 15 min", apiRateLimitMax: "Limite requêtes API / 15 min", loginMaxAttempts: "Tentatives de connexion / 15 min",
        supportedLanguages: "Langues prises en charge", defaultLanguage: "Langue par défaut", announcement: "Annonce globale" } },
    en: { title: "System settings & audit log", tabS: "Settings", tabA: "Audit log", refresh: "Refresh", close: "Close", save: "Save", saved: "Saved", failed: "Failed",
      sure: "Sensitive change, recorded in the audit log. Confirm?", none: "No data", loading: "Loading…", ro: "Read-only (you cannot change these)", nochange: "No changes",
      range: "Bounds", search: "Search", verify: "Verify integrity", export: "Export CSV", prev: "Previous", next: "Next", all: "All", from: "From", to: "To",
      fAction: "Action (e.g. settings.*)", fActor: "Actor id", fQ: "Text search", intact: "Log is intact", broken: "Tampering or loss detected", records: "records",
      time: "Time", actor: "Actor", action: "Action", target: "Target", result: "Result", details: "Details", total: "Total",
      g: { delivery_pricing: "Delivery price (per km)", driver_earnings: "Driver pay", dispatch: "Dispatch rules (H3)", exceptions: "Preparation, alert timers, redelivery", complaints: "Complaint deadlines", limits: "Security & operational limits", i18n: "Languages & global text" },
      f: { mode: "Mode", pricePerKm: "Price per km", baseFee: "Base fee", maxKm: "Max distance (km)", base: "Base per delivery", perKm: "Per km (driver)", auto: "Automatic assignment", ttlSec: "Offer timeout (s)", rings: "H3 search rings",
        prepDelayMin: "Minutes before preparation counts as late", unassignedMin: "Minutes before order counts as unassigned", maxRedeliveryAttempts: "Max redelivery attempts", urgentAfterMin: "Minutes before priority becomes urgent",
        partyResponseHours: "Party response deadline (h)", customerReplyHours: "Customer reply deadline (h)", adminRateLimitMax: "Admin requests / 15 min", apiRateLimitMax: "API requests / 15 min", loginMaxAttempts: "Login attempts / 15 min",
        supportedLanguages: "Supported languages", defaultLanguage: "Default language", announcement: "Global announcement" } },
  };
  const ENUM = { mode: { delivery_pricing: ["flat", "distance"], driver_earnings: ["delivery_fee", "formula"], dispatch: ["pull", "offers"] } };
  const LANGS = ["ar", "fr", "en"];
  const L = () => (typeof lang !== "undefined" && T[lang] ? lang : "ar");
  const t = () => T[L()];
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const can = (p) => (window.adminPerms && window.adminPerms.can ? window.adminPerms.can(p) : false);
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(L() === "ar" ? "ar-MA" : L(), { dateStyle: "short", timeStyle: "medium" }); } catch (_e) { return ""; } };
  const errText = (e) => (e && e.body && e.body.error) || (e && e.message) || t().failed;
  const S = { tab: "settings", groups: [], busy: false, page: 0, per: 25, total: 0, loaded: false };

  function hint(msg, ok) { const h = $("sysHint"); if (h) { h.textContent = msg || ""; h.classList.toggle("ok", !!ok); } }

  function build() {
    const m = $("systemModal"); if (!m || m.dataset.built) return; m.dataset.built = "1";
    const card = mk("div", "modal-card ex-card sys-card"); card.setAttribute("role", "dialog"); card.setAttribute("aria-labelledby", "sysTitle");
    const head = mk("div", "ex-head");
    const h3 = mk("h3"); h3.id = "sysTitle";
    const bS = mk("button", "ex-b", ""), bA = mk("button", "ex-b", ""), bR = mk("button", "ex-ib", "↻"), bC = mk("button", "ex-ib", "✕");
    [[bS, "sysTabS"], [bA, "sysTabA"], [bR, "sysRefresh"], [bC, "sysClose"]].forEach(([b, id]) => { b.id = id; b.type = "button"; });
    head.append(h3, bS, bA, bR, bC);
    const body = mk("div", "sys-body"); body.id = "sysBody";
    const h = mk("div", "ex-hint"); h.id = "sysHint"; h.setAttribute("role", "alert");
    card.append(head, body, h); m.appendChild(card);
    bC.addEventListener("click", () => showSystem(false));
    bR.addEventListener("click", () => refresh());
    bS.addEventListener("click", () => {
      S.tab = "settings"; render();
      if (m.classList.contains("show") && window.adminNav && location.hash !== "#/system") window.adminNav.go("system");
    });
    bA.addEventListener("click", () => {
      if (!can("audit.read")) return;
      S.tab = "audit"; render(); if (!S.loaded) loadAudit();
      if (m.classList.contains("show") && window.adminNav && location.hash !== "#/audit") window.adminNav.go("audit");
    });
  }

  function applyText() {
    const x = t(); build();
    $("sysTitle").textContent = x.title; if ($("systemText")) $("systemText").textContent = x.title;
    $("sysTabS").textContent = x.tabS; $("sysTabA").textContent = x.tabA; $("sysRefresh").title = x.refresh; $("sysClose").title = x.close;
    $("sysTabA").hidden = !can("audit.read");
  }

  /* ---------------- settings tab ---------------- */
  async function loadSettings() { const r = await api("/api/admin/settings"); S.groups = r.groups || []; }

  function fieldRows(g) {
    const v = g.values, b = g.bounds || {};
    const rows = [];
    const num = (k) => rows.push({ k, type: "number", val: v[k], bound: b[k] });
    switch (g.id) {
      case "delivery_pricing": rows.push({ k: "mode", type: "enum", val: v.mode }); ["pricePerKm", "baseFee", "maxKm"].forEach(num); break;
      case "driver_earnings": rows.push({ k: "mode", type: "enum", val: v.mode }); ["base", "perKm"].forEach(num); break;
      case "dispatch": rows.push({ k: "mode", type: "enum", val: v.mode }, { k: "auto", type: "bool", val: v.auto }); ["ttlSec", "rings"].forEach(num); break;
      case "exceptions": ["prepDelayMin", "unassignedMin", "maxRedeliveryAttempts", "urgentAfterMin"].forEach(num); break;
      case "complaints": ["partyResponseHours", "customerReplyHours"].forEach(num); break;
      case "limits": ["adminRateLimitMax", "apiRateLimitMax", "loginMaxAttempts"].forEach(num); break;
      case "i18n": rows.push({ k: "supportedLanguages", type: "langs", val: v.supportedLanguages }, { k: "defaultLanguage", type: "deflang", val: v.defaultLanguage }, { k: "announcement", type: "texts", val: v.announcement }); break;
    }
    return rows;
  }

  function groupCard(g) {
    const x = t(), card = mk("section", "sys-group"), rows = fieldRows(g), inputs = {};
    const h = mk("h4", "", x.g[g.id] || g.id); card.appendChild(h);
    if (!g.canWrite) card.appendChild(mk("p", "ex-muted", x.ro));
    const form = mk("div", "ex-form"); form.hidden = false;
    rows.forEach((r) => {
      const lab = mk("label", "ex-f"); lab.appendChild(mk("span", "", (x.f[r.k] || r.k) + (r.bound ? `  (${x.range}: ${r.bound[0]}–${r.bound[1]})` : "")));
      let el;
      if (r.type === "number") { el = mk("input"); el.type = "number"; el.step = "any"; el.value = r.val; if (r.bound) { el.min = r.bound[0]; el.max = r.bound[1]; } inputs[r.k] = { el, get: () => Number(el.value), init: r.val }; }
      else if (r.type === "enum") { el = mk("select"); (ENUM.mode[g.id] || []).forEach((o) => { const op = mk("option", "", o); op.value = o; el.appendChild(op); }); el.value = r.val; inputs[r.k] = { el, get: () => el.value, init: r.val }; }
      else if (r.type === "bool") { el = mk("input"); el.type = "checkbox"; el.checked = !!r.val; inputs[r.k] = { el, get: () => el.checked, init: !!r.val }; }
      else if (r.type === "langs") {
        el = mk("div", "ex-row"); const cbs = LANGS.map((l) => { const w = mk("label", "", " " + l); const c = mk("input"); c.type = "checkbox"; c.value = l; c.checked = r.val.includes(l); w.prepend(c); el.appendChild(w); return c; });
        inputs[r.k] = { el, get: () => cbs.filter((c) => c.checked).map((c) => c.value), init: r.val };
      } else if (r.type === "deflang") { el = mk("select"); LANGS.forEach((l) => { const op = mk("option", "", l); op.value = l; el.appendChild(op); }); el.value = r.val; inputs[r.k] = { el, get: () => el.value, init: r.val }; }
      else if (r.type === "texts") {
        el = mk("div", "ex-form"); const tas = {}; LANGS.forEach((l) => { const ta = mk("textarea"); ta.rows = 2; ta.maxLength = 280; ta.placeholder = l; ta.value = r.val[l] || ""; ta.dir = l === "ar" ? "rtl" : "ltr"; tas[l] = ta; el.appendChild(ta); });
        inputs[r.k] = { el, get: () => { const o = {}; LANGS.forEach((l) => { o[l] = tas[l].value; }); return o; }, init: r.val };
      }
      if (!g.canWrite) el.querySelectorAll ? (el.disabled = true, el.querySelectorAll("input,select,textarea").forEach((n) => { n.disabled = true; })) : null;
      lab.appendChild(el); form.appendChild(lab);
    });
    card.appendChild(form);
    if (g.canWrite) {
      const btn = mk("button", "ex-b pri", x.save); btn.type = "button";
      btn.addEventListener("click", async () => {
        if (S.busy) return;
        const body = {}, lines = [];
        Object.keys(inputs).forEach((k) => { const cur = inputs[k].get(); if (JSON.stringify(cur) !== JSON.stringify(inputs[k].init)) { body[k] = cur; lines.push(`${x.f[k] || k}: ${JSON.stringify(inputs[k].init)} → ${JSON.stringify(cur)}`); } });
        if (!lines.length) return hint(x.nochange);
        if (g.sensitive && !window.confirm(x.sure + "\n\n" + lines.join("\n"))) return;
        S.busy = true; btn.disabled = true; hint(x.loading, true);
        try { await api("/api/admin/settings/" + encodeURIComponent(g.id), { method: "PUT", body: JSON.stringify(body) }); await loadSettings(); render(); hint(x.saved, true); }
        catch (e) { hint(errText(e)); } finally { S.busy = false; btn.disabled = false; }
      });
      card.appendChild(btn);
    }
    return card;
  }

  function renderSettings(box) {
    if (!S.groups.length) return box.appendChild(mk("div", "ex-empty", t().none));
    S.groups.forEach((g) => box.appendChild(groupCard(g)));
  }

  /* ---------------- audit tab ---------------- */
  const filters = () => {
    const qs = new URLSearchParams();
    [["action", "sysFAction"], ["actorId", "sysFActor"], ["result", "sysFResult"], ["q", "sysFQ"], ["from", "sysFFrom"], ["to", "sysFTo"]].forEach(([k, id]) => {
      const el = $(id); let v = el ? el.value.trim() : ""; if (!v) return;
      if ((k === "from" || k === "to") && /^\d{4}-\d{2}-\d{2}$/.test(v)) v += k === "from" ? "T00:00:00Z" : "T23:59:59Z";
      qs.set(k, v);
    });
    return qs;
  };
  async function loadAudit() {
    if (!can("audit.read")) return;
    const qs = filters(); qs.set("limit", S.per); qs.set("offset", S.page * S.per);
    const list = $("sysList"); if (list) list.replaceChildren(mk("div", "ex-empty", t().loading));
    try { const r = await api("/api/admin/audit-logs?" + qs.toString()); S.rows = r.logs || []; S.total = r.total || 0; S.loaded = true; renderAuditList(); hint(""); }
    catch (e) { if (list) list.replaceChildren(mk("div", "ex-empty", errText(e))); hint(errText(e)); }
  }
  function renderAuditList() {
    const x = t(), list = $("sysList"); if (!list) return; list.replaceChildren();
    if (!S.rows || !S.rows.length) { list.appendChild(mk("div", "ex-empty", x.none)); }
    else {
      const tb = mk("table", "sys-table"), th = mk("tr");
      [x.time, x.actor, x.action, x.target, x.result].forEach((c) => th.appendChild(mk("th", "", c))); tb.appendChild(th);
      S.rows.forEach((r) => {
        const tr = mk("tr", "sys-row"); tr.tabIndex = 0;
        [fmt(r.at), `${r.actorType || ""} ${r.actorId || ""}${r.role ? " (" + r.role + ")" : ""}`, r.action || "", r.targetId || r.group || r.path || "", r.result || ""].forEach((c) => tr.appendChild(mk("td", "", c)));
        const det = mk("tr", "sys-det"); det.hidden = true; const td = mk("td"); td.colSpan = 5;
        const pre = mk("pre", "", JSON.stringify(r, null, 2)); td.appendChild(pre); det.appendChild(td);
        const tog = () => { det.hidden = !det.hidden; };
        tr.addEventListener("click", tog); tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tog(); } });
        tb.append(tr, det);
      });
      const wrap = mk("div", "sys-scroll"); wrap.appendChild(tb); list.appendChild(wrap);
    }
    const pages = Math.max(1, Math.ceil(S.total / S.per));
    $("sysPageInfo").textContent = `${x.total}: ${S.total} · ${S.page + 1}/${pages}`;
    $("sysPrev").disabled = S.page <= 0; $("sysNext").disabled = S.page + 1 >= pages;
  }
  function renderAudit(box) {
    const x = t();
    const fl = mk("div", "ex-filters");
    const mkIn = (id, ph, type) => { const i = mk("input"); i.id = id; i.placeholder = ph; if (type) i.type = type; return i; };
    const sel = mk("select"); sel.id = "sysFResult"; [["", x.all], ["ok", "ok"], ["applying", "applying"], ["rejected", "rejected"], ["denied", "denied"], ["failed", "failed"]].forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; sel.appendChild(o); });
    fl.append(mkIn("sysFAction", x.fAction), mkIn("sysFActor", x.fActor), sel, mkIn("sysFFrom", x.from, "date"), mkIn("sysFTo", x.to, "date"), mkIn("sysFQ", x.fQ, "search"));
    const bar = mk("div", "ex-row"), bs = mk("button", "ex-b pri", x.search), bv = mk("button", "ex-b", x.verify), be = mk("button", "ex-b", x.export);
    [bs, bv, be].forEach((b) => { b.type = "button"; bar.appendChild(b); });
    const ver = mk("div", "sys-ver"); ver.id = "sysVer"; ver.setAttribute("role", "status");
    const list = mk("div", "sys-list"); list.id = "sysList";
    const pg = mk("div", "ex-row"), pp = mk("button", "ex-b", x.prev), pn = mk("button", "ex-b", x.next), pi = mk("span", "ex-muted"); pp.id = "sysPrev"; pn.id = "sysNext"; pi.id = "sysPageInfo"; pp.type = pn.type = "button"; pg.append(pp, pi, pn);
    box.append(fl, bar, ver, list, pg);
    bs.addEventListener("click", () => { S.page = 0; loadAudit(); });
    $("sysFQ").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { S.page = 0; loadAudit(); } });
    pp.addEventListener("click", () => { if (S.page > 0) { S.page--; loadAudit(); } });
    pn.addEventListener("click", () => { S.page++; loadAudit(); });
    bv.addEventListener("click", async () => {
      if (S.busy) return; S.busy = true; bv.disabled = true; ver.textContent = x.loading; ver.className = "sys-ver";
      try { const r = await api("/api/admin/audit-logs/verify"), i = r.integrity || {}; ver.textContent = i.ok ? `${x.intact} (${i.count} ${x.records})` : `${x.broken}: ${i.reason || ""} #${i.brokenAt || ""}`; ver.classList.add(i.ok ? "good" : "bad"); }
      catch (e) { ver.textContent = errText(e); ver.classList.add("bad"); } finally { S.busy = false; bv.disabled = false; }
    });
    be.addEventListener("click", async () => {
      if (S.busy) return; S.busy = true; be.disabled = true;
      try {
        const res = await fetch("/api/admin/audit-logs/export.csv?" + filters().toString(), { headers: { "X-Admin-Token": token } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const blob = await res.blob(), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit-log.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } catch (e) { hint(errText(e)); } finally { S.busy = false; be.disabled = false; }
    });
    renderAuditList();
  }

  function render() {
    applyText(); const box = $("sysBody"); box.replaceChildren();
    $("sysTabS").classList.toggle("pri", S.tab === "settings"); $("sysTabA").classList.toggle("pri", S.tab === "audit");
    if (S.tab === "audit" && can("audit.read")) renderAudit(box); else { S.tab = "settings"; renderSettings(box); }
  }
  // Translating the open view must not discard unsaved settings or audit filters.
  function renderTranslated() {
    const old = Array.from($("sysBody").querySelectorAll("input, select, textarea"));
    const focused = old.indexOf(document.activeElement);
    const values = old.map((el) => ({ value: el.value, checked: el.checked }));
    let selection = null;
    if (focused >= 0) { try { selection = [old[focused].selectionStart, old[focused].selectionEnd]; } catch (_e) {} }
    render();
    const fresh = Array.from($("sysBody").querySelectorAll("input, select, textarea"));
    fresh.forEach((el, i) => { if (values[i]) { el.value = values[i].value; if (el.type === "checkbox" || el.type === "radio") el.checked = values[i].checked; } });
    if (fresh[focused]) {
      fresh[focused].focus();
      if (selection && selection[0] != null) { try { fresh[focused].setSelectionRange(...selection); } catch (_e) {} }
    }
  }
  async function refresh() { try { await loadSettings(); render(); if (S.tab === "audit") loadAudit(); hint(""); } catch (e) { hint(errText(e)); } }

  function showSystem(show) { const m = $("systemModal"); m.classList.toggle("show", !!show); }
  window.showSystem = showSystem;

  function init() {
    if (!$("systemModal")) return; applyText();
    const btn = $("systemBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (typeof token === "undefined" || !token) return showAuth(true);
      try { S.tab = "settings"; S.loaded = false; S.page = 0; await loadSettings(); render(); showSystem(true); } catch (e) { if (typeof toast === "function") toast(errText(e)); }
    });
    new MutationObserver(() => { if ($("systemModal").classList.contains("show")) renderTranslated(); else applyText(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  init();
})();
