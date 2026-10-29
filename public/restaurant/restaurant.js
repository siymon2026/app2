/* global */

const el = (id) => document.getElementById(id);

const ICONS = {
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Zm17 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2ZM5.2 5.2a1 1 0 0 1 1.4 0l.7.7A1 1 0 1 1 5.9 7.3l-.7-.7a1 1 0 0 1 0-1.4Zm12.2 12.2a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM18.8 5.2a1 1 0 0 1 0 1.4l-.7.7A1 1 0 1 1 16.7 5.9l.7-.7a1 1 0 0 1 1.4 0ZM7.3 16.7a1 1 0 0 1 0 1.4l-.7.7a1 1 0 1 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0Z"/></svg>`,
};

const THEME_KEY = "siymon_theme_v3";
const LANG_KEY = "siymon_lang_v1";
const TOKEN_KEY = "siymon_restaurant_token_v1";
const REST_PROFILE_KEY = "siymon_restaurant_profile_v1";
// Embedded admin impersonation must not replace a restaurant owner's existing session.
const authStorage = window.parent !== window && new URLSearchParams(location.search).get("adminEmbed") === "1" ? sessionStorage : localStorage;

const SOUND_KEY = "siymon_rest_sound_v1";
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "0";
const ORDER_SOUND_URL = "/sounds/order.mp3";
let orderAudio = null;
let audioCtx = null;
let audioUnlocked = false;

function showSoundGate(msg) {
  const gate = el("soundGate");
  if (!gate) return;
  const t = el("soundGateText");
  if (t && msg) t.textContent = msg;
  gate.style.display = "flex";
}
function hideSoundGate() {
  const gate = el("soundGate");
  if (!gate) return;
  gate.style.display = "none";
}

let firstOrdersLoad = true;
let seenOrderIds = new Set();
let prevStatusById = new Map();

const LANGS = ["ar", "en", "fr"];
let lang = localStorage.getItem(LANG_KEY) || "ar";
// Super admin "enter portal": /restaurant/#admintoken=... (fragment) signs in without a password
try {
  const hp = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  if (hp.get("admintoken")) {
    authStorage.setItem(TOKEN_KEY, hp.get("admintoken"));
    authStorage.removeItem(REST_PROFILE_KEY);
    history.replaceState(null, "", location.pathname + location.search);
  }
} catch (_e) {}
let token = authStorage.getItem(TOKEN_KEY) || null;
let me = null;

let orders = [];
let selectedId = null;
let pollTimer = null;

// Keep the receipt editor open during polling updates
let EDIT_TICKET_OPEN = false;
let EDIT_TICKET_ORDER_ID = null;

// Web Bluetooth state (for ESC/POS printers)
const BT = {
  device: null,
  server: null,
  characteristic: null,
  connected: false,
};

// Views
let view = "orders"; // orders | products
let menuItems = [];
let editingItemId = null;

const i18n = {
  ar: {
    dir: "rtl",
    title: "بوابة المطعم",
    sub: "جدول الطلبات",
    welcome: "مرحباً بكم في siymon",
    welcomeText: "سجّل الدخول لعرض الطلبات الخاصة بمطعمك.",
    refresh: "تحديث",
    logout: "خروج",
    soundOn: "🔔 الصوت: تشغيل",
    soundOff: "🔕 الصوت: إيقاف",
    newOrder: "طلب جديد",
    loginTitle: "تسجيل دخول المطعم",
    loginId: "الجمايل أو رقم الهاتف",
    password: "كلمة السر",
    login: "دخول",
    tabOrders: "الطلبات",
    tabProducts: "المنتجات",
    prodTitle: "إضافة / تعديل منتوج",
    prodName: "اسم المنتوج",
    prodPrice: "الثمن",
    prodCat: "مفتاح الصنف",
    prodCatName: "اسم الصنف",
    prodImg: "صورة الوجبة",
    uploadHint: "اختر صورة للوجبة (رفع مباشر)",
    uploading: "جاري رفع الصورة...",
    uploadOk: "تم رفع الصورة ✅",
    uploadFail: "فشل رفع الصورة",
    prodDesc: "الوصف",
    prodAvail: "متوفر",
    save: "حفظ",
    prodSearch: "ابحث باسم المنتوج / الصنف",
    productsEmpty: "لا توجد منتجات.",
    edit: "تعديل",
    delete: "حذف",
    hide: "إخفاء",
    show: "إظهار",
    searchPh: "ابحث برقم الطلب / اسم الزبون / الهاتف",
    thId: "رقم",
    thTime: "الوقت",
    thCustomer: "الزبون",
    thTotal: "الإجمالي",
    thStatus: "الحالة",
    thActions: "إجراءات",
    details: "تفاصيل الطلب",
    detailsEmpty: "اختر طلباً لعرض التفاصيل.",
    ready: "قبول",
    waitAdmin: "بانتظار قبول المشرف",
    print: "طباعة",
    printTitle: "طباعة",
    close: "إغلاق",

    connectBt: "اتصال BT",
    btConnected: "BT متصل",
    htmlPrint: "طباعة (Ticket)",
    wifiPrint: "طباعة Wi‑Fi",
    btPrint: "طباعة BT",

    editTicket: "✏️ تعديل التيكيت",
    itemName: "المنتج",
    qty: "الكمية",
    unitPrice: "الثمن",
    subtotal: "المجموع الفرعي",
    deliveryFee: "رسوم التوصيل",
    total: "المجموع",
    addLine: "+ سطر",
    saveChanges: "حفظ التعديل",
    errors: {
      needId: "أدخل الجمايل أو رقم الهاتف.",
      needPass: "أدخل كلمة السر.",
      btUnsupported: "المتصفح لا يدعم Web Bluetooth.",
      btConnectFail: "فشل اتصال BT.",
    },
    status: {
      new: "جديد",
      admin_accepted: "في انتظار قبول المطعم",
      restaurant_ready: "مُرسل للسائقين",
      accepted: "قبل السائق",
      picked_up: "تم الاستلام",
      on_the_way: "في الطريق",
      delivered: "تم التسليم",
      done: "منتهي",
      canceled: "ملغي",
      sent: "تم الإرسال",
    },
    currency: "MAD",
    items: "المنتجات",
    name: "الاسم",
    phone: "الهاتف",
    address: "العنوان",
    notes: "ملاحظة",
  },
  en: {
    dir: "ltr",
    title: "Restaurant Portal",
    sub: "Orders table",
    welcome: "Welcome to siymon",
    welcomeText: "Log in to view orders for your restaurant.",
    refresh: "Refresh",
    logout: "Logout",
    soundOn: "🔔 Sound: ON",
    soundOff: "🔕 Sound: OFF",
    newOrder: "New order",
    loginTitle: "Restaurant Login",
    loginId: "Email or phone",
    password: "Password",
    login: "Login",
    tabOrders: "Orders",
    tabProducts: "Products",
    prodTitle: "Add / Edit product",
    prodName: "Name",
    prodPrice: "Price",
    prodCat: "Category key",
    prodCatName: "Category title",
    prodImg: "Meal image",
    uploadHint: "Choose a meal image (upload)",
    uploading: "Uploading image...",
    uploadOk: "Image uploaded ✅",
    uploadFail: "Image upload failed",
    prodDesc: "Description",
    prodAvail: "Available",
    save: "Save",
    prodSearch: "Search product / category",
    productsEmpty: "No products.",
    edit: "Edit",
    delete: "Delete",
    hide: "Hide",
    show: "Show",
    searchPh: "Search by order ID / customer / phone",
    thId: "ID",
    thTime: "Time",
    thCustomer: "Customer",
    thTotal: "Total",
    thStatus: "Status",
    thActions: "Actions",
    details: "Order details",
    detailsEmpty: "Select an order to view details.",
    ready: "Accept",
    waitAdmin: "Waiting admin approval",
    print: "Print",
    printTitle: "Print",
    close: "Close",

    connectBt: "Connect BT",
    btConnected: "BT Connected",
    htmlPrint: "Print ticket",
    wifiPrint: "Wi‑Fi print",
    btPrint: "BT print",

    editTicket: "✏️ Edit ticket",
    itemName: "Item",
    qty: "Qty",
    unitPrice: "Unit",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    total: "Total",
    addLine: "+ Line",
    saveChanges: "Save changes",
    errors: {
      needId: "Enter email or phone.",
      needPass: "Enter password.",
      btUnsupported: "Web Bluetooth is not supported in this browser.",
      btConnectFail: "BT connection failed.",
    },
    status: {
      new: "New",
      admin_accepted: "Waiting restaurant acceptance",
      restaurant_ready: "Sent to drivers",
      accepted: "Driver accepted",
      picked_up: "Picked up",
      on_the_way: "On the way",
      delivered: "Delivered",
      done: "Done",
      canceled: "Canceled",
      sent: "Sent",
    },
    currency: "MAD",
    items: "Items",
    name: "Name",
    phone: "Phone",
    address: "Address",
    notes: "Notes",
  },
  fr: {
    dir: "ltr",
    title: "Portail Restaurant",
    sub: "Table des commandes",
    welcome: "Bienvenue sur siymon",
    welcomeText: "Connectez‑vous pour voir les commandes de votre restaurant.",
    refresh: "Actualiser",
    logout: "Déconnexion",
    soundOn: "🔔 Son: ON",
    soundOff: "🔕 Son: OFF",
    newOrder: "Nouvelle commande",
    loginTitle: "Connexion Restaurant",
    loginId: "Email ou téléphone",
    password: "Mot de passe",
    login: "Connexion",
    tabOrders: "Commandes",
    tabProducts: "Produits",
    prodTitle: "Ajouter / Modifier un produit",
    prodName: "Nom",
    prodPrice: "Prix",
    prodCat: "Clé catégorie",
    prodCatName: "Titre catégorie",
    prodImg: "Image du plat",
    uploadHint: "Choisir une image du plat (téléversement)",
    uploading: "Téléversement...",
    uploadOk: "Image téléversée ✅",
    uploadFail: "Échec du téléversement",
    prodDesc: "Description",
    prodAvail: "Disponible",
    save: "Enregistrer",
    prodSearch: "Rechercher produit / catégorie",
    productsEmpty: "Aucun produit.",
    edit: "Modifier",
    delete: "Supprimer",
    hide: "Masquer",
    show: "Afficher",
    searchPh: "Rechercher par N° / client / téléphone",
    thId: "N°",
    thTime: "Heure",
    thCustomer: "Client",
    thTotal: "Total",
    thStatus: "Statut",
    thActions: "Actions",
    details: "Détails",
    detailsEmpty: "Sélectionnez une commande pour voir les détails.",
    ready: "Accepter",
    waitAdmin: "En attente d'approbation admin",
    print: "Imprimer",
    printTitle: "Imprimer",
    close: "Fermer",

    connectBt: "Connexion BT",
    btConnected: "BT Connecté",
    htmlPrint: "Imprimer ticket",
    wifiPrint: "Impression Wi‑Fi",
    btPrint: "Impression BT",

    editTicket: "✏️ Modifier ticket",
    itemName: "Article",
    qty: "Qté",
    unitPrice: "Prix",
    subtotal: "Sous-total",
    deliveryFee: "Livraison",
    total: "Total",
    addLine: "+ Ligne",
    saveChanges: "Enregistrer",
    errors: {
      needId: "Entrez email ou téléphone.",
      needPass: "Entrez le mot de passe.",
      btUnsupported: "Web Bluetooth n’est pas pris en charge.",
      btConnectFail: "Échec de la connexion BT.",
    },
    status: {
      new: "Nouveau",
      admin_accepted: "Acceptée par admin",
      restaurant_ready: "Envoyé aux chauffeurs",
      accepted: "Acceptée par livreur",
      picked_up: "Récupérée",
      on_the_way: "En route",
      delivered: "Livrée",
      done: "Terminée",
      canceled: "Annulée",
      sent: "Envoyée",
    },
    currency: "MAD",
    items: "Articles",
    name: "Nom",
    phone: "Téléphone",
    address: "Adresse",
    notes: "Note",
  },
};

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

