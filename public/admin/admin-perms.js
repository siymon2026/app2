/* Admin permissions on the client.
   The SERVER is the authority (lib/admin-roles.js authorises every request); this module only makes the UI
   match it so a staff member never sees, opens or triggers something their role cannot use:
     - hides sidebar entries, action buttons and any element tagged data-perm="<permission>";
     - hides everything gated WHILE the permissions are still loading (no flash of forbidden UI);
     - exposes window.adminPerms { can, canNav, ready, reload, reset, onChange } so admin.js skips requests the role
       may not make (those only produced 403s + audit-log noise) and admin-nav.js can refuse a typed #/route;
     - re-loads on every login/logout, so switching accounts in the same tab never keeps the previous role's UI. */
(function () {
  "use strict";
  var doc = document;
  var TOKEN_KEY = "siymon_admin_token_v2";
  // sidebar entry (data-key) -> permission needed ("*" = system_admin only; routes not granted to any other role)
  var NAV = {
    drivers: "drivers.read", dispatch: "dispatch.manage", customers: "customers.read",
    support: "support.use", topups: "finance.read",
    notifications: "*", payments: "payments.manage", loyalty: "loyalty.read", promos: "*", staff: "*", settings: "*", menuManage: "*", subRest: "*", subMeals: "*",
    portal: "*", storeEnter: "*", audit: "audit.read", storeSupport: "support.use", exceptions: "exceptions.read", system: "finance.read", feedback: "complaints.read", reports: "reports.read", zones: "zones.read",
  };
  // permission -> CSS selectors hidden when the role lacks it
  var ACTIONS = {
    "drivers.review": ['[data-action="approve-driver"]', '[data-action="reject-driver"]', '[data-action="suspend-driver"]'],
    "drivers.documents": ['[data-action="view-driver"]'],
    "finance.write": ["#fnSaveComm", "[data-void]"],
    "settings.dispatch": ["#dspSettingsBox"],
    "orders.manage": ['[data-action="accept"]', '[data-action="done"]', '[data-action="wifi"]', "#detailDoneBtn", "#detailWifiBtn"],
    "orders.exception": ["#verifyExceptionBtn"],
    "stores.read": ['[data-action="store-profile"]'],
    "loyalty.adjust": ["#loyaltyAdjustBox"],
    "loyalty.settings": ["#loyaltySettingsBox"],
    "wallet.adjust": ["[data-wallet-adjust]"],
    "*": ['[data-action="review-store"]', '[data-action="edit-rest"]', '[data-action="del-rest"]', '[data-action="archive-rest"]', '[data-action="toggle-rest"]',
          '[data-action="auth-rest"]', "#restToggleBtn", "#restaurantPortalBtn", "#sbPortal", "#sbEnterStore", "#sbEnterRest"],
  };
  // routes (#/x) that exist but are not sidebar buttons
  var ROUTE_PERM = { settings: "*", menuManage: "*", subRest: "*", subMeals: "*", notifications: "*" };

  var state = { perms: null, loaded: false, gen: 0, waiters: [], listeners: [], inflight: null };

  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function has(perms, p) { return !!perms && (perms.indexOf("*") >= 0 || perms.indexOf(p) >= 0); }

  // Pure: which selectors would be hidden for a permission list (unit-tested).
  function hiddenFor(perms) {
    var all = perms.indexOf("*") >= 0;
    var hasP = function (p) { return all || perms.indexOf(p) >= 0; };
    var css = [];
    Object.keys(NAV).forEach(function (k) {
      if (hasP(NAV[k])) return;
      css.push('[data-key="' + k + '"]');
      css.push('[data-src="' + k + 'Btn"]');
    });
    Object.keys(ACTIONS).forEach(function (p) {
      if (!hasP(p)) ACTIONS[p].forEach(function (s) { css.push(s); });
    });
    // generic: any element can declare data-perm="orders.manage" (or "*") in markup
    var tagged = {};
    Object.keys(ACTIONS).concat(Object.keys(NAV).map(function (k) { return NAV[k]; }), ["orders.manage", "orders.exception", "support.use", "finance.read", "finance.write", "stores.read", "drivers.read", "loyalty.read", "loyalty.adjust", "loyalty.settings", "wallet.adjust", "wallet.settings"]).forEach(function (p) {
      if (!hasP(p) && !tagged[p]) { tagged[p] = 1; css.push('[data-perm="' + p + '"]'); }
    });
    return css;
  }

  // everything that is gated at all (used while permissions are loading)
  function allGated() { return hiddenFor([]); }

  function setStyle(id, css) {
    var st = doc.getElementById(id);
    if (!css || !css.length) { if (st && st.parentNode) st.parentNode.removeChild(st); return; }
    if (!st) { st = doc.createElement("style"); st.id = id; (doc.head || doc.documentElement).appendChild(st); }
    st.textContent = css.join(",\n") + " { display: none !important; }";
  }

  function apply(perms) {
    setStyle("adminPermsPending", null);
    setStyle("adminPermsStyle", perms ? hiddenFor(perms) : null);
    if (doc.documentElement && doc.documentElement.setAttribute) {
      if (perms && perms.indexOf("*") < 0) doc.documentElement.setAttribute("data-admin-restricted", "1");
      else if (doc.documentElement.removeAttribute) doc.documentElement.removeAttribute("data-admin-restricted");
    }
  }
  function hideUntilKnown() { if (token()) setStyle("adminPermsPending", allGated()); }

  function settle(perms) {
    state.perms = perms; state.loaded = true;
    apply(perms);
    var w = state.waiters; state.waiters = [];
    w.forEach(function (f) { f(perms); });
    state.listeners.forEach(function (f) { try { f(perms); } catch (e) {} });
  }

  // (re)load from the server. Resolves with the permission list, or null (signed out / unreachable).
  function reload() {
    var tok = token();
    if (!tok) { reset(); return Promise.resolve(null); }
    if (state.inflight) return state.inflight;
    var myGen = ++state.gen;
    hideUntilKnown();
    state.inflight = fetch("/api/admin/me", { headers: { "X-Admin-Token": tok, Authorization: "Bearer " + tok }, credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (myGen !== state.gen) return state.perms;
        var perms = me && Array.isArray(me.permissions) ? me.permissions : null;
        settle(perms);
        return perms;
      })
      .catch(function () { return state.perms; })
      .then(function (v) { state.inflight = null; return v; });
    return state.inflight;
  }
  function reset() {
    state.gen++; state.inflight = null;
    setStyle("adminPermsPending", null); setStyle("adminPermsStyle", null);
    settle(null); state.loaded = false;
  }

  // Promise that resolves once permissions are known (null = none / not signed in)
  function ready() {
    if (state.loaded) return Promise.resolve(state.perms);
    if (!token()) return Promise.resolve(null);
    if (!state.inflight) reload();
    return new Promise(function (ok) { state.waiters.push(ok); });
  }
  // synchronous: unknown permissions => false (deny until proven otherwise)
  function can(p) { return has(state.perms, p); }
  // may this sidebar/route key be opened?
  function canNav(key) {
    var need = ROUTE_PERM[key] || NAV[key];
    if (!need) return true;
    return has(state.perms, need);
  }

  var api = {
    can: can, canNav: canNav, ready: ready, reload: reload, reset: reset,
    onChange: function (f) { state.listeners.push(f); },
    perms: function () { return state.perms ? state.perms.slice() : null; },
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = { hiddenFor: hiddenFor, NAV: NAV, ACTIONS: ACTIONS, ROUTE_PERM: ROUTE_PERM, allGated: allGated }; return; } // unit tests
  window.adminPerms = api;

  hideUntilKnown();
  if (token()) reload();
  // a failed /me (offline) is retried so the UI is never stuck hidden
  setInterval(function () { if (token() && !state.loaded && !state.inflight) reload(); }, 3000);
})();
