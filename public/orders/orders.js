/* global */

const ICONS = {
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Zm17 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2ZM5.2 5.2a1 1 0 0 1 1.4 0l.7.7A1 1 0 1 1 5.9 7.3l-.7-.7a1 1 0 0 1 0-1.4Zm12.2 12.2a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM18.8 5.2a1 1 0 0 1 0 1.4l-.7.7A1 1 0 1 1 16.7 5.9l.7-.7a1 1 0 0 1 1.4 0ZM7.3 16.7a1 1 0 0 1 0 1.4l-.7.7a1 1 0 1 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0Z"/></svg>`,
};

const el = (id) => document.getElementById(id);

const CUSTOMER_TOKEN_KEY = "siymon_customer_token_v1";
const CUSTOMER_PROFILE_KEY = "siymon_customer_profile_v1";
const THEME_KEY = "siymon_theme_v3";
const SOUND_KEY = "siymon_customer_sound_v1";

let PUBLIC = { supportPhone: "+212000000000" };
let LAST_ORDERS = [];
let NOTIF_POLL = null;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "0";
let lastUnreadCount = null;

async function loadPublicConfig() {
  try {
    const res = await fetch("/api/public-config");
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object") PUBLIC = data;
  } catch (_e) {
    PUBLIC = { supportPhone: "+212000000000" };
  }
}

const LANG_KEY = "siymon_lang_v1";
let lang = localStorage.getItem(LANG_KEY) || "ar";
const LANGS = ["ar", "en", "fr"]; // cycle

