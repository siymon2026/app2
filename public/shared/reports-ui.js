/* Shared reports UI (back office + business dashboard). Vanilla JS, no dependencies.
   window.SiymonReports.mount(container, { base, headers(), lang(), onUnauthorized() })
     base      "/api/admin/reports" | "/api/store/reports"
     headers() auth headers for the audience (the SERVER decides what the caller may see; the UI only renders it)
   All server text is inserted with textContent (never innerHTML). Exports are fetched with the auth headers and saved
   as blobs; "PDF" uses the server PDF for fr/en and the printable page (browser "Save as PDF") for Arabic. */
"use strict";
(function () {
  const T = {
    ar: { report: "التقرير", period: "الفترة", from: "من", to: "إلى", gran: "التجميع", day: "يومي", week: "أسبوعي", month: "شهري", store: "المتجر", allStores: "كل المتاجر", driver: "السائق", allDrivers: "كل السائقين",
      status: "الطلبات", delivered: "المسلَّمة", canceled: "الملغاة", refresh: "تحديث", excel: "Excel", csv: "CSV", pdf: "PDF", loading: "جارٍ التحميل…", empty: "لا توجد بيانات في هذه الفترة", retry: "إعادة المحاولة",
      p_today: "اليوم", p_yesterday: "أمس", p_7d: "آخر 7 أيام", p_30d: "آخر 30 يوماً", p_this_month: "هذا الشهر", p_last_month: "الشهر الماضي", p_custom: "فترة مخصّصة",
      page: "صفحة", of: "من", prev: "السابق", next: "التالي", rows: "صفوف", totals: "الإجمالي", truncated: "عُرض جزء من الصفوف. صدّر الملف للحصول على الكل.", noReports: "لا توجد تقارير متاحة لحسابك.",
      reconOk: "كل الفحوص سليمة", reconFail: "توجد مخالفات — راجع الجدول أدناه", exporting: "جارٍ التصدير…", exportFail: "تعذّر التصدير", t429: "طلبات كثيرة، حاول بعد قليل", offline: "لا يوجد اتصال بالخادم", legacy: "طلبات قديمة بلا لقطة مالية",
      printHint: "للعربية يُفتح مربع الطباعة: اختر «حفظ كـ PDF»" },
    fr: { report: "Rapport", period: "Période", from: "Du", to: "Au", gran: "Regroupement", day: "Jour", week: "Semaine", month: "Mois", store: "Commerce", allStores: "Tous les commerces", driver: "Livreur", allDrivers: "Tous les livreurs",
      status: "Commandes", delivered: "Livrées", canceled: "Annulées", refresh: "Actualiser", excel: "Excel", csv: "CSV", pdf: "PDF", loading: "Chargement…", empty: "Aucune donnée sur cette période", retry: "Réessayer",
      p_today: "Aujourd'hui", p_yesterday: "Hier", p_7d: "7 derniers jours", p_30d: "30 derniers jours", p_this_month: "Ce mois", p_last_month: "Mois dernier", p_custom: "Personnalisée",
      page: "Page", of: "sur", prev: "Précédent", next: "Suivant", rows: "lignes", totals: "Total", truncated: "Lignes tronquées. Exportez pour tout obtenir.", noReports: "Aucun rapport disponible pour votre compte.",
      reconOk: "Tous les contrôles sont conformes", reconFail: "Des écarts existent — voir le tableau", exporting: "Export en cours…", exportFail: "Export impossible", t429: "Trop de requêtes, réessayez", offline: "Serveur injoignable", legacy: "Anciennes commandes sans instantané",
      printHint: "" },
    en: { report: "Report", period: "Period", from: "From", to: "To", gran: "Grouping", day: "Daily", week: "Weekly", month: "Monthly", store: "Business", allStores: "All businesses", driver: "Driver", allDrivers: "All drivers",
      status: "Orders", delivered: "Delivered", canceled: "Canceled", refresh: "Refresh", excel: "Excel", csv: "CSV", pdf: "PDF", loading: "Loading…", empty: "No data in this period", retry: "Retry",
      p_today: "Today", p_yesterday: "Yesterday", p_7d: "Last 7 days", p_30d: "Last 30 days", p_this_month: "This month", p_last_month: "Last month", p_custom: "Custom",
      page: "Page", of: "of", prev: "Previous", next: "Next", rows: "rows", totals: "Total", truncated: "Rows truncated. Export to get them all.", noReports: "No reports are available for your account.",
      reconOk: "All checks passed", reconFail: "Discrepancies found — see the table below", exporting: "Exporting…", exportFail: "Export failed", t429: "Too many requests, try again shortly", offline: "Server unreachable", legacy: "Legacy orders without a financial snapshot",
      printHint: "" },
  };
  const PAGE = 25;
  const PRESETS = ["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"];
  const NUM = { money: 1, int: 1, pct: 1, minutes: 1, number: 1 };
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function mount(root, opts) {
    const lang = () => (T[opts.lang && opts.lang()] ? opts.lang() : "ar");
    const t = () => T[lang()];
    const S = { index: null, type: null, preset: "30d", from: "", to: "", gran: "day", storeId: "", driverId: "", status: "delivered", data: null, labels: null, pages: {}, busy: false, err: null, seq: 0 };
    root.replaceChildren();
    root.classList.add("rp-root");
    const bar = mk("div", "rp-bar"), msg = mk("div", "rp-msg"), body = mk("div", "rp-body");
    msg.setAttribute("role", "status");
    root.append(bar, msg, body);

    const say = (text, bad) => { msg.textContent = text || ""; msg.classList.toggle("bad", !!bad); };
    const authHeaders = () => (opts.headers ? opts.headers() : {});
    function qs(extra) {
      const q = new URLSearchParams();
      if (S.preset !== "custom") q.set("preset", S.preset); else { if (S.from) q.set("from", S.from); if (S.to) q.set("to", S.to); }
      const ty = S.index.types.find((x) => x.id === S.type) || {};
      if (ty.gran) q.set("granularity", S.gran);
      if (ty.storeFilter && S.storeId) q.set("storeId", S.storeId);
      if (ty.driverFilter && S.driverId) q.set("driverId", S.driverId);
      if (ty.statusFilter) q.set("status", S.status);
      q.set("lang", lang());
      for (const [k, v] of Object.entries(extra || {})) q.set(k, v);
      return q.toString();
    }
    async function get(path, wantBlob) {
      let r;
      try { r = await fetch(path, { headers: authHeaders() }); } catch (_e) { const e = new Error(t().offline); e.offline = true; throw e; }
      if (r.status === 401 && opts.onUnauthorized) opts.onUnauthorized();
      if (!r.ok) {
        let d = {}; try { d = await r.json(); } catch (_e) {}
        const e = new Error(r.status === 429 ? t().t429 : d.error || "HTTP " + r.status); e.status = r.status; throw e;
      }
      return wantBlob === "text" ? r.text() : wantBlob ? r.blob() : r.json();
    }

    /* ---------------- formatting ---------------- */
    function fmt(c, v) {
      if (v === null || v === undefined || v === "") return "";
      const loc = lang() === "ar" ? "ar-MA-u-nu-latn" : lang();
      if (c.type === "money") return Number(v).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (c.type === "int") return Math.round(Number(v)).toLocaleString(loc);
      if (c.type === "pct") return Number(v).toFixed(1) + "%";
      if (c.type === "minutes") return Number(v).toFixed(1);
      if (c.type === "number") return String(Math.round(Number(v) * 100) / 100);
      if (c.type === "enum") { const m = S.labels && S.labels.enums && S.labels.enums[c.enum]; return m && m[v] != null ? m[v] : String(v); }
      if (c.type === "datetime") { try { return new Date(v).toLocaleString(loc, { dateStyle: "short", timeStyle: "short", timeZone: S.index.tz }); } catch (_e) { return String(v); } }
      return String(v);
    }

    /* ---------------- toolbar ---------------- */
    function field(label, node) { const w = mk("label", "rp-f"); w.append(mk("span", "", label), node); return w; }
    function select(options, cur, on) { const s = mk("select"); for (const [v, l] of options) { const o = mk("option", "", l); o.value = v; s.appendChild(o); } s.value = cur; s.addEventListener("change", () => on(s.value)); return s; }
    function buildBar() {
      bar.replaceChildren();
      const x = t(), ty = S.index.types.find((i) => i.id === S.type) || {};
      const title = (id) => { const i = S.index.types.find((z) => z.id === id); return (i && i.title) || id; };
      bar.appendChild(field(x.report, select(S.index.types.map((i) => [i.id, title(i.id)]), S.type, (v) => { S.type = v; S.pages = {}; S.data = null; buildBar(); load(); })));
      bar.appendChild(field(x.period, select(PRESETS.map((p) => [p, x["p_" + p]]), S.preset, (v) => { S.preset = v; buildBar(); if (v !== "custom") load(); })));
      if (S.preset === "custom") {
        const f = mk("input"); f.type = "date"; f.value = S.from; f.addEventListener("change", () => { S.from = f.value; load(); });
        const o = mk("input"); o.type = "date"; o.value = S.to; o.addEventListener("change", () => { S.to = o.value; load(); });
        bar.append(field(x.from, f), field(x.to, o));
      }
      if (ty.gran) bar.appendChild(field(x.gran, select([["day", x.day], ["week", x.week], ["month", x.month]], S.gran, (v) => { S.gran = v; load(); })));
      if (ty.storeFilter && S.index.stores.length > 1) {
        const nm = (s) => (s.name && typeof s.name === "object" ? s.name[lang()] || s.name.en || s.name.fr || s.name.ar || s.id : s.name || s.id);
        bar.appendChild(field(x.store, select([["", x.allStores], ...S.index.stores.map((s) => [s.id, nm(s)])], S.storeId, (v) => { S.storeId = v; load(); })));
      }
      if (ty.driverFilter && S.index.drivers.length) bar.appendChild(field(x.driver, select([["", x.allDrivers], ...S.index.drivers.map((d) => [d.id, d.name])], S.driverId, (v) => { S.driverId = v; load(); })));
      if (ty.statusFilter) bar.appendChild(field(x.status, select([["delivered", x.delivered], ["canceled", x.canceled]], S.status, (v) => { S.status = v; load(); })));
      const acts = mk("div", "rp-acts");
      const btn = (label, fn) => { const b = mk("button", "rp-b", label); b.type = "button"; b.disabled = S.busy; b.addEventListener("click", fn); acts.appendChild(b); return b; };
      btn(x.refresh, () => load());
      btn(x.excel, () => exportAs("xlsx"));
      btn(x.csv, () => exportAs("csv"));
      btn(x.pdf, () => exportAs("pdf"));
      bar.appendChild(acts);
    }

    /* ---------------- export ---------------- */
    function setBusy(v) { S.busy = v; bar.querySelectorAll(".rp-b").forEach((b) => { b.disabled = v; }); }
    async function exportAs(format) {
      if (S.busy) return; // no double submit (the server also rate-limits)
      setBusy(true); say(t().exporting);
      try {
        if (format === "pdf" && lang() === "ar") {
          const html = await get(opts.base + "/" + S.type + "?" + qs({ format: "html" }), "text");
          printHtml(html); say(t().printHint);
        } else {
          const blob = await get(opts.base + "/" + S.type + "?" + qs({ format }), true);
          const a = document.createElement("a"); const url = URL.createObjectURL(blob);
          a.href = url; a.download = `siymon-${S.type}.${format}`; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000); say("");
        }
      } catch (e) { say(`${t().exportFail}: ${e.message}`, true); } finally { setBusy(false); }
    }
    function printHtml(html) {
      const f = document.createElement("iframe");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
      f.setAttribute("sandbox", "allow-modals allow-same-origin"); // the page has no script; this only lets the print dialog open
      f.srcdoc = html;
      f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_e) {} setTimeout(() => f.remove(), 60000); };
      document.body.appendChild(f);
    }

    /* ---------------- rendering ---------------- */
    function renderTable(tb) {
      const L = S.labels, wrap = mk("section", "rp-sec");
      wrap.appendChild(mk("h4", "", (L.tables && L.tables[tb.id]) || tb.id));
      if (!tb.rows.length) { wrap.appendChild(mk("div", "rp-empty", t().empty)); return wrap; }
      const pg = Math.min(S.pages[tb.id] || 0, Math.ceil(tb.rows.length / PAGE) - 1);
      const scroll = mk("div", "rp-scroll"), tbl = mk("table"), thead = mk("thead"), hr = mk("tr");
      for (const c of tb.columns) { const th = mk("th", NUM[c.type] ? "n" : "", (L.columns && L.columns[c.key]) || c.key); th.scope = "col"; hr.appendChild(th); }
      thead.appendChild(hr); tbl.appendChild(thead);
      const tbody = mk("tbody");
      for (const r of tb.rows.slice(pg * PAGE, pg * PAGE + PAGE)) { const tr = mk("tr"); for (const c of tb.columns) tr.appendChild(mk("td", NUM[c.type] ? "n" : "", fmt(c, r[c.key]))); tbody.appendChild(tr); }
      tbl.appendChild(tbody);
      if (tb.totals) {
        const tf = mk("tfoot"), tr = mk("tr");
        tb.columns.forEach((c, i) => tr.appendChild(mk("td", NUM[c.type] ? "n" : "", tb.totals[c.key] != null ? fmt(c, tb.totals[c.key]) : i === 0 ? t().totals : "")));
        tf.appendChild(tr); tbl.appendChild(tf);
      }
      scroll.appendChild(tbl); wrap.appendChild(scroll);
      const pages = Math.ceil(tb.rows.length / PAGE);
      if (pages > 1) {
        const nav = mk("div", "rp-pager");
        const prev = mk("button", "rp-b", t().prev), next = mk("button", "rp-b", t().next);
        prev.type = next.type = "button"; prev.disabled = pg === 0; next.disabled = pg >= pages - 1;
        prev.addEventListener("click", () => { S.pages[tb.id] = pg - 1; render(); }); next.addEventListener("click", () => { S.pages[tb.id] = pg + 1; render(); });
        nav.append(prev, mk("span", "", `${t().page} ${pg + 1} ${t().of} ${pages} · ${tb.totalRows != null ? tb.totalRows : tb.rows.length} ${t().rows}`), next);
        wrap.appendChild(nav);
      }
      if (tb.truncated) wrap.appendChild(mk("div", "rp-note", t().truncated));
      return wrap;
    }
    function render() {
      body.replaceChildren();
      if (S.err) { const e = mk("div", "rp-err", S.err), b = mk("button", "rp-b", t().retry); b.type = "button"; b.addEventListener("click", () => load()); e.appendChild(b); body.appendChild(e); return; }
      if (!S.data) { body.appendChild(mk("div", "rp-loading", t().loading)); return; }
      const rep = S.data;
      if (rep.type === "reconcile" && typeof rep.meta.ok === "boolean") body.appendChild(mk("div", "rp-banner " + (rep.meta.ok ? "ok" : "bad"), rep.meta.ok ? t().reconOk : t().reconFail));
      for (const tb of rep.tables) body.appendChild(renderTable(tb));
      for (const n of S.labels.notes || []) body.appendChild(mk("p", "rp-note", n));
    }

    async function load() {
      if (!S.index) return;
      const seq = ++S.seq; // a slow older response can never overwrite a newer one
      S.err = null; S.data = null; render(); say("");
      try {
        const r = await get(opts.base + "/" + S.type + "?" + qs());
        if (seq !== S.seq) return;
        S.data = r.report; S.labels = r.labels;
        buildBar(); render();
      } catch (e) { if (seq !== S.seq) return; S.err = e.message; render(); }
    }
    async function init() {
      body.appendChild(mk("div", "rp-loading", t().loading));
      try {
        S.index = await get(opts.base + "?lang=" + lang());
        if (!S.index.types.length) { body.replaceChildren(mk("div", "rp-empty", t().noReports)); return; }
        S.type = S.index.types[0].id;
        buildBar(); await load();
      } catch (e) { S.err = e.message; render(); }
    }
    new MutationObserver(async () => { if (S.index) { try { S.index = await get(opts.base + "?lang=" + lang()); } catch (_e) {} buildBar(); load(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    init();
    return { reload: load };
  }
  window.SiymonReports = { mount };
})();