function toast(msg) {
  const t = el("toast");
  if (!t) return;
  t.textContent = String(msg || "");
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  el("themeToggle").innerHTML = saved === "dark" ? ICONS.sun : ICONS.moon;
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  el("themeToggle").innerHTML = next === "dark" ? ICONS.sun : ICONS.moon;
}

function nextLangLabel() {
  const idx = LANGS.indexOf(lang);
  const next = LANGS[(idx + 1) % LANGS.length];
  return next.toUpperCase();
}

function cycleLang() {
  const idx = LANGS.indexOf(lang);
  lang = LANGS[(idx + 1) % LANGS.length];
  localStorage.setItem(LANG_KEY, lang);
  applyI18n();
  render();
}

function updateSoundBtn() {
  const t = i18n[lang] || i18n.en;
  const btn = el("soundToggle");
  if (!btn) return;
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
    if (!orderAudio) {
      orderAudio = new Audio(ORDER_SOUND_URL);
      orderAudio.preload = "auto";
    }

    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === "suspended")
        audioCtx.resume().catch(() => {});
    } catch (_e) {}

    const prevVol = orderAudio.volume;
    orderAudio.volume = 0.001;
    orderAudio.muted = false;

    const p = orderAudio.play();
    if (p && p.then) {
      p.then(() => {
        audioUnlocked = true;
        hideSoundGate();
        try {
          orderAudio.pause();
          orderAudio.currentTime = 0;
        } catch (_e) {}
        orderAudio.volume = prevVol;
      }).catch(() => {
        orderAudio.volume = prevVol;
        audioUnlocked = false;
        showSoundGate();
      });
    } else {
      audioUnlocked = true;
      hideSoundGate();
      try {
        orderAudio.pause();
        orderAudio.currentTime = 0;
      } catch (_e) {}
      orderAudio.volume = prevVol;
    }
  } catch (_e) {
    audioUnlocked = false;
    showSoundGate();
  }
}

function playNewOrderSound() {
  if (!soundEnabled) return;
  unlockAudio();
  try {
    if (!orderAudio) {
      orderAudio = new Audio(ORDER_SOUND_URL);
    }

    // إعادة تشغيل الصوت بأقصى قوة
    orderAudio.currentTime = 0;
    orderAudio.volume = 1.0;

    const playPromise = orderAudio.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // لو المتصفح عمل بلوك للصوت، نشغل الذبذبة البديلة القوية
        try {
          if (!audioCtx)
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = "sine";
          o.frequency.value = 880;
          g.gain.value = 0.1; // صوت عالٍ للذبذبة
          o.connect(g);
          g.connect(audioCtx.destination);
          o.start();
          setTimeout(() => {
            try {
              o.stop();
            } catch (_e) {}
          }, 250);
        } catch (_e) {}
      });
    }

    // اهتزاز للموبايل
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (_e) {}
  } catch (_e) {
    /* ignore */
  }
}