const i18n = {
  ar: {
    dir: "rtl",
    heroBadge: "حنا معاك دائماً",
    perk1Title: "تتبع الطلب لحظة بلحظة",
    perk1Body: "تابع حالة طلبك من التحضير حتى وصوله إليك.",
    perk2Title: "تواصل مباشر مع السائق",
    perk2Body: "تحدّث مع السائق مباشرة أثناء التوصيل.",
    perk3Title: "قيّم تجربتك بعد كل طلب",
    perk3Body: "رأيك يساعدنا على تحسين الخدمة باستمرار.",
    brandSub: "طلباتك وحسابك",
    welcomeTitle: "مرحباً بكم في siymon",
    welcomeText: "سجّل الدخول أو أنشئ حساباً لمتابعة طلباتك.",
    back: "الرجوع",

    tabLogin: "تسجيل الدخول",
    tabSignup: "إنشاء حساب",

    guestBtn: "الدخول كزائر",

    loginIdLabel: "البريد الإلكتروني أو رقم الهاتف",
    loginPassLabel: "كلمة السر",
    loginBtn: "دخول",

    firstNameLabel: "الاسم",
    lastNameLabel: "النسب",
    emailLabel: "البريد الإلكتروني (إجباري)",
    phoneLabel: "رقم الهاتف (اختياري)",
    passLabel: "كلمة السر",
    pass2Label: "تأكيد كلمة السر",
    signupBtn: "إنشاء حساب",

    acceptPolicyText: "أوافق على سياسة الشركة",
    readPolicy: "قراءة السياسة",
    policyLink: "سياسة الشركة",

    myOrdersTitle: "طلباتي",
    myOrdersSub: "هنا ستجد جميع الطلبات الخاصة بك.",
    orderNow: "اطلب الآن",
    notificationsBtn: "الإشعارات",
    notificationsTitle: "الإشعارات",
    noNotifications: "لا توجد إشعارات حالياً.",

    pushEnable: "تفعيل إشعارات الهاتف",
    pushDisable: "إيقاف إشعارات الهاتف",
    pushNotSupported: "الإشعارات غير مدعومة في هذا المتصفح",
    pushDenied: "المتصفح رفض الإشعارات. فعّلها من الإعدادات.",
    pushNeedHttps: "Push Notifications كتحتاج HTTPS (ولا localhost).",
    pushEnabledToast: "تم تفعيل الإشعارات ✅",
    pushDisabledToast: "تم إيقاف الإشعارات",
    soundOn: "🔔 الصوت: تشغيل",
    soundOff: "🔕 الصوت: إيقاف",
    logout: "تسجيل الخروج",
    refresh: "تحديث",
    cancelOrder: "إلغاء الطلب",
    contactOrder: "اتوصل بالطلب",
    confirmCancel: "واش متأكد باغي تلغي هاد الطلب؟",

    rateOrder: "قيّم الطلب",
    editRating: "تعديل التقييم",
    ratingTitle: "تقييم طلبك",
    ratingCommentPh: "اكتب تعليقاً قصيراً (اختياري)...",
    ratingNeedStars: "اختر عدد النجوم أولاً.",
    ratingSaved: "تم حفظ التقييم ✅",

    errors: {
      needLoginId: "أدخل البريد الإلكتروني أو رقم الهاتف.",
      needPassword: "أدخل كلمة السر.",
      needFirst: "اكتب الاسم.",
      needLast: "اكتب النسب.",
      needEmail: "المرجو إدخال بريد إلكتروني صحيح.",
      needPass2: "أعد كتابة كلمة السر للتأكيد.",
      passMismatch: "كلمتا السر غير متطابقتين.",
      shortPass: "كلمة السر قصيرة (على الأقل 6 أحرف).",
      mustAcceptPolicy: "خاصك توافق على سياسة الشركة.",
    },

    status: {
      new: "جديد",
      accepted: "تم القبول",
      picked_up: "تم الاستلام",
      on_the_way: "في الطريق",
      delivered: "تم التسليم",
      canceled: "ملغي",
      done: "منتهي",
      sent: "تم الإرسال",
    },

    footer: "© siymon",
  },

  en: {
    dir: "ltr",
    heroBadge: "We're always with you",
    perk1Title: "Track your order live",
    perk1Body: "Follow your order from preparation to your door.",
    perk2Title: "Chat directly with the driver",
    perk2Body: "Talk to your driver in real time during delivery.",
    perk3Title: "Rate every order",
    perk3Body: "Your feedback helps us keep improving.",
    brandSub: "Your account & orders",
    welcomeTitle: "Welcome",
    welcomeText: "Log in or create an account to track your orders.",
    back: "Back",

    tabLogin: "Log in",
    tabSignup: "Create account",

    guestBtn: "Continue as guest",

    loginIdLabel: "Email or phone",
    loginPassLabel: "Password",
    loginBtn: "Log in",

    firstNameLabel: "First name",
    lastNameLabel: "Last name",
    emailLabel: "Email (Required)",
    phoneLabel: "Phone (optional)",
    passLabel: "Password",
    pass2Label: "Confirm password",
    signupBtn: "Create account",

    acceptPolicyText: "I agree to the company policy",
    readPolicy: "Read policy",
    policyLink: "Company policy",

    myOrdersTitle: "My orders",
    myOrdersSub: "All your orders will appear here.",
    orderNow: "Order now",
    notificationsBtn: "Notifications",
    notificationsTitle: "Notifications",
    noNotifications: "No notifications yet.",

    pushEnable: "Enable push notifications",
    pushDisable: "Disable push notifications",
    pushNotSupported: "Push notifications are not supported in this browser",
    pushDenied: "Notifications are blocked in your browser settings",
    pushNeedHttps: "Push requires HTTPS (or localhost).",
    pushEnabledToast: "Push enabled ✅",
    pushDisabledToast: "Push disabled",
    soundOn: "🔔 Sound: ON",
    soundOff: "🔕 Sound: OFF",
    logout: "Log out",
    refresh: "Refresh",
    cancelOrder: "Cancel order",
    contactOrder: "Contact about order",
    confirmCancel: "Cancel this order?",

    errors: {
      needLoginId: "Enter email or phone.",
      needPassword: "Enter your password.",
      needFirst: "Enter first name.",
      needLast: "Enter last name.",
      needEmail: "Please enter a valid email.",
      needPass2: "Confirm your password.",
      passMismatch: "Passwords do not match.",
      shortPass: "Password too short (min 6).",
      mustAcceptPolicy: "Please accept the company policy.",
    },

    status: {
      new: "New",
      accepted: "Accepted",
      picked_up: "Picked up",
      on_the_way: "On the way",
      delivered: "Delivered",
      canceled: "Canceled",
      done: "Done",
      sent: "Sent",
    },

    footer: "© siymon",
  },

  fr: {
    dir: "ltr",
    heroBadge: "On est toujours avec vous",
    perk1Title: "Suivez votre commande en direct",
    perk1Body: "Suivez votre commande de la préparation à la livraison.",
    perk2Title: "Discutez avec le livreur",
    perk2Body: "Échangez avec votre livreur pendant la livraison.",
    perk3Title: "Notez chaque commande",
    perk3Body: "Votre avis nous aide à nous améliorer.",
    brandSub: "Votre compte & commandes",
    welcomeTitle: "Bienvenue",
    welcomeText: "Connectez‑vous ou créez un compte pour suivre vos commandes.",
    back: "Retour",

    tabLogin: "Connexion",
    tabSignup: "Créer un compte",

    guestBtn: "Continuer en invité",

    loginIdLabel: "Email ou téléphone",
    loginPassLabel: "Mot de passe",
    loginBtn: "Se connecter",

    firstNameLabel: "Prénom",
    lastNameLabel: "Nom",
    emailLabel: "Email (Obligatoire)",
    phoneLabel: "Téléphone (optionnel)",
    passLabel: "Mot de passe",
    pass2Label: "Confirmer le mot de passe",
    signupBtn: "Créer le compte",

    myOrdersTitle: "Mes commandes",
    myOrdersSub: "Toutes vos commandes apparaîtront ici.",
    orderNow: "Commander",
    notificationsBtn: "Notifications",
    notificationsTitle: "Notifications",
    noNotifications: "Aucune notification pour le moment.",

    pushEnable: "Activer les notifications push",
    pushDisable: "Désactiver les notifications push",
    pushNotSupported:
      "Les notifications push ne sont pas prises en charge par ce navigateur",
    pushDenied:
      "Les notifications sont bloquées dans les paramètres du navigateur",
    pushNeedHttps: "Le push nécessite HTTPS (ou localhost).",
    pushEnabledToast: "Push activé ✅",
    pushDisabledToast: "Push désactivé",
    soundOn: "🔔 Son: ON",
    soundOff: "🔕 Son: OFF",
    logout: "Déconnexion",
    refresh: "Actualiser",
    cancelOrder: "Annuler la commande",
    contactOrder: "Contacter pour la commande",
    confirmCancel: "Annuler cette commande ?",

    errors: {
      needLoginId: "Entrez l’email ou le téléphone.",
      needPassword: "Entrez le mot de passe.",
      needFirst: "Entrez le prénom.",
      needLast: "Entrez le nom.",
      needEmail: "Veuillez entrer un email valide.",
      needPass2: "Confirmez le mot de passe.",
      passMismatch: "Les mots de passe ne correspondent pas.",
      shortPass: "Mot de passe trop court (min 6).",
    },

    status: {
      new: "Nouveau",
      accepted: "Acceptée",
      picked_up: "Récupérée",
      on_the_way: "En route",
      delivered: "Livrée",
      canceled: "Annulée",
      done: "Terminée",
      sent: "Envoyée",
    },

    footer: "© siymon",
  },
};

function nextLang(cur) {
  const i = LANGS.indexOf(cur);
  return LANGS[(i + 1) % LANGS.length];
}

function safeNextUrl() {
  const n = new URLSearchParams(location.search).get("next");
  if (!n) return "";
  let dec = n;
  try {
    dec = decodeURIComponent(n);
  } catch (_e) {}
  if (typeof dec !== "string") return "";
  if (!dec.startsWith("/")) return "";
  return dec;
}

