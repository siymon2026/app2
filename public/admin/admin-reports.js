/* Admin "Reports" page (section 17): mounts the shared reports UI inside the back office.
   The SERVER decides which reports this role may open (lib/admin-roles.js + lib/report-routes.js); this file only
   wires the page, its sidebar entry and the auth header. Loaded after admin.js (uses: token, lang, showAuth). */
"use strict";
(function () {
  const TITLE = { ar: "التقارير والتحليلات", fr: "Rapports et analyses", en: "Reports & analytics" };
  const $ = (id) => document.getElementById(id);
  const L = () => (typeof lang !== "undefined" && TITLE[lang] ? lang : "ar");
  let handle = null;

  function applyText() {
    const t = TITLE[L()];
    if ($("rpTitle")) $("rpTitle").textContent = t;
    if ($("reportsText")) $("reportsText").textContent = t;
  }
  function showReports(show) {
    const m = $("reportsModal");
    if (m) m.classList.toggle("show", show !== false);
  }
  window.showReports = showReports;

  function open() {
    if (typeof token === "undefined" || !token) return showAuth(true);
    if (window.adminPerms && typeof window.adminPerms.canNav === "function" && !window.adminPerms.canNav("reports")) return;
    applyText();
    const box = $("rpMount");
    if (box && !handle) {
      handle = window.SiymonReports.mount(box, {
        base: "/api/admin/reports",
        lang: L,
        headers: () => ({ "X-Admin-Token": typeof token !== "undefined" ? token : "" }),
        onUnauthorized: () => { handle = null; if (typeof showAuth === "function") showAuth(true); },
      });
    } else if (handle) handle.reload();
    showReports(true);
  }

  function init() {
    if (!$("reportsModal")) return;
    applyText();
    const btn = $("reportsBtn");
    if (btn) btn.addEventListener("click", open);
    new MutationObserver(applyText).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  init();
})();
