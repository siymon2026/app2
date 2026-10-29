/* Scroll reveal (IntersectionObserver). Works for dynamically rendered blocks too. */
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var SELECTOR = [
    "[data-reveal]",
    ".ratings-head",
    ".rating-card",
    "#customersBody > tr:not(.cu-empty-row)",
  ].join(",");

  var batchDelay = 0;
  var batchTimer = null;

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var n = en.target;
        io.unobserve(n);
        // small stagger for blocks entering together (max 5 steps)
        n.style.setProperty("--rv-delay", Math.min(batchDelay, 4) * 70 + "ms");
        batchDelay++;
        clearTimeout(batchTimer);
        batchTimer = setTimeout(function () { batchDelay = 0; }, 120);
        requestAnimationFrame(function () {
          n.classList.add("rv-in");
        });
        var done = function () {
          n.classList.remove("rv", "rv-in");
          n.style.removeProperty("--rv-delay");
        };
        n.addEventListener("transitionend", done, { once: true });
        setTimeout(done, 1500); // safety net
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
  );

  function prep(root) {
    var list = [];
    if (root.nodeType !== 1) return;
    if (root.matches(SELECTOR)) list.push(root);
    root.querySelectorAll(SELECTOR).forEach(function (x) { list.push(x); });
    list.forEach(function (n) {
      if (n.__rv) return;
      n.__rv = 1;
      n.classList.add("rv");
      io.observe(n);
    });
  }

  function start() {
    prep(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { m.addedNodes.forEach(prep); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