function setLang(l) {
  lang = l;
  localStorage.setItem(LANG_KEY, lang);
  const t = i18n[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir;

  el("brandSub").textContent = t.brandSub;
  document.querySelectorAll("[data-k]").forEach((n) => {
    if (t[n.dataset.k]) n.textContent = t[n.dataset.k];
  });
  el("welcomeTitle").textContent = t.welcomeTitle;
  el("welcomeText").textContent = t.welcomeText;
  el("goHome").textContent = t.back;

  el("tabLogin").textContent = t.tabLogin;
  el("tabSignup").textContent = t.tabSignup;
  const gb = el("guestBtn");
  if (gb) gb.textContent = t.guestBtn;

  el("loginIdLabel").textContent = t.loginIdLabel;
  el("loginPassLabel").textContent = t.loginPassLabel;
  el("loginBtn").textContent = t.loginBtn;

  el("firstNameLabel").textContent = t.firstNameLabel;
  el("lastNameLabel").textContent = t.lastNameLabel;
  el("emailLabel").textContent = t.emailLabel;
  el("phoneLabel").textContent = t.phoneLabel;
  el("passLabel").textContent = t.passLabel;
  el("pass2Label").textContent = t.pass2Label;
  el("signupBtn").textContent = t.signupBtn;

  el("myOrdersTitle").textContent = t.myOrdersTitle;
  el("myOrdersSub").textContent = t.myOrdersSub;
  // Rating modal
  el("ratingTitle") &&
    (el("ratingTitle").textContent =
      t.ratingTitle ||
      (lang === "ar"
        ? "تقييم طلبك"
        : lang === "fr"
          ? "Noter votre commande"
          : "Rate your order"));
  el("ratingComment") &&
    (el("ratingComment").placeholder =
      t.ratingCommentPh ||
      (lang === "ar"
        ? "اكتب تعليقاً قصيراً (اختياري)..."
        : lang === "fr"
          ? "Écrivez un court commentaire (optionnel)..."
          : "Write a short comment (optional)..."));
  el("cancelRatingBtn") &&
    (el("cancelRatingBtn").textContent =
      lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel");
  el("submitRatingBtn") &&
    (el("submitRatingBtn").textContent =
      lang === "ar" ? "إرسال" : lang === "fr" ? "Envoyer" : "Submit");
  el("refreshOrders").setAttribute("aria-label", t.refresh);
  el("refreshOrders").setAttribute("title", t.refresh);
  renderFilters();

  el("footerText").textContent = t.footer;

  // Company policy links / checkbox
  const policyEnabled = !!(PUBLIC && PUBLIC.companyPolicyEnabled);
  const policyField = el("policyField");
  if (policyField) {
    policyField.style.display = policyEnabled ? "block" : "none";
    el("acceptPolicyText") &&
      (el("acceptPolicyText").textContent =
        t.acceptPolicyText ||
        (lang === "ar"
          ? "أوافق على سياسة الشركة"
          : lang === "fr"
            ? "J’accepte la politique de l’entreprise"
            : "I agree to the company policy"));
    el("readPolicyLink") &&
      (el("readPolicyLink").textContent =
        t.readPolicy ||
        (lang === "ar"
          ? "قراءة السياسة"
          : lang === "fr"
            ? "Lire la politique"
            : "Read policy"));
  }
  const policyLinkEl = el("policyLink");
  if (policyLinkEl) {
    policyLinkEl.textContent =
      t.policyLink ||
      (lang === "ar"
        ? "سياسة الشركة"
        : lang === "fr"
          ? "Politique de l’entreprise"
          : "Company policy");
    policyLinkEl.style.display = "inline";
  }

  // Toggle label shows NEXT language
  updateSoundBtn();
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/***********************
 * Sound (notifications)
 ***********************/
const NOTIF_SOUND_URL = "/sounds/order.mp3";
let notifAudio = null;
let audioCtx = null;

function updateSoundBtn() {
  const btn = el("soundToggle");
  if (!btn) return;
  const t = i18n[lang] || i18n.ar;
  btn.textContent = soundEnabled ? t.soundOn || "🔔" : t.soundOff || "🔕";
}

function setSound(on) {
  soundEnabled = !!on;
  localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
  updateSoundBtn();
  if (soundEnabled) unlockAudio();
}

function unlockAudio() {
  if (!soundEnabled) return;
  try {
    if (!notifAudio) {
      notifAudio = new Audio(NOTIF_SOUND_URL);
      notifAudio.preload = "auto";
    }
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === "suspended")
        audioCtx.resume().catch(() => {});
    } catch (_e) {}

    const prevVol = notifAudio.volume;
    notifAudio.volume = 0.001;
    notifAudio.muted = false;

    const p = notifAudio.play();
    if (p && p.then) {
      p.then(() => {
        try {
          notifAudio.pause();
          notifAudio.currentTime = 0;
        } catch (_e) {}
        notifAudio.volume = prevVol;
      }).catch(() => {
        notifAudio.volume = prevVol;
      });
    } else {
      try {
        notifAudio.pause();
        notifAudio.currentTime = 0;
      } catch (_e) {}
      notifAudio.volume = prevVol;
    }
  } catch (_e) {}
}

function beep() {
  if (!soundEnabled) return;

  if (!notifAudio) {
    notifAudio = new Audio("/sounds/order.mp3");
  }

  notifAudio.currentTime = 0;
  notifAudio.volume = 1.0;

  const playPromise = notifAudio.play();

  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      console.log("Autoplay prevented or audio error:", error);
      try {
        if (!audioCtx)
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } catch (e) {}
    });
  }

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

function getToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
}

function saveSession(token, customer) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(customer || {}));
}

function clearSession() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
}

function showAuth() {
  stopNotifPoll();
  lastUnreadCount = 0;
  el("ordersView").style.display = "none";
  el("authView").style.display = "grid";
}

function showOrders() {
  el("authView").style.display = "none";
  el("ordersView").style.display = "block";
}