function applyI18n() {
  const t = i18n[lang] || i18n.en;
  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir;

  el("brandTitle").textContent = `siymon ${t.title}`;
  el("brandSub").textContent = t.sub;
  el("langToggle").textContent = nextLangLabel();
  updateSoundBtn();
  el("logoutBtn").textContent = t.logout;
  el("refreshBtn").textContent = t.refresh;

  // Bluetooth button label
  updateBtBtn();

  el("welcomePill").textContent = t.welcome;
  el("welcomeTitle").textContent = t.welcome;
  el("welcomeText").textContent = t.welcomeText;

  el("authTitle").textContent = t.loginTitle;
  el("loginIdLabel").textContent = t.loginId;
  el("loginPassLabel").textContent = t.password;
  el("loginBtn").textContent = t.login;

  el("tabOrders").textContent = t.tabOrders;
  el("tabProducts").textContent = t.tabProducts;

  // Search placeholder depends on active view
  el("searchInput").placeholder =
    view === "products" ? t.prodSearch || t.searchPh : t.searchPh;

  el("thId").textContent = t.thId;
  el("thTime").textContent = t.thTime;
  el("thCustomer").textContent = t.thCustomer;
  el("thTotal").textContent = t.thTotal;
  el("thStatus").textContent = t.thStatus;
  el("thActions").textContent = t.thActions;

  // Products table
  el("pthName") && (el("pthName").textContent = t.prodName);
  el("pthCat") &&
    (el("pthCat").textContent =
      lang === "ar" ? "الصنف" : lang === "fr" ? "Catégorie" : "Category");
  el("pthPrice") && (el("pthPrice").textContent = t.prodPrice);
  el("pthAvail") &&
    (el("pthAvail").textContent =
      lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status");
  el("pthAct") && (el("pthAct").textContent = t.thActions);

  // Product form
  el("prodTitle") && (el("prodTitle").textContent = t.prodTitle);
  el("prodNameLabel") && (el("prodNameLabel").textContent = t.prodName);
  el("prodPriceLabel") && (el("prodPriceLabel").textContent = t.prodPrice);
  el("prodCatLabel") && (el("prodCatLabel").textContent = t.prodCat);
  el("prodCatNameLabel") &&
    (el("prodCatNameLabel").textContent = t.prodCatName);
  el("prodImgLabel") && (el("prodImgLabel").textContent = t.prodImg);
  el("prodImgHint") && (el("prodImgHint").textContent = t.uploadHint || "");
  el("prodDescLabel") && (el("prodDescLabel").textContent = t.prodDesc);
  el("prodAvailLabel") && (el("prodAvailLabel").textContent = t.prodAvail);
  el("saveProdBtn") && (el("saveProdBtn").textContent = t.save);
  el("prodTip") &&
    (el("prodTip").textContent =
      lang === "ar"
        ? "ملاحظة: الاسم والوصف يُحفظان لكل اللغات تلقائياً."
        : lang === "fr"
          ? "Astuce : le nom/la description sont enregistrés pour toutes les langues automatiquement."
          : "Tip: name/description are saved for all languages automatically.");
  el("detailsTitle").textContent = t.details;
  if (!selectedId) el("detailsBox").textContent = t.detailsEmpty;
  el("printTitle").textContent = t.printTitle;
  el("doPrintBtn").textContent = t.print;
}

function updateBtBtn() {
  const t = i18n[lang] || i18n.en;
  const txt = BT.connected ? t.btConnected : t.connectBt;
  if (el("btText")) el("btText").textContent = txt;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

async function uploadMealImageRestaurant(file) {
  const hint = el("prodImgHint");
  const prev = el("prodImgPrev");
  const hidden = el("prodImg");
  const t = i18n[lang] || i18n.en;
  if (!file) {
    if (hidden) hidden.value = "";
    if (prev) {
      prev.src = "";
      prev.style.display = "none";
    }
    if (hint) hint.textContent = t.uploadHint || "";
    return;
  }

  try {
    if (prev) {
      const localUrl = await fileToDataUrl(file).catch(() => "");
      if (localUrl) {
        prev.src = localUrl;
        prev.style.display = "block";
      }
    }
    if (hint) hint.textContent = t.uploading || "Uploading...";
    const dataUrl = await fileToDataUrl(file);
    const res = await api("/api/restaurant/upload/menu-image", {
      method: "POST",
      body: JSON.stringify({ image: dataUrl }),
    });
    if (hidden) hidden.value = String(res.url || "");
    if (prev && res.url) {
      prev.src = String(res.url);
      prev.style.display = "block";
    }
    if (hint) hint.textContent = t.uploadOk || "Uploaded";
  } catch (e) {
    if (hint)
      hint.textContent =
        (t.uploadFail || "Upload failed") +
        (e && e.message ? " — " + e.message : "");
  }
}

async function api(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, {
    "Content-Type": "application/json",
  });
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  let body = null;
  try {
    body = await res.json();
  } catch (_e) {
    body = null;
  }
  if (!res.ok) {
    const err = body?.error || `HTTP ${res.status}`;
    const e = new Error(err);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body;
}

function showLoggedIn(isOn) {
  el("authCard").style.display = isOn ? "none" : "block";
  el("appPanel").style.display = isOn ? "grid" : "none";
}

function statusLabel(st) {
  const t = i18n[lang] || i18n.en;
  const key = String(st || "new");
  return t.status[key] || key;
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

function fmtDate(iso) {
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
  } catch (_e) {
    return String(iso || "");
  }
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    return d.toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_e) {
    return String(iso || "");
  }
}

function money(v, currency) {
  const n = Number(v || 0);
  const cur = String(currency || i18n[lang]?.currency || "MAD");
  return `${n.toFixed(2)} ${cur}`;
}

function textForLang(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object")
    return String(v[lang] || v.en || v.ar || v.fr || "");
  return String(v);
}

function setView(next) {
  view = next === "products" ? "products" : "orders";
  el("tabOrders")?.classList.toggle("active", view === "orders");
  el("tabProducts")?.classList.toggle("active", view === "products");
  el("ordersLeft") &&
    (el("ordersLeft").style.display = view === "orders" ? "block" : "none");
  el("productsLeft") &&
    (el("productsLeft").style.display = view === "products" ? "block" : "none");
  el("ordersRight") &&
    (el("ordersRight").style.display = view === "orders" ? "block" : "none");
  el("productsRight") &&
    (el("productsRight").style.display =
      view === "products" ? "block" : "none");
  applyI18n();
  render();
  if (view === "products" && token) loadProducts(true);
}

function clearProductForm() {
  editingItemId = null;
  el("prodName").value = "";
  el("prodPrice").value = "";
  el("prodCat").value = "";
  el("prodCatName").value = "";
  el("prodImg").value = "";
  el("prodDesc").value = "";
  el("prodAvail").value = "1";
  el("prodHint").textContent = "";
  const f = el("prodImgFile");
  if (f) f.value = "";
  const prev = el("prodImgPrev");
  if (prev) {
    prev.src = "";
    prev.style.display = "none";
  }
  const hint = el("prodImgHint");
  if (hint) {
    const tt = i18n[lang] || i18n.en;
    hint.textContent = tt.uploadHint || "";
  }
}

async function loadProducts(silent = false) {
  if (!token) return;
  try {
    const res = await api("/api/restaurant/menu", { method: "GET" });
    menuItems = Array.isArray(res.items) ? res.items : [];
    if (!silent) toast("✅");
    render();
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      doLogout();
    } else {
      toast(e.message);
    }
  }
}

function startEditProduct(it) {
  if (!it) return;
  editingItemId = String(it.id);
  el("prodName").value = textForLang(it.name);
  el("prodPrice").value = String(Number(it.price || 0));
  el("prodCat").value = String(it.cat || "");
  el("prodCatName").value = textForLang(it.catLabel || it.cat || "");
  el("prodImg").value = String(it.img || "");
  const prev = el("prodImgPrev");
  if (prev) {
    const u = String(it.img || "");
    if (u) {
      prev.src = u;
      prev.style.display = "block";
    } else {
      prev.src = "";
      prev.style.display = "none";
    }
  }
  const f = el("prodImgFile");
  if (f) f.value = "";
  const hint = el("prodImgHint");
  if (hint) {
    const tt = i18n[lang] || i18n.en;
    hint.textContent = tt.uploadHint || "";
  }
  el("prodDesc").value = textForLang(it.desc || "");
  el("prodAvail").value = it.isAvailable !== false ? "1" : "0";
  el("prodHint").textContent = "";
  toast("✏️ " + (i18n[lang]?.edit || "Edit"));
}

async function saveProduct() {
  const t = i18n[lang] || i18n.en;
  if (!token) return;
  const name = el("prodName").value.trim();
  const price = Number(el("prodPrice").value || 0);
  const cat = el("prodCat").value.trim() || "general";
  const catLabel = el("prodCatName").value.trim() || cat;
  const img = el("prodImg").value.trim();
  const desc = el("prodDesc").value.trim();
  const isAvailable = el("prodAvail").value === "1";

  el("prodHint").textContent = "";
  if (!name) {
    el("prodHint").textContent =
      lang === "ar"
        ? "أدخل اسم المنتوج"
        : lang === "fr"
          ? "Entrez le nom"
          : "Enter name";
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    el("prodHint").textContent =
      lang === "ar"
        ? "الثمن غير صحيح"
        : lang === "fr"
          ? "Prix invalide"
          : "Invalid price";
    return;
  }

  const payload = { name, price, cat, catLabel, img, desc, isAvailable };

  try {
    if (editingItemId) {
      await api(`/api/restaurant/menu/${encodeURIComponent(editingItemId)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/restaurant/menu", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    toast("✅ " + (t.save || "Save"));
    clearProductForm();
    await loadProducts(true);
  } catch (e) {
    el("prodHint").textContent = e.message;
  }
}

async function toggleProductAvail(id) {
  const it = (menuItems || []).find((x) => String(x.id) === String(id));
  if (!it) return;
  try {
    await api(`/api/restaurant/menu/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ isAvailable: it.isAvailable === false }),
    });
    await loadProducts(true);
  } catch (e) {
    toast(e.message);
  }
}

