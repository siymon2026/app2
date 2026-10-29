/* siymon — theme bootstrap. Loaded SYNCHRONOUSLY in <head> of every customer page (no inline script: strict CSP).
   Why: pages used to wait for their own big script (app.js / orders.js, loaded at the end of <body>) before choosing the
   saved theme, so on a slow phone the whole page — footer included — painted in the light CSS defaults (white) and
   only then turned dark; some pages (stores, support) never read the app's theme at all and followed the phone's
   light/dark setting instead. This reads the SAME key the app uses (siymon_theme_v3, default dark) before first paint,
   and keeps <meta name="theme-color"> + color-scheme (browser bars, overscroll, form controls) in step with it,
   also when the user toggles the theme later. */
(function () {
  "use strict";
  var KEY = "siymon_theme_v3", root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY) || "dark"; } catch (e) { return "dark"; } }
  function sync() {
    var dark = root.getAttribute("data-theme") === "dark";
    root.style.colorScheme = dark ? "dark" : "light";
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.name = "theme-color"; (document.head || root).appendChild(m); }
    var c = dark ? "#0F0F0F" : "#F8F8F8";
    if (m.getAttribute("content") !== c) m.setAttribute("content", c);
  }
  if (saved() === "dark") root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
  sync();
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    if (saved() === "dark") root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
  });
})();