function setTab(which) {
  const login = el("loginForm");
  const signup = el("signupForm");
  const bLogin = el("tabLogin");
  const bSignup = el("tabSignup");

  if (which === "signup") {
    login.style.display = "none";
    signup.style.display = "grid";
    bLogin.classList.remove("primary");
    bLogin.classList.add("ghost");
    bSignup.classList.remove("ghost");
    bSignup.classList.add("primary");
  } else {
    login.style.display = "grid";
    signup.style.display = "none";
    bSignup.classList.remove("primary");
    bSignup.classList.add("ghost");
    bLogin.classList.remove("ghost");
    bLogin.classList.add("primary");
  }

  el("loginHint").textContent = "";
  el("signupHint").textContent = "";
  el("authHint").textContent = "";
}

function normalizePhone(p) {
  return String(p || "").replace(/\D/g, "");
}

function renderProfile(me) {
  const email = me?.email || "";
  const phone = me?.phone || "";
  const name = `${me?.firstName || ""} ${me?.lastName || ""}`.trim();

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  el("profileBox").innerHTML = `
    <span class="pf-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
    <div class="pf-info">
      <b>${escapeHtml(name || "—")}</b>
      <small>${escapeHtml(email || phone || "—")}</small>
    </div>
    <button type="button" class="btn ghost small" id="pfEditBtn">${escapeHtml(lang === "ar" ? "تعديل" : lang === "fr" ? "Modifier" : "Edit")}</button>
    <a class="pf-wallet-link" id="pfWalletLink" href="/wallet/">
      <span class="pwl-lb">${escapeHtml(WALLET_TX().t)}</span>
      <b id="pfWalletAmt">…</b>
    </a>
  `;
  loadProfileWallet();
  if (typeof window.siymonProfileEdit === "function") window.siymonProfileEdit(me);
}

/* wallet balance in the profile: REAL data from the account (same endpoint as checkout + the wallet page) */
const WALLET_TXT = {
  ar: { t: "المحفظة", err: "تعذّر جلب الرصيد" },
  fr: { t: "Portefeuille", err: "Solde indisponible" },
  en: { t: "Wallet", err: "Balance unavailable" },
};
const WALLET_TX = () => WALLET_TXT[lang] || WALLET_TXT.ar;
async function loadProfileWallet() {
  const amt = el("pfWalletAmt");
  if (!amt) return;
  try {
    const w = await api("/api/customer/wallet");
    const box = el("pfWalletAmt");
    if (box) box.textContent = `${Number(w.walletBalance || 0).toFixed(2)} ${w.currency || "MAD"}`;
  } catch (_e) {
    const box = el("pfWalletAmt");
    if (box) { box.textContent = "—"; box.title = WALLET_TX().err; }
  }
}

/* Payment line of an order: real snapshot written by the server, never re-computed here. */
function paymentLineHtml(o) {
  const pay = o && o.payment;
  const method = String((o && o.paymentMethod) || (pay && pay.method) || "cod").toLowerCase();
  const names = {
    wallet: { ar: "محفظة SIYMON", fr: "Portefeuille SIYMON", en: "SIYMON wallet" },
    cod: { ar: "الدفع عند الاستلام", fr: "Paiement à la livraison", en: "Cash on delivery" },
    tpe: { ar: "بطاقة عبر TPE", fr: "Carte via TPE", en: "Card via TPE" },
  }[method] || { ar: method, fr: method, en: method };
  const label = names[lang] || names.ar;
  const cur = String(o.currency || "").trim();
  const walletPart = Number(pay && pay.walletAmount) || 0;
  const due = Number(pay && pay.amountDueOnDelivery) || 0;
  const bits = [];
  if (walletPart > 0) bits.push(`${lang === "ar" ? "من المحفظة" : lang === "fr" ? "Du portefeuille" : "From wallet"}: ${walletPart.toFixed(2)} ${escapeHtml(cur)}`);
  if (due > 0) bits.push(`${lang === "ar" ? "عند التسليم" : lang === "fr" ? "À la livraison" : "On delivery"}: ${due.toFixed(2)} ${escapeHtml(cur)}`);
  if (pay && pay.walletRefundedAt) bits.push(lang === "ar" ? "أُعيد المبلغ إلى المحفظة" : lang === "fr" ? "Remboursé sur le portefeuille" : "Refunded to wallet");
  return `<div class="order-info">💳 ${escapeHtml(label)}${bits.length ? ` · ${bits.map(escapeHtml).join(" · ")}` : ""}</div>`;
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return String(iso || "");
  }
}

function statusLabel(st) {
  const key = String(st || "new");
  return i18n[lang].status[key] || key;
}

function statusClass(st) {
  const key = String(st || "new");
  if (key === "delivered" || key === "done") return "tag ok";
  if (key === "canceled") return "tag bad";
  if (
    [
      "admin_accepted",
      "restaurant_ready",
      "accepted",
      "picked_up",
      "on_the_way",
    ].includes(key)
  )
    return "tag warn";
  return "tag";
}