async function deleteProduct(id) {
  if (
    !confirm(
      lang === "ar"
        ? "حذف المنتوج؟"
        : lang === "fr"
          ? "Supprimer le produit ?"
          : "Delete product?",
    )
  )
    return;
  try {
    await api(`/api/restaurant/menu/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (String(editingItemId) === String(id)) clearProductForm();
    await loadProducts(true);
    toast("✅");
  } catch (e) {
    toast(e.message);
  }
}

function renderOrders() {
  const body = el("ordersBody");
  const t = i18n[lang] || i18n.en;
  const q = el("searchInput").value.trim().toLowerCase();

  const list = Array.isArray(orders) ? orders.slice() : [];
  list.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  const filtered = q
    ? list.filter((o) => {
        const id = String(o.id || "").toLowerCase();
        const name = String(o.customer?.name || "").toLowerCase();
        const phone = String(o.customer?.phone || "").toLowerCase();
        return id.includes(q) || name.includes(q) || phone.includes(q);
      })
    : list;

  el("tableHint").textContent = `(${filtered.length})`;

  body.innerHTML =
    filtered
      .map((o) => {
        const st = String(o.status || "new");
        const canReady = ["admin_accepted", "restaurant_ready"].includes(st);
        const isReady = st === "restaurant_ready";

        // ✅ If the order is still NEW (not accepted by admin), show a clear disabled state
        const btnReady =
          st === "new"
            ? `<button class="btn small ghost" disabled title="${escapeHtml(t.waitAdmin)}">${escapeHtml(t.waitAdmin)}</button>`
            : `<button class="btn small ${isReady ? "good" : "ghost"}" data-action="ready" data-id="${escapeHtml(o.id)}" ${!canReady || isReady ? "disabled" : ""}>${escapeHtml(t.ready)}</button>`;
        const btnPrint = `<button class="btn small" data-action="print" data-id="${escapeHtml(o.id)}">${escapeHtml(t.print)}</button>`;

        return `
      <tr class="row-click" data-row="${escapeHtml(o.id)}">
        <td><b>#${escapeHtml(o.id || "")}</b></td>
        <td>${escapeHtml(fmtDate(o.createdAt))}</td>
        <td>
          <b>${escapeHtml(o.customer?.name || "")}</b><br/>
          <small class="muted">${escapeHtml(o.customer?.phone || "")}</small>
        </td>
        <td><b>${escapeHtml(money(o.total, o.currency))}</b></td>
        <td><span class="${statusClass(o.status)}">${escapeHtml(statusLabel(o.status))}</span></td>
        <td class="row-actions">${btnReady} ${btnPrint}</td>
      </tr>
    `;
      })
      .join("") ||
    `<tr><td colspan="6" class="muted" style="padding:16px">${lang === "ar" ? "لا توجد طلبات." : lang === "fr" ? "Aucune commande." : "No orders."}</td></tr>`;

  if (selectedId) {
    const o = orders.find((x) => String(x.id) === String(selectedId));
    if (o) {
      // Avoid rebuilding details while the receipt editor is open & being edited
      const det = document.querySelector("#editTicketDetails");
      const editorOpen = !!(
        det &&
        det.open &&
        String(EDIT_TICKET_ORDER_ID) === String(o.id)
      );
      const activeInEditor = !!(
        document.activeElement &&
        document.activeElement.closest &&
        document.activeElement.closest("#editTicketDetails")
      );
      if (!editorOpen && !activeInEditor) showDetails(o);
    } else {
      selectedId = null;
      el("detailsBox").textContent = t.detailsEmpty;
    }
  }
}

/***********************
 * Ticket (same as admin): preview + HTML/Wi‑Fi/BT + edit lines
 ***********************/
function ticketTexts(code) {
  const c = code === "fr" ? "fr" : code === "en" ? "en" : "ar";
  const map = {
    ar: {
      dir: "rtl",
      order: "طلب",
      name: "الاسم",
      phone: "الهاتف",
      address: "العنوان",
      notes: "ملاحظة",
      subtotal: "المجموع",
      delivery: "التوصيل",
      total: "الإجمالي",
    },
    en: {
      dir: "ltr",
      order: "Order",
      name: "Name",
      phone: "Phone",
      address: "Address",
      notes: "Notes",
      subtotal: "Subtotal",
      delivery: "Delivery",
      total: "Total",
    },
    fr: {
      dir: "ltr",
      order: "Commande",
      name: "Nom",
      phone: "Téléphone",
      address: "Adresse",
      notes: "Notes",
      subtotal: "Sous-total",
      delivery: "Livraison",
      total: "Total",
    },
  };
  return map[c];
}

function getOrderRestaurantName(_order) {
  const n = me?.name;
  if (!n) return "siymon";
  if (typeof n === "string") return n;
  return String(n[lang] || n.en || n.ar || n.fr || "siymon");
}

function receiptTexts() {
  return {
    ar: {
      order: "طلب",
      name: "الاسم",
      phone: "الهاتف",
      address: "العنوان",
      notes: "ملاحظة",
      qtyItem: "الكمية المنتج",
      total: "المجموع",
      subtotal: "المجموع",
      delivery: "التوصيل",
      thanks: "شكراً لثقتكم",
    },
    en: {
      order: "ORDER",
      name: "Name",
      phone: "Phone",
      address: "Address",
      notes: "Notes",
      qtyItem: "QTY ITEM",
      total: "TOTAL",
      subtotal: "Subtotal",
      delivery: "Delivery",
      thanks: "Thank you",
    },
    fr: {
      order: "COMMANDE",
      name: "Nom",
      phone: "Téléphone",
      address: "Adresse",
      notes: "Notes",
      qtyItem: "QTE ARTICLE",
      total: "TOTAL",
      subtotal: "Sous-total",
      delivery: "Livraison",
      thanks: "Merci",
    },
  };
}

function buildReceiptTextBlock(order) {
  const tx = receiptTexts();
  const c = order.lang === "fr" ? "fr" : order.lang === "en" ? "en" : "ar";
  const t = tx[c];
  const WIDTH = 32;
  const sep = "--------------------------------";
  const moneyStr = (n) =>
    Number(n || 0).toFixed(2) + " " + (order.currency || "MAD");
  const lines = [];
  const line = (left, right, width = WIDTH) => {
    let l = String(left || "");
    const r = String(right || "");
    if (l.length + r.length + 1 > width) {
      l = l.slice(0, Math.max(0, width - r.length - 1));
    }
    const spaces = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(spaces) + r;
  };
  lines.push(getOrderRestaurantName(order));
  lines.push(`${t.order} #${order.id}`);
  lines.push(fmtTime(order.createdAt));
  lines.push(sep);
  lines.push(`${t.name}: ${order.customer?.name || ""}`);
  lines.push(`${t.phone}: ${order.customer?.phone || ""}`);
  lines.push(`${t.address}: ${order.customer?.addr || ""}`);
  if (order.customer?.notes) lines.push(`${t.notes}: ${order.customer?.notes}`);
  lines.push(sep);
  lines.push(line(t.qtyItem, t.total));
  lines.push(sep);
  for (const it of order.items || []) {
    const lt = Number(it.price || 0) * Number(it.qty || 0);
    const left = `${it.qty || 0}x ${it.name || it.id || ""}`;
    lines.push(line(left, moneyStr(lt)));
  }
  lines.push(sep);
  lines.push(line(t.subtotal, moneyStr(order.subtotal)));
  lines.push(line(t.delivery, moneyStr(order.deliveryFee)));
  lines.push(sep);
  lines.push(line(t.total, moneyStr(order.total)));
  lines.push("");
  lines.push(t.thanks);
  return lines.join("\n");
}

function initReceiptEditor(order) {
  const t = i18n[lang] || i18n.en;
  const items = Array.isArray(order.items) ? order.items : [];
  const wrap = el("editItems");
  if (!wrap) return;
  wrap.innerHTML = items
    .map((it, idx) => {
      return `<div class="edit-line" data-idx="${idx}">
      <input class="edit-name" type="text" value="${escapeHtml(it.name || it.id || "")}" placeholder="${escapeHtml(t.itemName)}" />
      <input class="edit-qty" type="number" min="0" step="1" value="${Number(it.qty || 0)}" />
      <input class="edit-price" type="number" min="0" step="0.01" value="${Number(it.price || 0)}" />
      <button class="btn ghost small" type="button" data-action="remove-line">✕</button>
    </div>`;
    })
    .join("");

  el("editDeliveryFee") &&
    (el("editDeliveryFee").value = String(Number(order.deliveryFee || 0)));

  // wire editor
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-action");
    if (act === "remove-line") {
      const row = btn.closest(".edit-line");
      row && row.remove();
      updateTotals();
    }
  });
  wrap.addEventListener("input", () => updateTotals());
  el("editDeliveryFee")?.addEventListener("input", () => updateTotals());

  el("addLineBtn")?.addEventListener("click", () => {
    const idx = wrap.querySelectorAll(".edit-line").length;
    const div = document.createElement("div");
    div.className = "edit-line";
    div.setAttribute("data-idx", String(idx));
    div.innerHTML = `
      <input class="edit-name" type="text" value="" placeholder="${escapeHtml(t.itemName)}" />
      <input class="edit-qty" type="number" min="0" step="1" value="1" />
      <input class="edit-price" type="number" min="0" step="0.01" value="0" />
      <button class="btn ghost small" type="button" data-action="remove-line">✕</button>
    `;
    wrap.appendChild(div);
    updateTotals();
  });

  el("saveEditBtn")?.addEventListener("click", () =>
    saveReceiptEdits(order.id),
  );

  EDIT_TICKET_ORDER_ID = String(order.id);
  updateTotals();
}

