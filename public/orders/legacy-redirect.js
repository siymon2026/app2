/* Old links (push notifications already sent, bookmarks, cached pages) used to open
   pop-ups on top of /orders/. They now go to the real pages — before anything renders. */
(function () {
  var q = new URLSearchParams(location.search);
  var to = "";
  if (q.get("notifications") === "1" || q.get("open") === "notifications") to = "/notifications/";
  else if (q.get("support") === "1") to = "/chat/";
  if (to) {
    window.__siymonLeaving = true;
    location.replace(to);
  }
  window.addEventListener("pagehide", function () { window.__siymonLeaving = true; });
})();
