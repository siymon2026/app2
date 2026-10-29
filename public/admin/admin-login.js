/* Glass login: password eye, welcome-panel switch, Enter to submit.
   Purely presentational — the auth logic stays in admin.js (doLogin / doSignup). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  document.addEventListener("click", function (e) {
    var eye = e.target.closest && e.target.closest("[data-ga-eye]");
    if (!eye) return;
    var input = $(eye.getAttribute("data-ga-eye"));
    if (!input) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", show ? "true" : "false");
    eye.classList.toggle("on", show);
  });

  function isSignup() {
    var f = $("signupForm");
    return !!f && f.style.display !== "none";
  }
  function syncPanel() {
    var signup = isSignup();
    var t = $("gaSwitchText"), h = $("gaWelcomeTitle"), p = $("gaWelcomeText");
    var rtl = document.documentElement.dir === "rtl";
    var ar = document.documentElement.lang === "ar";
    var fr = document.documentElement.lang === "fr";
    var L = {
      login: ar ? ["أهلاً بك!", "أدخل بياناتك وابدأ رحلتك معنا.", "إنشاء حساب"]
           : fr ? ["BONJOUR,<br>AMI !", "Saisissez vos informations et commencez avec nous.", "Créer un compte"]
           : ["HELLO,<br>FRIEND!", "Enter your personal details and start your journey with us.", "Create Account"],
      signup: ar ? ["مرحباً بعودتك!", "لديك حساب بالفعل؟ سجّل الدخول للمتابعة.", "تسجيل الدخول"]
            : fr ? ["BON RETOUR !", "Déjà un compte ? Connectez-vous pour continuer.", "Connexion"]
            : ["WELCOME<br>BACK!", "Already have an account? Sign in to continue.", "Login"]
    }[signup ? "signup" : "login"];
    if (h) h.innerHTML = L[0];
    if (p) p.textContent = L[1];
    if (t) t.textContent = L[2];
    var arrow = document.querySelector("#gaSwitchBtn > span[aria-hidden]");
    if (arrow) arrow.textContent = rtl ? "←" : "→";
  }

  document.addEventListener("auth-tab", syncPanel);
  document.addEventListener("DOMContentLoaded", function () {
    syncPanel();
    var sw = $("gaSwitchBtn");
    if (sw) sw.addEventListener("click", function () {
      var tab = $(isSignup() ? "tabLogin" : "tabSignup");
      if (tab) tab.click();
    });
    // Enter submits the visible form
    var modal = $("authModal");
    if (modal) modal.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing) return;
      if (!e.target.matches || !e.target.matches("input")) return;
      var btn = $(isSignup() ? "signupBtn" : "loginBtn");
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    });
    // language may change the page lang attribute
    new MutationObserver(syncPanel).observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "dir"] });
  });
})();