function readReceiptEdits() {
  const items = [];
  const lines = Array.from(document.querySelectorAll("#editItems .edit-line"));
  for (const row of lines) {
    const name = row.querySelector(".edit-name")?.value?.trim() || "";
    const qty = Number(row.querySelector(".edit-qty")?.value || 0);
    const price = Number(row.querySelector(".edit-price")?.value || 0);
    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    items.push({ id: name, name, qty, price });
  }
  const deliveryFee = Number(el("editDeliveryFee")?.value || 0);
  return {
    items,
    deliveryFee:
      Number.isFinite(deliveryFee) && deliveryFee >= 0 ? deliveryFee : 0,
  };
}

function updateTotals() {
  const cur = orders.find((x) => String(x.id) === String(selectedId)) || null;
  const currency = cur?.currency || i18n[lang]?.currency || "MAD";
  const ed = readReceiptEdits();
  const subtotal = ed.items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
    0,
  );
  const total = subtotal + Number(ed.deliveryFee || 0);
  el("editSubtotal") &&
    (el("editSubtotal").textContent = money(subtotal, currency));
  el("editDeliveryFeeView") &&
    (el("editDeliveryFeeView").textContent = money(ed.deliveryFee, currency));
  el("editTotal") && (el("editTotal").textContent = money(total, currency));
}