function stageIcon(kind) {
  if (kind === "admin")
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4zm-1 12l6-6-1.4-1.4L11 11.2 8.4 8.6 7 10l4 4z"/></svg>`;
  if (kind === "restaurant")
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10V8a8 8 0 0116 0v2h1v2H3v-2h1zm2 0h12V8a6 6 0 00-12 0v2zm-1 4h14v8H5v-8z"/></svg>`;
  if (kind === "driver")
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h11l1 6h-2.1a3 3 0 00-5.8 0H8.9A3 3 0 003.1 12H2l2-6h2zm0 8a2 2 0 11.001 3.999A2 2 0 016 14zm12 0a2 2 0 11.001 3.999A2 2 0 0118 14z"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 8v10h-6v-6H9v6H3V11l9-8z"/></svg>`;
}

function stageProgress(status) {
  const st = String(status || "new");
  if (st === "canceled") return { canceled: true, idx: 0 };
  let idx = 0;
  if (st === "admin_accepted") idx = 1;
  else if (
    ["restaurant_ready", "accepted", "picked_up", "on_the_way"].includes(st)
  )
    idx = 2;
  else if (["delivered", "done"].includes(st)) idx = 3;
  return { canceled: false, idx };
}

function stagesHtml(o) {
  const t =
    i18n[lang] && i18n[lang].stages
      ? i18n[lang].stages
      : {
          admin: "Admin",
          restaurant: "Restaurant",
          driver: "Driver",
          customer: "Customer",
        };
  const p = stageProgress(o?.status);
  const kinds = ["admin", "restaurant", "driver", "customer"];

  const blocks = kinds
    .map((k, i) => {
      let state = "todo";
      if (p.canceled) state = "todo";
      else if (p.idx === 3) state = "done";
      else if (i < p.idx) state = "done";
      else if (i === p.idx) state = "active";
      return `
      <div class="stage ${state}">
        <div class="stage-ico">${stageIcon(k)}</div>
        <div class="stage-txt">${escapeHtml(t[k] || k)}</div>
      </div>
    `;
    })
    .join(
      `<div class="stage-line ${p.canceled ? "todo" : p.idx === 3 ? "done" : "todo"}"></div>`,
    );

  return `<div class="stages ${p.canceled ? "canceled" : ""}">${blocks}</div>`;
}

const FILTER_T = {
  ar: { all: "الكل", active: "الجارية", done: "المكتملة", canceled: "الملغاة" },
  fr: { all: "Toutes", active: "En cours", done: "Terminées", canceled: "Annulées" },
  en: { all: "All", active: "Active", done: "Completed", canceled: "Canceled" },
};
let ORDERS_FILTER = "all";
function orderGroup(o) {
  const st = String(o?.status || "new").toLowerCase();
  if (st === "delivered" || st === "done") return "done";
  if (st === "canceled" || st === "cancelled") return "canceled";
  return "active";
}
function renderFilters() {
  const box = el("ordersFilters");
  if (!box) return;
  const list = Array.isArray(LAST_ORDERS) ? LAST_ORDERS : [];
  box.hidden = list.length === 0;
  const tt = FILTER_T[lang] || FILTER_T.ar;
  const counts = { all: list.length, active: 0, done: 0, canceled: 0 };
  list.forEach((o) => counts[orderGroup(o)]++);
  box.innerHTML = ["all", "active", "done", "canceled"]
    .filter((k) => k === "all" || counts[k] > 0)
    .map(
      (k) =>
        `<button type="button" role="tab" class="ofilter${ORDERS_FILTER === k ? " on" : ""}" data-filter="${k}" aria-selected="${ORDERS_FILTER === k}">${escapeHtml(tt[k])}<span class="ofilter-n">${counts[k]}</span></button>`,
    )
    .join("");
}
function renderOrdersFiltered() {
  const list = Array.isArray(LAST_ORDERS) ? LAST_ORDERS : [];
  if (ORDERS_FILTER !== "all" && !list.some((o) => orderGroup(o) === ORDERS_FILTER)) ORDERS_FILTER = "all";
  renderFilters();
  renderOrders(ORDERS_FILTER === "all" ? list : list.filter((o) => orderGroup(o) === ORDERS_FILTER));
}
el("ordersFilters")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  ORDERS_FILTER = b.getAttribute("data-filter") || "all";
  renderOrdersFiltered();
});

function renderOrders(list) {
  const box = el("ordersList");
  if (!Array.isArray(list) || list.length === 0) {
    box.innerHTML = `<div class="hint">${lang === "ar" ? "لا توجد طلبات بعد." : lang === "fr" ? "Aucune commande." : "No orders yet."}</div>`;
    return;
  }

  box.innerHTML = list
    .map((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const total = Number(o.total || 0);
      const currency = String(o.currency || "").trim();

      const itemsHtml = items
        .slice(0, 8)
        .map((it) => {
          const nm = it.name || it.id || "";
          const qty = Number(it.qty || 0);
          const pr = Number(it.price || 0);
          return `<div class="order-item"><span>${escapeHtml(nm)} <small class="muted">×${qty}</small></span><span><b>${(qty * pr).toFixed(2)}</b></span></div>`;
        })
        .join("");

      return `
      <div class="order-card" data-oid="${escapeHtml(o.id || "")}">
        <div class="order-head">
          <div>
            <b>#${escapeHtml(o.id || "")}</b>
            <div class="order-meta">
              <span>${escapeHtml(formatDate(o.createdAt))}</span>
              <span>•</span>
              <span>${items.length} ${lang === "fr" ? "articles" : lang === "en" ? "items" : "منتج"}</span>
            </div>
          </div>
          <div class="${statusClass(o.status)}">${escapeHtml(statusLabel(o.status))}</div>
        </div>

        <div class="order-items">${itemsHtml}</div>

        ${paymentLineHtml(o)}

        ${stagesHtml(o)}

        ${
          o.deliveryCode
            ? `<div class="order-info" style="font-size:15px">🔐 ${lang === "ar" ? "كود التسليم (أعطه للسائق عند وصوله فقط)" : lang === "fr" ? "Code de livraison (à donner au chauffeur à son arrivée)" : "Delivery code (give it to the driver only on arrival)"}: <b dir="ltr" style="font-size:22px;letter-spacing:4px">${escapeHtml(o.deliveryCode)}</b></div>`
            : ``
        }
        ${
          o.driverName || o.driverPhone
            ? `
          <div class="order-info">
            <span class="oi-ico" aria-hidden="true">🛵</span> ${lang === "ar" ? "السائق" : lang === "fr" ? "Chauffeur" : "Driver"}: <b>${escapeHtml(o.driverName || "—")}</b>
            ${o.driverPhone ? `<span class="muted"> • ${escapeHtml(o.driverPhone)}</span>` : ``}
          </div>
        `
            : ``
        }

        ${
          o.customerRating && Number(o.customerRating.stars || 0) > 0
            ? `
          <div class="order-info rating-summary">
            ⭐ <b>${Number(o.customerRating.stars || 0)}</b>/5
          </div>
        `
            : ``
        }

        <div class="order-total">
          <span class="muted">${lang === "fr" ? "Total" : lang === "en" ? "Total" : "الإجمالي"}</span>
          <b>${total.toFixed(2)} ${escapeHtml(currency)}</b>
        </div>

        ${["picked_up", "on_the_way"].includes(String(o.status || "").toLowerCase()) ? `<div class="trk" data-trk="${escapeHtml(o.id || "")}"></div>` : ""}
        <div class="order-card-actions">
          ${(() => {
            const st = String(o.status || "new").toLowerCase();
            const canCancel = st === "new" || (st === "admin_accepted" && !o.storeAcceptedAt);
            const cancelDisabled = canCancel ? "" : "disabled";
            const contactNumber =
              String(o.driverPhone || "").trim() ||
              String((PUBLIC && PUBLIC.supportPhone) || "").trim();
            const contactDisabled = contactNumber ? "" : "disabled";
            return `
                ${o.storeChatAvailable ? `<button class="btn ghost small" data-action="store-chat" data-id="${escapeHtml(o.id || "")}">${Number(o.storeChatUnread) > 0 ? `<i class="unread-dot" aria-label="unread"></i>` : ""}${escapeHtml(lang === "ar" ? "محادثة المتجر" : lang === "fr" ? "Discuter avec le magasin" : "Chat with store")}</button>` : ``}
                ${o.driverPhone || o.driverName ? `<button class="btn ghost small" data-action="chat" data-id="${escapeHtml(o.id || "")}">${Number(o.chatUnread) > 0 ? `<i class="unread-dot" aria-label="unread"></i>` : ""}${escapeHtml(lang === "ar" ? "دردشة" : lang === "fr" ? "Discussion" : "Chat")}</button>` : ``}
                ${["delivered", "done"].includes(st) ? `<button class="btn small" data-action="rate" data-id="${escapeHtml(o.id || "")}">${escapeHtml(o.customerRating && Number(o.customerRating.stars || 0) > 0 ? i18n[lang]?.editRating || (lang === "ar" ? "تعديل التقييم" : lang === "fr" ? "Modifier la note" : "Edit rating") : i18n[lang]?.rateOrder || (lang === "ar" ? "قيّم الطلب" : lang === "fr" ? "Noter la commande" : "Rate order"))}</button>` : ``}
                ${["delivered", "done"].includes(st) ? `<button class="btn small" data-action="reorder" data-id="${escapeHtml(o.id || "")}">${escapeHtml(lang === "ar" ? "إعادة الطلب" : lang === "fr" ? "Commander à nouveau" : "Reorder")}</button><button class="btn ghost small" data-action="receipt" data-id="${escapeHtml(o.id || "")}">${escapeHtml(lang === "ar" ? "الإيصال" : lang === "fr" ? "Reçu" : "Receipt")}</button>` : ``}
                ${o.canRateDriver ? `<button class="btn small" data-action="rate-driver" data-id="${escapeHtml(o.id || "")}">${escapeHtml(lang === "ar" ? "قيّم السائق" : lang === "fr" ? "Noter le livreur" : "Rate driver")}</button>` : ``}
                <button class="btn ghost small" data-action="contact" data-id="${escapeHtml(o.id || "")}" ${contactDisabled}>${escapeHtml(i18n[lang]?.contactOrder || "Contact")}</button>
                <button class="btn bad small" data-action="cancel" data-id="${escapeHtml(o.id || "")}" ${cancelDisabled}>${escapeHtml(i18n[lang]?.cancelOrder || "Cancel")}</button>
              `;
          })()}
        </div>
      </div>
    `;
    })
    .join("");
}

async function api(path, opts = {}) {
  const token = getToken();
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {},
  );

  // حجب التوكن القديم لو الطلب رايح لتسجيل الدخول أو إنشاء الحساب
  if (
    token &&
    !path.includes("/api/customer/login") &&
    !path.includes("/api/customer/signup")
  ) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || "Request failed";
    const e = new Error(err);
    e.code = data?.code || "";
    e.data = data;
    throw e;
  }
  return data;
}

/* /orders/?order=<id> (from a notification): scroll to that order and highlight it once */
let FOCUS_DONE = false;
function focusOrderFromUrl() {
  if (FOCUS_DONE) return;
  FOCUS_DONE = true;
  const id = new URLSearchParams(location.search).get("order");
  if (!id) return;
  if (ORDERS_FILTER !== "all") {
    ORDERS_FILTER = "all";
    renderOrdersFiltered();
  }
  const card = Array.from(document.querySelectorAll(".order-card")).find(
    (c) => c.getAttribute("data-oid") === id,
  );
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("order-focus");
  setTimeout(() => card.classList.remove("order-focus"), 2800);
}

async function loadMeAndOrders() {
  el("ordersHint").textContent = "";
  try {
    const me = await api("/api/customer/me");
    saveSession(getToken(), me.customer);
    renderProfile(me.customer);

    const ord = await api("/api/customer/orders");
    const newOrders = ord.orders || [];

    if (LAST_ORDERS.length > 0) {
      newOrders.forEach((newOrder) => {
        const oldOrder = LAST_ORDERS.find((o) => o.id === newOrder.id);
        if (oldOrder && oldOrder.status !== newOrder.status) {
          console.log(
            `Order ${newOrder.id} changed from ${oldOrder.status} to ${newOrder.status}`,
          );
          beep();
        }
      });
    }

    LAST_ORDERS = newOrders;
    renderOrdersFiltered();
    focusOrderFromUrl();

    await refreshNotificationsBadge();
    startNotifPoll();
  } catch (e) {
    // leaving the page (redirect / navigation) aborts in-flight requests: that is not a sign-out
    if (window.__siymonLeaving) return;
    console.error(e);
    clearSession();
    stopNotifPoll();
    showAuth();
  }
}

async function tryAutoLogin() {
  const token = getToken();
  if (!token) {
    showAuth();
    return;
  }

  const nxt = safeNextUrl();
  if (nxt) {
    window.location.replace(nxt);
    return;
  }

  showOrders();
  await loadMeAndOrders();
}

function stopNotifPoll() {
  if (NOTIF_POLL) {
    try {
      clearInterval(NOTIF_POLL);
    } catch (_e) {}
    NOTIF_POLL = null;
  }
}

function startNotifPoll() {
  stopNotifPoll();
  if (!getToken()) return;
  NOTIF_POLL = setInterval(
    () => refreshNotificationsBadge().catch(() => {}),
    30000,
  );
}

async function refreshNotificationsBadge() {
  if (!getToken()) {
    stopNotifPoll();
    return;
  }
  try {
    const res = await api("/api/customer/notifications");
    const unread = Number(res.unreadCount || 0);
    try {
      if (lastUnreadCount !== null && unread > lastUnreadCount) beep();
      lastUnreadCount = unread;
    } catch (_e) {}
  } catch (_e) {}
}

// أكواد حذف الحساب
el("btnDeleteAccount")?.addEventListener("click", async () => {
  const T = (ar, fr, en) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
  if (!confirm(T(
    "سيتم حذف حسابك وإخفاء بياناتك الشخصية. تُحفظ سجلات المعاملات المالية المطلوبة قانونيًا دون بياناتك الشخصية، ولا يمكن التراجع. متابعة؟",
    "Votre compte sera supprimé et vos données personnelles masquées. Les enregistrements financiers exigés par la loi sont conservés sans vos données personnelles. Irréversible. Continuer ?",
    "Your account will be deleted and your personal data hidden. Legally required transaction records are kept without your personal details. This cannot be undone. Continue?",
  ))) return;
  const typed = prompt(T(
    "للتأكيد أدخل كلمة المرور (أو اكتب DELETE إذا سجّلت عبر Google):",
    "Pour confirmer, saisissez votre mot de passe (ou DELETE si vous utilisez Google) :",
    "To confirm, enter your password (or type DELETE if you signed in with Google):",
  ));
  if (typed === null) return;
  try {
    await api("/api/customer/me", { method: "DELETE", body: JSON.stringify({ password: typed, confirm: typed }) });
    alert(T("تم حذف حسابك.", "Votre compte a été supprimé.", "Your account was deleted."));
    clearSession();
    window.location.reload();
  } catch (err) {
    const msg = {
      REAUTH_REQUIRED: T("كلمة المرور غير صحيحة.", "Mot de passe incorrect.", "Incorrect password."),
      ACTIVE_ORDERS: T("لديك طلبات قيد التنفيذ. انتظر اكتمالها أو إلغاءها أولًا.", "Vous avez des commandes en cours. Attendez qu'elles se terminent ou annulez-les.", "You have orders in progress. Wait for them to finish or cancel them first."),
      WALLET_BALANCE: T("لديك رصيد في المحفظة. تواصل مع الدعم لتسويته قبل الحذف.", "Votre portefeuille a un solde. Contactez le support avant la suppression.", "Your wallet has a balance. Contact support to settle it before deleting."),
    }[err.code];
    alert(msg || (T("حدث خطأ أثناء الحذف: ", "Erreur lors de la suppression : ", "Deletion failed: ") + err.message));
  }
});
// Events

el("tabLogin").addEventListener("click", () => setTab("login"));
el("tabSignup").addEventListener("click", () => setTab("signup"));
el("guestBtn")?.addEventListener("click", () => {
  window.location.href = "/";
});

el("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  el("loginHint").textContent = "";

  const id = String(el("loginId").value || "").trim();
  const pass = String(el("loginPass").value || "");
  if (!id) {
    el("loginHint").textContent = i18n[lang].errors.needLoginId;
    return;
  }
  if (!pass) {
    el("loginHint").textContent = i18n[lang].errors.needPassword;
    return;
  }

  const payload = { password: pass };
  if (id.includes("@")) payload.email = id;
  else payload.phone = normalizePhone(id);

  el("loginBtn").disabled = true;
  try {
    const out = await api("/api/customer/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveSession(out.token, out.customer);
    const nxt = safeNextUrl();
    if (nxt) {
      window.location.replace(nxt);
      return;
    }
    showOrders();
    await loadMeAndOrders();
  } catch (err) {
    el("loginHint").textContent = String(err.message || err);
  } finally {
    el("loginBtn").disabled = false;
  }
});

el("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  el("signupHint").textContent = "";

  const firstName = String(el("firstName").value || "").trim();
  const lastName = String(el("lastName").value || "").trim();
  const email = String(el("email").value || "").trim();
  const phone = normalizePhone(el("phone").value);
  const pass = String(el("pass").value || "");
  const pass2 = String(el("pass2").value || "");

  if (!firstName) {
    el("signupHint").textContent = i18n[lang].errors.needFirst;
    return;
  }
  if (!lastName) {
    el("signupHint").textContent = i18n[lang].errors.needLast;
    return;
  }
  // التعديل: التأكد من أن البريد الإلكتروني موجود وصحيح (يحتوي على @)
  if (!email || !email.includes("@")) {
    el("signupHint").textContent = i18n[lang].errors.needEmail;
    return;
  }
  if (!pass || pass.length < 6) {
    el("signupHint").textContent = i18n[lang].errors.shortPass;
    return;
  }
  if (!pass2) {
    el("signupHint").textContent = i18n[lang].errors.needPass2;
    return;
  }
  if (pass2 !== pass) {
    el("signupHint").textContent = i18n[lang].errors.passMismatch;
    return;
  }

  const policyEnabled = !!(PUBLIC && PUBLIC.companyPolicyEnabled);
  const policyRequired =
    policyEnabled && PUBLIC.companyPolicyRequireAccept !== false;
  const acceptPolicy = !!el("acceptPolicy")?.checked;
  if (policyRequired && !acceptPolicy) {
    el("signupHint").textContent = i18n[lang].errors.mustAcceptPolicy;
    return;
  }

  const payload = {
    firstName,
    lastName,
    email: email || undefined,
    phone: phone || undefined,
    password: pass,
    password2: pass2,
    acceptPolicy: !!el("acceptPolicy")?.checked,
  };

  el("signupBtn").disabled = true;
  try {
    const out = await api("/api/customer/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveSession(out.token, out.customer);
    const nxt = safeNextUrl();
    if (nxt) {
      window.location.replace(nxt);
      return;
    }
    showOrders();
    await loadMeAndOrders();
  } catch (err) {
    el("signupHint").textContent = String(err.message || err);
  } finally {
    el("signupBtn").disabled = false;
  }
});

el("soundToggle")?.addEventListener("click", () => setSound(!soundEnabled));
el("refreshOrders").addEventListener("click", async () => {
  el("ordersHint").textContent = "";
  el("refreshOrders").disabled = true;
  el("refreshOrders").classList.add("spin");
  try {
    await loadMeAndOrders();
  } catch (e) {
    el("ordersHint").textContent = String(e.message || e);
  } finally {
    el("refreshOrders").disabled = false;
    el("refreshOrders").classList.remove("spin");
  }
});

el("ordersList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (!action || !id) return;

  const order =
    (LAST_ORDERS || []).find((o) => String(o.id || "") === String(id)) || null;

  if (action === "rate") {
    openRating(id);
    return;
  }

  if (action === "store-chat") {
    if (!order) return;
    window.location.href = "/chat/?store=" + encodeURIComponent(String(order.id || ""));
    return;
  }

  if (action === "chat") {
    if (!order) {
      return;
    }
    window.location.href =
      "/chat/?order=" + encodeURIComponent(String(order.id || ""));
    return;
  }

  if (action === "contact") {
    const phone =
      String((order && order.driverPhone) || "").trim() ||
      String((PUBLIC && PUBLIC.supportPhone) || "").trim();
    if (!phone) {
      alert(
        lang === "ar"
          ? "رقم الاتصال غير متوفر."
          : lang === "fr"
            ? "Numéro non disponible."
            : "Phone number not available.",
      );
      return;
    }
    window.location.href = "tel:" + phone;
    return;
  }

  if (action === "cancel") {
    if (btn.hasAttribute("disabled")) return;
    const t = i18n[lang] || i18n.ar;
    const ok = confirm(t.confirmCancel || "Cancel?");
    if (!ok) return;
    try {
      await api(`/api/customer/orders/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      });
      await loadMeAndOrders();
    } catch (err) {
      alert("❌ " + (err.message || err));
    }
  }
});