async function saveReceiptEdits(orderId) {
  const t = i18n[lang] || i18n.en;
  const hint = el("editHint");
  if (hint) hint.textContent = "";
  const ed = readReceiptEdits();
  if (!ed.items.length) {
    if (hint)
      hint.textContent =
        "⚠️ " +
        (lang === "ar"
          ? "أضف على الأقل منتوج واحد"
          : lang === "fr"
            ? "Ajoutez au moins un article"
            : "Add at least one item");
    return;
  }
  try {
    const updated = await api(
      `/api/restaurant/orders/${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ items: ed.items, deliveryFee: ed.deliveryFee }),
      },
    );
    // update cache
    const idx = orders.findIndex((x) => String(x.id) === String(orderId));
    if (idx >= 0) orders[idx] = updated;
    toast("✅ " + t.saveChanges);
    if (hint) hint.textContent = "✅";
    showDetails(updated);
    render();
  } catch (e) {
    if (hint) hint.textContent = "⚠️ " + e.message;
    toast(e.message);
  }
}

// Professional HTML ticket (with logo) and auto-print support
function printHtmlTicket(order) {
  const t = i18n[lang] || i18n.en;
  const tx = ticketTexts(order.lang || lang);
  const items = Array.isArray(order.items) ? order.items : [];

  // شلنا عمود "سعر الوحدة" عشان الورقة الـ 58 ضيقة، وهنعرض (الاسم، الكمية، المجموع) بس
  const rows = items
    .map((it) => {
      const lt = Number(it.price || 0) * Number(it.qty || 0);
      return `<tr>
      <td class="col-name">${escapeHtml(it.name || it.id)}</td>
      <td class="col-qty">${Number(it.qty || 0)}</td>
      <td class="col-total">${Number(lt || 0).toFixed(2)}</td>
    </tr>`;
    })
    .join("");

  const restName = getOrderRestaurantName(order);

  const html = `<!DOCTYPE html>
  <html lang="${escapeHtml(order.lang || "ar")}" dir="${tx.dir}">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${tx.order} #${escapeHtml(order.id)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { margin: 0; }
      body { 
        font-family: Tahoma, Arial, sans-serif; 
        margin: 0; 
        padding: 0; 
        color: #000;
        background: #fff;
      }
      .ticket { 
        width: 48mm; /* مساحة الطباعة الفعلية للورق الـ 58 مللي */
        margin: 0 auto; 
        padding: 5mm 0;
        font-size: 12px;
        overflow: hidden;
      }
      .center { text-align: center; }
      .logo-wrap { text-align: center; margin-bottom: 5px; width: 100%; }
      .logo { 
        max-width: 90px; /* مقاس ثابت بالبيكسل عشان ميكبرش ويضرب من المتصفح */
        height: auto; 
        filter: grayscale(100%) contrast(200%);
      }
      .hr { border-bottom: 1px dashed #000; margin: 8px 0; }
      
      table { width: 100%; border-collapse: collapse; font-size: 12px; color: #000; }
      th { border-bottom: 1px solid #000; padding-bottom: 4px; font-weight: bold; }
      td, th { padding: 4px 0; vertical-align: middle; }
      
      .col-name { text-align: start; width: 55%; padding-inline-end: 2px; }
      .col-qty { text-align: center; width: 15%; }
      .col-total { text-align: end; width: 30%; }
      
      .totals { width: 100%; font-size: 13px; font-weight: bold; margin-top: 5px; }
      .totals td { padding: 3px 0; }
      .big { font-size: 15px; font-weight: 900; }
      .muted { font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="logo-wrap">
        <img class="logo" src="/icons/invoice-logo.png" alt="siymon" onload="window.logoLoaded=true;"/>
      </div>
      <div class="center big">${escapeHtml(restName || "siymon")}</div>
      <div class="center muted">${tx.order} #${escapeHtml(order.id)}</div>
      <div class="center muted" style="font-size: 11px;">${escapeHtml(fmtTime(order.createdAt))}</div>

      <div class="hr"></div>

      <div><b>${tx.name}:</b> ${escapeHtml(order.customer?.name || "")}</div>
      <div><b>${tx.phone}:</b> <span dir="ltr">${escapeHtml(order.customer?.phone || "")}</span></div>
      <div><b>${tx.address}:</b> ${escapeHtml(order.customer?.addr || "")}</div>
      ${order.customer?.notes ? `<div><b>${tx.notes}:</b> ${escapeHtml(order.customer?.notes || "")}</div>` : ""}

      <div class="hr"></div>

      <table>
        <thead>
          <tr>
            <th class="col-name">${escapeHtml(t.itemName)}</th>
            <th class="col-qty">${escapeHtml(t.qty)}</th>
            <th class="col-total">${escapeHtml(t.total)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="hr"></div>

      <table class="totals">
        <tr>
          <td>${tx.subtotal}</td>
          <td style="text-align:end"><b>${Number(order.subtotal || 0).toFixed(2)}</b></td>
        </tr>
        <tr>
          <td>${tx.delivery}</td>
          <td style="text-align:end"><b>${Number(order.deliveryFee || 0).toFixed(2)}</b></td>
        </tr>
        <tr>
          <td class="big">${tx.total}</td>
          <td style="text-align:end" class="big">${Number(order.total || 0).toFixed(2)} ${escapeHtml(order.currency || "MAD")}</td>
        </tr>
      </table>

      <div class="hr"></div>
      <div class="center muted">شكراً لثقتكم</div>
    </div>

    <script>
      function doPrint() {
        window.print();
        setTimeout(() => window.close(), 500);
      }
      window.onload = () => {
        if(window.logoLoaded) doPrint();
        else setTimeout(doPrint, 500);
      };
    </script>
  </body>
  </html>`;

  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) {
    toast("Popup blocked");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

async function printWifi(order) {
  const t = i18n[lang] || i18n.en;
  try {
    await api("/api/restaurant/print/wifi", {
      method: "POST",
      body: JSON.stringify({ orderId: order.id }),
    });
    toast("✅ " + t.wifiPrint);
  } catch (e) {
    toast(e.message);
  }
}

function escposReceipt(order) {
  const enc = new TextEncoder();
  const chunks = [];
  const push = (u8) =>
    chunks.push(u8 instanceof Uint8Array ? u8 : Uint8Array.from(u8));
  const text = (str) => push(enc.encode(str));

  const WIDTH = 32;
  const sep = "--------------------------------";
  const moneyStr = (n) =>
    Number(n || 0).toFixed(2) + " " + (order.currency || "MAD");

  function line(left, right, width = WIDTH) {
    let l = String(left || "");
    const r = String(right || "");
    if (l.length + r.length + 1 > width) {
      l = l.slice(0, Math.max(0, width - r.length - 1));
    }
    const spaces = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(spaces) + r + "\n";
  }

  // init
  push([0x1b, 0x40]);
  // center
  push([0x1b, 0x61, 0x01]);
  // bold + big
  push([0x1b, 0x45, 0x01]);
  push([0x1d, 0x21, 0x11]);
  text(`${getOrderRestaurantName(order)}\n`);
  // normal size
  push([0x1d, 0x21, 0x00]);
  push([0x1b, 0x45, 0x00]);
  text(`ORDER #${order.id}\n`);
  text(`${fmtTime(order.createdAt)}\n`);
  text(sep + "\n");

  // left
  push([0x1b, 0x61, 0x00]);
  text(`Name: ${order.customer?.name || ""}\n`);
  text(`Phone: ${order.customer?.phone || ""}\n`);
  text(`Address: ${order.customer?.addr || ""}\n`);
  if (order.customer?.notes) text(`Notes: ${order.customer?.notes}\n`);
  text(sep + "\n");
  text(line("QTY ITEM", "TOTAL"));
  text(sep + "\n");
  for (const it of order.items || []) {
    const lt = Number(it.price || 0) * Number(it.qty || 0);
    const left = `${it.qty || 0}x ${it.name || it.id || ""}`;
    text(line(left, moneyStr(lt)));
  }
  text(sep + "\n");
  push([0x1b, 0x45, 0x01]);
  text(line("Subtotal", moneyStr(order.subtotal)));
  text(line("Delivery", moneyStr(order.deliveryFee)));
  push([0x1b, 0x45, 0x00]);
  push([0x1b, 0x61, 0x01]);
  push([0x1d, 0x21, 0x11]);
  text(`TOTAL ${moneyStr(order.total)}\n`);
  push([0x1d, 0x21, 0x00]);
  text("\n\n");
  push([0x1d, 0x56, 0x41, 0x10]);

  const totalLen = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function connectBluetooth() {
  const t = i18n[lang] || i18n.en;
  if (!navigator.bluetooth) {
    toast(t.errors.btUnsupported);
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "0000ffe0-0000-1000-8000-00805f9b34fb",
        "0000ffe5-0000-1000-8000-00805f9b34fb",
      ],
    });
    BT.device = device;
    device.addEventListener("gattserverdisconnected", () => {
      BT.connected = false;
      BT.server = null;
      BT.characteristic = null;
      updateBtBtn();
      toast("BT disconnected");
    });

    BT.server = await device.gatt.connect();
    BT.characteristic = await findWritableCharacteristic(BT.server);
    if (!BT.characteristic) throw new Error("No writable characteristic");
    BT.connected = true;
    updateBtBtn();
    toast("✅ " + t.btConnected);
  } catch (e) {
    BT.connected = false;
    updateBtBtn();
    toast(t.errors.btConnectFail + " " + (e.message || ""));
  }
}

async function findWritableCharacteristic(server) {
  const services = await server.getPrimaryServices();
  for (const s of services) {
    try {
      const chars = await s.getCharacteristics();
      for (const c of chars) {
        const p = c.properties;
        if (p.write || p.writeWithoutResponse) return c;
      }
    } catch (_e) {
      /* ignore */
    }
  }
  return null;
}

async function writeInChunks(characteristic, data) {
  const maxChunk = 180;
  for (let i = 0; i < data.length; i += maxChunk) {
    const chunk = data.slice(i, i + maxChunk);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function printBluetooth(order) {
  const t = i18n[lang] || i18n.en;
  try {
    if (!BT.connected || !BT.characteristic) {
      await connectBluetooth();
    }
    if (!BT.connected || !BT.characteristic) {
      throw new Error("Not connected");
    }
    const data = escposReceipt(order);
    await writeInChunks(BT.characteristic, data);
    toast("✅ " + t.btPrint);
  } catch (e) {
    toast(e.message || "BT print failed");
  }
}

function renderProducts() {
  const body = el("productsBody");
  const t = i18n[lang] || i18n.en;
  const q = el("searchInput").value.trim().toLowerCase();

  const list = Array.isArray(menuItems) ? menuItems.slice() : [];
  list.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  const filtered = q
    ? list.filter((it) => {
        const id = String(it.id || "").toLowerCase();
        const name = textForLang(it.name).toLowerCase();
        const cat = String(it.cat || "").toLowerCase();
        return id.includes(q) || name.includes(q) || cat.includes(q);
      })
    : list;

  el("tableHint").textContent = `(${filtered.length})`;

  body.innerHTML =
    filtered
      .map((it) => {
        const name = textForLang(it.name) || String(it.id);
        const cat = textForLang(it.catLabel || it.cat || "");
        const price = money(it.price, i18n[lang]?.currency);
        const st =
          it.isAvailable !== false
            ? `<span class="tag ok">${lang === "ar" ? "متوفر" : lang === "fr" ? "Disponible" : "Available"}</span>`
            : `<span class="tag bad">${lang === "ar" ? "مخفي" : lang === "fr" ? "Masqué" : "Hidden"}</span>`;
        const toggleLabel =
          it.isAvailable !== false ? t.hide || "Hide" : t.show || "Show";
        return `
      <tr>
        <td><b>${escapeHtml(name)}</b><br/><small class="muted">${escapeHtml(String(it.id || ""))}</small></td>
        <td>${escapeHtml(cat)}</td>
        <td><b>${escapeHtml(price)}</b></td>
        <td>${st}</td>
        <td class="row-actions">
          <button class="btn ghost small" data-action="edit-prod" data-id="${escapeHtml(it.id)}">${escapeHtml(t.edit || "Edit")}</button>
          <button class="btn ghost small" data-action="toggle-prod" data-id="${escapeHtml(it.id)}">${escapeHtml(toggleLabel)}</button>
          <button class="btn ghost small" data-action="del-prod" data-id="${escapeHtml(it.id)}">${escapeHtml(t.delete || "Delete")}</button>
        </td>
      </tr>
    `;
      })
      .join("") ||
    `<tr><td colspan="5" class="muted" style="padding:16px">${escapeHtml(t.productsEmpty || "No products.")}</td></tr>`;
}

function render() {
  // keep details box in sync
  if (view === "products") {
    renderProducts();
  } else {
    renderOrders();
  }
}

function showDetails(o) {
  const t = i18n[lang] || i18n.en;
  selectedId = String(o.id || "");

  const receiptText = buildReceiptTextBlock(o);

  const items = Array.isArray(o.items) ? o.items : [];
  const itemsHtml =
    items
      .map((it) => {
        const nm = it.name || it.id || "";
        const qty = Number(it.qty || 0);
        const pr = Number(it.price || 0);
        return `<div class="row" style="justify-content:space-between;gap:10px"><span>${escapeHtml(nm)} <small class="muted">×${qty}</small></span><b>${escapeHtml(money(qty * pr, o.currency))}</b></div>`;
      })
      .join("") || `<div class="muted">—</div>`;

  const drv = o.driver || null;
  const driverName = drv ? drv.name || "" : o.driverName || "";
  const driverPhone = drv ? drv.phone || "" : o.driverPhone || "";
  const hasDriver = !!(o.driverId || driverPhone || driverName);
  const canConfirmDriverTaken =
    hasDriver && String(o.status || "") === "restaurant_ready";
  const driverLabel =
    lang === "ar" ? "السائق" : lang === "fr" ? "Chauffeur" : "Driver";
  const driverTakenText =
    lang === "ar"
      ? "السائق أخذ الطلب"
      : lang === "fr"
        ? "Le chauffeur a pris la commande"
        : "Driver took the order";
  const driverInfoHtml = hasDriver
    ? `
    <div class="panel-like" style="padding:10px; box-shadow:none; border:1px solid rgba(0,0,0,.06)">
      <div><b>${escapeHtml(driverLabel)}:</b> ${escapeHtml(driverName || "—")} ${driverPhone ? `<span class="muted">• ${escapeHtml(driverPhone)}</span>` : ""}</div>
      ${o.acceptedAt ? `<div class="muted" style="font-size:12px;margin-top:4px">${escapeHtml(fmtTime(o.acceptedAt))}</div>` : ""}
    </div>
  `
    : "";
  const pickupCodeHtml = o.pickupCode
    ? `<div class="panel-like" style="padding:10px; box-shadow:none; border:1px solid rgba(0,0,0,.06)"><b>${escapeHtml(lang === "ar" ? "كود الاستلام (أعطه للسائق عند الاستلام)" : lang === "fr" ? "Code de retrait (à donner au chauffeur)" : "Pickup code (give to the driver at pickup)")}:</b> <span dir="ltr" style="font-size:22px;letter-spacing:4px;font-weight:700">${escapeHtml(o.pickupCode)}</span></div>`
    : "";
  const driverButtonHtml = canConfirmDriverTaken
    ? `
    <button class="btn good small" id="driverTakenBtn" type="button">${escapeHtml(driverTakenText)}</button>
  `
    : hasDriver && String(o.status || "") === "accepted"
      ? `
    <button class="btn ghost small" type="button" disabled>✅ ${escapeHtml(driverTakenText)}</button>
  `
      : "";

  const actions = `
    <div class="row-actions" style="justify-content:center; flex-wrap:wrap">
      ${driverButtonHtml}
      <button class="btn ghost small" id="detailHtmlBtn" type="button">${escapeHtml(t.htmlPrint)}</button>
      <button class="btn ghost small" id="detailWifiBtn" type="button">${escapeHtml(t.wifiPrint)}</button>
      <button class="btn ghost small" id="detailBtBtn" type="button">${escapeHtml(t.btPrint)}</button>
    </div>
  `;

  el("detailsBox").innerHTML = `
    <div style="display:grid; gap:12px">
      <div class="panel-like" style="padding:12px; box-shadow:none; border:1px solid rgba(0,0,0,.06)">
        <div class="row" style="justify-content:space-between;gap:10px;align-items:start">
          <div>
            <b>#${escapeHtml(o.id || "")}</b>
            <div class="muted" style="font-size:12px">${escapeHtml(fmtDate(o.createdAt))}</div>
          </div>
          <div class="${statusClass(o.status)}">${escapeHtml(statusLabel(o.status))}</div>
        </div>

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:10px 0"/>

        <div style="display:grid;gap:6px">
          <div><b>${escapeHtml(t.name)}:</b> ${escapeHtml(o.customer?.name || "")}</div>
          <div><b>${escapeHtml(t.phone)}:</b> ${escapeHtml(o.customer?.phone || "")}</div>
          <div><b>${escapeHtml(t.address)}:</b> ${escapeHtml(o.customer?.addr || "")}</div>
          ${o.customer?.notes ? `<div><b>${escapeHtml(t.notes)}:</b> ${escapeHtml(o.customer?.notes || "")}</div>` : ""}
        </div>

        ${driverInfoHtml}
        ${pickupCodeHtml}

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:10px 0"/>

        <div><b>${escapeHtml(t.items)}:</b></div>
        <div style="display:grid;gap:6px;margin-top:6px">${itemsHtml}</div>

        <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:10px 0"/>

        <div style="display:flex; justify-content:space-between"><span class="muted">${escapeHtml(t.subtotal)}</span><b>${escapeHtml(money(o.subtotal, o.currency))}</b></div>
        <div style="display:flex; justify-content:space-between"><span class="muted">${escapeHtml(t.deliveryFee)}</span><b>${escapeHtml(money(o.deliveryFee, o.currency))}</b></div>
        <div style="display:flex; justify-content:space-between; font-weight:1000"><span>${escapeHtml(t.total)}</span><b>${escapeHtml(money(o.total, o.currency))}</b></div>
      </div>

      <div class="ticket-preview">
        <img class="ticket-logo" src="/icons/icon-192.png" alt="siymon"/>
        <pre class="ticket-pre" dir="ltr">${escapeHtml(receiptText)}</pre>
        <div class="ticket-help">80mm / ESC-POS</div>
      </div>

      <details class="edit-details" id="editTicketDetails">
        <summary>${escapeHtml(t.editTicket)}</summary>
        <div style="margin-top:12px; display:grid; gap:10px">
          <div class="input-row">
            <label for="editDeliveryFee">${escapeHtml(t.deliveryFee)}</label>
            <input id="editDeliveryFee" type="number" min="0" step="0.01" />
          </div>

          <div class="muted" style="font-size:12px">${escapeHtml(t.itemName)} | ${escapeHtml(t.qty)} | ${escapeHtml(t.unitPrice)}</div>
          <div class="edit-items" id="editItems"></div>

          <div class="row-actions">
            <button class="btn ghost small" id="addLineBtn" type="button">${escapeHtml(t.addLine)}</button>
            <button class="btn good small" id="saveEditBtn" type="button">${escapeHtml(t.saveChanges)}</button>
          </div>

          <div style="display:flex; justify-content:space-between"><span class="muted">${escapeHtml(t.subtotal)}</span><b id="editSubtotal">0</b></div>
          <div style="display:flex; justify-content:space-between"><span class="muted">${escapeHtml(t.deliveryFee)}</span><b id="editDeliveryFeeView">0</b></div>
          <div style="display:flex; justify-content:space-between; font-weight:1000"><span>${escapeHtml(t.total)}</span><b id="editTotal">0</b></div>

          <div class="hint" id="editHint"></div>
        </div>
      </details>

      ${actions}
    </div>
  `;

  // restore/track receipt editor open state
  try {
    const det = el("editTicketDetails");
    if (det) {
      det.open = !!(
        EDIT_TICKET_OPEN && String(EDIT_TICKET_ORDER_ID) === String(o.id)
      );
      det.addEventListener("toggle", () => {
        EDIT_TICKET_OPEN = !!det.open;
        EDIT_TICKET_ORDER_ID = String(o.id);
      });
    }
  } catch (_e) {
    /* ignore */
  }

  // bind print buttons
  el("detailHtmlBtn")?.addEventListener("click", () => printHtmlTicket(o));
  el("detailWifiBtn")?.addEventListener("click", () => printWifi(o));
  el("detailBtBtn")?.addEventListener("click", () => printBluetooth(o));
  el("driverTakenBtn")?.addEventListener("click", () =>
    confirmDriverTaken(o.id),
  );

  // init editor
  initReceiptEditor(o);
}

function showPrintModal(show) {
  el("printModal").classList.toggle("show", !!show);
}

function buildTicketHtml(o) {
  const t = i18n[lang] || i18n.en;
  const items = Array.isArray(o.items) ? o.items : [];

  const itemsRows = items
    .map((it) => {
      const nm = it.name || it.id || "";
      const qty = Number(it.qty || 0);
      const pr = Number(it.price || 0);
      return `<tr><td style="padding:6px 0">${escapeHtml(nm)} <small>×${qty}</small></td><td style="padding:6px 0;text-align:end"><b>${escapeHtml(money(qty * pr, o.currency))}</b></td></tr>`;
    })
    .join("");

  return `
    <div style="max-width:520px;margin:auto">
      <div style="text-align:center">
        <img src="/icons/icon-192.png" style="width:56px;height:56px;border-radius:14px;background:#000;padding:6px"/>
        <div style="font-weight:1000;margin-top:8px">siymon</div>
        <div style="font-size:12px;color:var(--muted)">${escapeHtml(t.welcome)}</div>
      </div>

      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <b>#${escapeHtml(o.id || "")}</b>
          <span style="font-size:12px;color:var(--muted)">${escapeHtml(fmtDate(o.createdAt))}</span>
        </div>
        <div style="margin-top:6px"><b>${escapeHtml(t.name)}:</b> ${escapeHtml(o.customer?.name || "")}</div>
        <div><b>${escapeHtml(t.phone)}:</b> ${escapeHtml(o.customer?.phone || "")}</div>
        <div><b>${escapeHtml(t.address)}:</b> ${escapeHtml(o.customer?.addr || "")}</div>
        ${o.customer?.notes ? `<div><b>${escapeHtml(t.notes)}:</b> ${escapeHtml(o.customer?.notes || "")}</div>` : ""}
      </div>

      <hr style="border:none;border-top:1px dashed rgba(0,0,0,.25);margin:12px 0"/>

      <table style="width:100%;border-collapse:collapse">
        <tbody>${itemsRows}</tbody>
      </table>

      <hr style="border:none;border-top:1px dashed rgba(0,0,0,.25);margin:12px 0"/>
      <div style="display:flex;justify-content:space-between;gap:10px"><span class="muted">Subtotal</span><b>${escapeHtml(money(o.subtotal, o.currency))}</b></div>
      <div style="display:flex;justify-content:space-between;gap:10px"><span class="muted">Delivery</span><b>${escapeHtml(money(o.deliveryFee, o.currency))}</b></div>
      <div style="display:flex;justify-content:space-between;gap:10px"><span class="muted">Total</span><b>${escapeHtml(money(o.total, o.currency))}</b></div>

      <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--muted)">© siymon</div>
    </div>
  `;
}

async function doLogin() {
  const t = i18n[lang] || i18n.en;
  const id = el("loginId").value.trim();
  const password = el("loginPassword").value;
  el("authHint").textContent = "";
  if (!id) {
    el("authHint").textContent = t.errors.needId;
    return;
  }
  if (!password) {
    el("authHint").textContent = t.errors.needPass;
    return;
  }

  try {
    unlockAudio();
  } catch (_e) {}

  const looksEmail = id.includes("@");
  const compact = id.replace(/\s+/g, "");
  const digits = compact.replace(/\D/g, "");
  const looksPhone =
    !looksEmail && digits.length >= 8 && digits.length >= compact.length - 2; // allow + and separators

  // email | phone | identifier (restaurant id/name)
  const payload = looksEmail
    ? { email: id, password }
    : looksPhone
      ? { phone: id, password }
      : { identifier: id, password };
  try {
    const res = await api("/api/restaurant/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    token = res.token;
    me = res.restaurant || null;
    authStorage.setItem(TOKEN_KEY, token);
    authStorage.setItem(REST_PROFILE_KEY, JSON.stringify(me || {}));
    showLoggedIn(true);
    await loadMe();
    await loadOrders();
    toast("✅ OK");
  } catch (e) {
    el("authHint").textContent = e.message;
  }
}

function doLogout() {
  token = null;
  me = null;
  orders = [];
  selectedId = null;
  authStorage.removeItem(TOKEN_KEY);
  authStorage.removeItem(REST_PROFILE_KEY);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  showLoggedIn(false);
  render();
}

async function loadMe() {
  if (!token) return;
  try {
    const r = await api("/api/restaurant/me", { method: "GET" });
    me = r.restaurant || me;
  } catch (_e) {
    // invalid token
    doLogout();
    return;
  }
  const name =
    me?.name?.[lang] ||
    me?.name?.en ||
    me?.name?.ar ||
    me?.name?.fr ||
    me?.name ||
    "—";
  el("restName").textContent = name;
  el("restBadge").classList.add("open");
}

async function loadOrders(silent = false) {
  if (!token) return;
  const t = i18n[lang] || i18n.en;
  try {
    const res = await api("/api/restaurant/orders", { method: "GET" });
    orders = Array.isArray(res.orders) ? res.orders : [];

    // detect new actionable orders for restaurant (polling)
    // We notify when an order becomes admin_accepted (even if it existed before as NEW)
    try {
      if (firstOrdersLoad) {
        prevStatusById = new Map(
          orders.map((o) => [String(o.id), String(o.status || "")]),
        );
        firstOrdersLoad = false;
      } else {
        const newly = orders.filter((o) => {
          const id = String(o.id);
          const st = String(o.status || "");
          const prev = prevStatusById.get(id);
          return st === "admin_accepted" && prev !== "admin_accepted";
        });
        if (newly.length) {
          playNewOrderSound();
          toast(`${t.newOrder || "New order"}: ${newly.length}`);

          // ====== طباعة تلقائية للطلبات الجديدة ======
          newly.forEach((o, index) => {
            setTimeout(() => {
              printHtmlTicket(o);
            }, index * 1000); // تأخير ثانية بين كل فاتورة والتانية لمنع ضغط المتصفح
          });
          // ===========================================
        }
        prevStatusById = new Map(
          orders.map((o) => [String(o.id), String(o.status || "")]),
        );
      }
    } catch (_e) {
      /* ignore */
    }

    if (!silent) toast("✅");
    render();
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      doLogout();
    } else {
      toast(e.message);
    }
  }
}

async function confirmDriverTaken(id) {
  const t = i18n[lang] || i18n.en;
  try {
    await api(`/api/restaurant/orders/${encodeURIComponent(id)}/driver_taken`, {
      method: "POST",
    });
    toast(
      "✅ " +
        (lang === "ar"
          ? "تم إشعار المشرف والزبون"
          : lang === "fr"
            ? "Notification envoyée"
            : "Notified"),
    );
    await loadOrders(true);
  } catch (e) {
    toast(e.message);
  }
}

async function markReady(id) {
  const t = i18n[lang] || i18n.en;
  try {
    await api(`/api/restaurant/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "restaurant_ready" }),
    });
    toast("✅ " + t.ready);
    await loadOrders(true);
  } catch (e) {
    toast(e.message);
  }
}

function openPrint(o) {
  // New: same ticket + tools as admin (HTML / Wi‑Fi / BT)
  showDetails(o);
  printHtmlTicket(o);
}

function bindEvents() {
  el("themeToggle").addEventListener("click", toggleTheme);
  el("langToggle").addEventListener("click", cycleLang);
  el("soundToggle")?.addEventListener("click", () => setSound(!soundEnabled));
  el("soundGateBtn")?.addEventListener("click", () => {
    setSound(true);
    unlockAudio();
    hideSoundGate();
  });
  el("btConnectBtn")?.addEventListener("click", connectBluetooth);
  el("loginBtn").addEventListener("click", doLogin);
  el("logoutBtn").addEventListener("click", doLogout);
  el("refreshBtn").addEventListener("click", () =>
    view === "products" ? loadProducts() : loadOrders(),
  );
  el("searchInput").addEventListener("input", render);
  el("closePrintBtn").addEventListener("click", () => showPrintModal(false));

  el("tabOrders")?.addEventListener("click", () => setView("orders"));
  el("tabProducts")?.addEventListener("click", () => {
    clearProductForm();
    setView("products");
  });
  el("saveProdBtn")?.addEventListener("click", saveProduct);
  el("prodImgFile")?.addEventListener("change", (e) => {
    const f = e.target && e.target.files && e.target.files[0];
    uploadMealImageRestaurant(f);
  });

  el("ordersBody").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr");
    const btn = e.target.closest("button");
    if (btn) {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!action || !id) return;
      const o = orders.find((x) => String(x.id) === String(id));
      if (action === "ready") return markReady(id);
      if (action === "print" && o) return openPrint(o);
      return;
    }
    if (tr && tr.getAttribute("data-row")) {
      const id = tr.getAttribute("data-row");
      const o = orders.find((x) => String(x.id) === String(id));
      if (o) showDetails(o);
    }
  });

  el("productsBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;
    const it = (menuItems || []).find((x) => String(x.id) === String(id));
    if (action === "edit-prod" && it) return startEditProduct(it);
    if (action === "toggle-prod") return toggleProductAvail(id);
    if (action === "del-prod") return deleteProduct(id);
  });
}

(async function init() {
  loadTheme();
  bindEvents();
  applyI18n();

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

  if (token) {
    showLoggedIn(true);
    try {
      await loadMe();
      await loadOrders(true);
      pollTimer = setInterval(() => loadOrders(true), 7000);
    } catch (_e) {
      doLogout();
    }
  } else {
    showLoggedIn(false);
  }
})();

/***********************
 * PWA: ensure SW updates quickly (avoid stale cached JS)
 ***********************/
(function ensureServiceWorkerFreshness() {
  try {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        try {
          reg.update && reg.update();
        } catch (_e) {}
        try {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        } catch (_e) {}
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (
              sw.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              try {
                reg.waiting &&
                  reg.waiting.postMessage({ type: "SKIP_WAITING" });
              } catch (_e) {}
            }
          });
        });
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      try {
        window.location.reload();
      } catch (_e) {}
    });
  } catch (_e) {}
})();