let RATING_ORDER_ID = null;
let RATING_STARS = 0;

function showRating(show) {
  const m = el("ratingModal");
  if (!m) return;
  m.classList.toggle("show", !!show);
  if (!show) {
    RATING_ORDER_ID = null;
    RATING_STARS = 0;
    el("ratingHint") && (el("ratingHint").textContent = "");
  }
}

function setRatingStars(n) {
  RATING_STARS = Number(n || 0);
  const row = el("starsRow");
  if (!row) return;
  row.querySelectorAll(".star-btn").forEach((b) => {
    const v = Number(b.getAttribute("data-star") || 0);
    b.classList.toggle("active", v <= RATING_STARS);
  });
}

function openRating(orderId) {
  const id = String(orderId || "");
  const order =
    (LAST_ORDERS || []).find((o) => String(o.id || "") === id) || null;
  if (!order) return;
  const t = i18n[lang] || i18n.ar;

  RATING_ORDER_ID = id;
  el("ratingHint") && (el("ratingHint").textContent = "");

  const meta = el("ratingMeta");
  if (meta) {
    const rest = String(order.restaurantName || order.restaurantId || "");
    meta.textContent = rest ? `#${id} • ${rest}` : `#${id}`;
  }

  const existing = order.customerRating || null;
  const exStars = existing ? Number(existing.stars || 0) : 0;
  setRatingStars(exStars || 0);
  const c = el("ratingComment");
  if (c) c.value = existing && existing.comment ? String(existing.comment) : "";

  showRating(true);
}

async function submitRating() {
  if (!RATING_ORDER_ID) return;
  const t = i18n[lang] || i18n.ar;
  const hint = el("ratingHint");
  if (RATING_STARS < 1) {
    if (hint) hint.textContent = t.ratingNeedStars || "Select rating";
    return;
  }
  const comment = String(el("ratingComment")?.value || "").trim();
  try {
    if (hint) hint.textContent = "";
    await api(
      `/api/customer/orders/${encodeURIComponent(RATING_ORDER_ID)}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ stars: RATING_STARS, comment }),
      },
    );
    if (hint) hint.textContent = t.ratingSaved || "Saved";
    showRating(false);
    await loadMeAndOrders();
  } catch (e) {
    if (hint) hint.textContent = "❌ " + (e.message || e);
  }
}


el("closeRatingBtn")?.addEventListener("click", () => showRating(false));
el("cancelRatingBtn")?.addEventListener("click", () => showRating(false));
el("starsRow")?.addEventListener("click", (e) => {
  const b = e.target && e.target.closest && e.target.closest(".star-btn");
  if (!b) return;
  const v = Number(b.getAttribute("data-star") || 0);
  if (v) setRatingStars(v);
});
el("submitRatingBtn")?.addEventListener("click", () =>
  submitRating().catch(() => {}),
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  navigator.serviceWorker.addEventListener("message", (ev) => {
    const d = ev && ev.data ? ev.data : null;
    if (d && d.type === "OPEN_NOTIFICATIONS") {
      window.location.href = "/notifications/";
    }
    if (d && d.type === "PUSH_NOTIFICATION") {
      try {
        beep();
      } catch (_e) {}
      refreshNotificationsBadge().catch(() => {});
    }
  });
}

// Init
(async function init() {
  if (window.__siymonLeaving) return; // redirecting to /notifications/ or /chat/
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);

  updateSoundBtn();
  document.addEventListener("pointerdown", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });
  document.addEventListener("touchstart", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });
  document.addEventListener("keydown", unlockAudio, {
    once: true,
    passive: true,
    capture: true,
  });

  await loadPublicConfig();
  setLang(lang);
  setTab("login");
  tryAutoLogin();
})();
