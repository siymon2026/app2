/* global ICONS */
const ICONS = {
  cart: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM6.2 6l.9 4.2c.1.5.6.8 1.1.8h8.6c.5 0 1-.3 1.1-.8L19.4 6H6.2ZM5.3 4H21c.6 0 1 .6.9 1.2l-1.7 7.9c-.3 1.3-1.4 2.2-2.8 2.2H8.1c-1.3 0-2.5-.9-2.8-2.2L3.2 3.4H2a1 1 0 1 1 0-2h2c.5 0 .9.3 1 .8L5.3 4Z"/></svg>`,
  trash: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4a1 1 0 1 1 0 2h-1l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7H4a1 1 0 1 1 0-2h4l1-2Zm-1 4 1 14h6l1-14H8Zm2 2a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1Z"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Zm17 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2ZM5.2 5.2a1 1 0 0 1 1.4 0l.7.7A1 1 0 1 1 5.9 7.3l-.7-.7a1 1 0 0 1 0-1.4Zm12.2 12.2a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4ZM18.8 5.2a1 1 0 0 1 0 1.4l-.7.7A1 1 0 1 1 16.7 5.9l.7-.7a1 1 0 0 1 1.4 0ZM7.3 16.7a1 1 0 0 1 0 1.4l-.7.7a1 1 0 1 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0Z"/></svg>`,
  phone: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.6 3.1 3.5 5 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.2 1 .4 2.1.6 3.2.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 3c0-.6.4-1 1-1h3.8c.6 0 1 .4 1 1 0 1.1.2 2.2.6 3.2.1.4 0 .9-.2 1.2L6.6 10.8Z"/></svg>`,
  locate: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a1 1 0 0 1 1 1v1.1A8 8 0 0 1 19.9 11H21a1 1 0 1 1 0 2h-1.1A8 8 0 0 1 13 19.9V21a1 1 0 1 1-2 0v-1.1A8 8 0 0 1 4.1 13H3a1 1 0 1 1 0-2h1.1A8 8 0 0 1 11 4.1V3a1 1 0 0 1 1-1Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>`,
  send: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 11.2 20.7 4.5c.8-.3 1.6.5 1.3 1.3l-6.7 17.3c-.3.8-1.5.8-1.8 0l-2.6-6.6-6.6-2.6c-.8-.3-.8-1.5 0-1.8Zm4.5 1.4 4.3 1.7 6.2-6.2-6.2 6.2 1.7 4.3 4.4-11.4-11.4 4.4Z"/></svg>`,
  lock: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9V7a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1ZM9 7a3 3 0 1 1 6 0v2H9V7Zm3 6a2 2 0 0 1 1 3.7V18a1 1 0 1 1-2 0v-1.3A2 2 0 0 1 12 13Z"/></svg>`,
  unlock: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9h-8V7a3 3 0 1 1 6 0 1 1 0 1 0 2 0 5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h11a3 3 0 0 0 3-3v-8a2 2 0 0 0-2-2Zm-5 4a2 2 0 0 1 1 3.7V18a1 1 0 1 1-2 0v-1.3A2 2 0 0 1 12 13Z"/></svg>`,
  install: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v9.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 13.6V4a1 1 0 0 1 1-1ZM5 20a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"/></svg>`,
};

let PUBLIC = null;
let offersTimer = null;
let offersIndex = 0;

const CURRENCY_AR = "د.م";
const CURRENCY_EN = "MAD";
const CURRENCY_FR = "MAD";

const BUSINESS = {
  open: { h: 12, m: 0 },
  close: { h: 0, m: 0 },
  days: [0, 1, 2, 3, 4, 5, 6],
};

const i18n = {
  ar: {
    dir: "rtl",
    title: "siymon",
    subtitle: "اطلب أكلك المفضل بسرعة",
    loginGateTitle: "مرحباً بكم في siymon",
    loginGateText: "يجب تسجيل الدخول أو إنشاء حساب لإرسال الطلب.",
    loginGateBtn: "تسجيل الدخول / إنشاء حساب",
    needLoginToOrder: "يجب تسجيل الدخول أو إنشاء حساب أولاً لإرسال الطلب.",
    cartTitle: "السلة",
    emptyCart: "السلة فارغة. أضف منتجات من القائمة 👇",
    openNow: "مفتوح الآن",
    closedNow: "مغلق الآن",
    hoursText: "ساعات العمل: 12:00 إلى 00:00 — طيلة أيام الأسبوع",
    subTotalLabel: "المجموع الفرعي",
    totalLabel: "الإجمالي",
    nameLabel: "الاسم",
    phoneLabel: "رقم الهاتف",
    addrLabel: "العنوان",
    notesLabel: "ملاحظات (اختياري)",
    placeText: "تأكيد الطلب",
    placeSuccess: "تم استلام طلبك ✅ رقم الطلب:",
    placeFail: "تعذر إرسال الطلب. أعد المحاولة.",
    clearText: "تفريغ السلة",
    addBtn: "أضف للسلة",
    categoryAll: "الكل",
    getAddrText: "جلب العنوان تلقائياً",
    locHint: "قد يطلب المتصفح الإذن للوصول للموقع.",
    geo: {
      unsupported: "الموقع الجغرافي غير مدعوم",
      locating: "جارٍ تحديد موقعك...",
      filled: "تم ملء العنوان تلقائياً ✅",
      fallback: "تعذر جلب العنوان، تم وضع الإحداثيات.",
      denied: "تعذر تحديد موقعك، المرجو السماح بالوصول للموقع",
    },
    orderSentToast: "تم إرسال الطلب ✅",
    iosAddToHome: "في iPhone: اضغط زر المشاركة ثم (Add to Home Screen).",
    validations: {
      needItems: "أضف منتجات للسلة أولاً.",
      needName: "اكتب اسمك من فضلك.",
      needPhone: "اكتب رقم الهاتف من فضلك.",
      needAddress: "اكتب العنوان من فضلك.",
      closed: "المتجر مغلق حالياً. لا يمكن إرسال الطلب الآن.",
    },
    footer: "© siymon",
    policyLink: "سياسة الشركة",
    myOrders: "طلباتي",
    ratingsTitle: "آراء الزبائن",
    ratingsSubtitle: "آخر التقييمات",
    ratingsEmpty: "لا توجد تقييمات بعد.",
  },
  en: {
    dir: "ltr",
    title: "siymon | Food Ordering",
    subtitle: "Order your favorite food fast",
    cartTitle: "Cart",
    emptyCart: "Cart is empty. Add items from the list 👇",
    openNow: "Open now",
    closedNow: "Closed now",
    hoursText: "Working hours: 12:00 → 00:00 — Every day",
    subTotalLabel: "Subtotal",
    totalLabel: "Total",
    nameLabel: "Name",
    phoneLabel: "Phone",
    addrLabel: "Address",
    notesLabel: "Notes (optional)",
    placeText: "Place order",
    placeSuccess: "Order received ✅ Order ID:",
    placeFail: "Couldn't send order. Try again.",
    clearText: "Clear cart",
    addBtn: "Add to cart",
    categoryAll: "All",
    getAddrText: "Auto-fill address",
    locHint: "Your browser may ask for location permission.",
    geo: {
      unsupported: "Geolocation unsupported",
      locating: "Locating...",
      filled: "Address filled ✅",
      fallback: "Couldn\'t fetch address; used coordinates.",
      denied: "Couldn\'t get your location. Please allow access.",
    },
    orderSentToast: "Order sent ✅",
    iosAddToHome: "On iPhone: tap Share then Add to Home Screen.",
    validations: {
      needItems: "Please add items to the cart first.",
      needName: "Please enter your name.",
      needPhone: "Please enter your phone number.",
      needAddress: "Please enter your address.",
      closed: "We are currently closed. You can't place an order now.",
    },
    footer: "© siymon",
    policyLink: "Company policy",
    myOrders: "My orders",
    ratingsTitle: "Customer reviews",
    ratingsSubtitle: "Latest ratings",
    ratingsEmpty: "No ratings yet.",
  },
  fr: {
    dir: "ltr",
    title: "siymon | Commande",
    subtitle: "Commandez vos plats préférés rapidement",
    loginGateTitle: "Bienvenue sur siymon",
    loginGateText: "Connectez-vous ou créez un compte pour passer commande.",
    loginGateBtn: "Connexion / Inscription",
    needLoginToOrder: "Connectez-vous ou créeز un compte d’abord.",
    cartTitle: "Panier",
    emptyCart: "Le panier est vide. Ajoutez des produits depuis la liste 👇",
    openNow: "Ouvert",
    closedNow: "Fermé",
    hoursText: "Horaires : 12:00 → 00:00 — Tous les jours",
    subTotalLabel: "Sous-total",
    totalLabel: "Total",
    nameLabel: "Nom",
    phoneLabel: "Téléphone",
    addrLabel: "Adresse",
    notesLabel: "Remarques (optionnel)",
    placeText: "Valider la commande",
    placeSuccess: "Commande reçue ✅ ID de commande :",
    placeFail: "Impossible d'envoyer la commande. Réessayez.",
    clearText: "Vider le panier",
    addBtn: "Ajouter",
    categoryAll: "Tout",
    getAddrText: "Remplir l’adresse automatiquement",
    locHint: "Le navigateur peut demander l’autorisation de localisation.",
    geo: {
      unsupported: "La géolocalisation n\'est pas prise en charge",
      locating: "Localisation...",
      filled: "Adresse remplie ✅",
      fallback: "Impossible de récupérer l\'adresse ; coordonnées utilisées.",
      denied:
        "Impossible d\'obtenir votre position. Autorisez l\'accès à la localisation.",
    },
    orderSentToast: "Commande envoyée ✅",
    iosAddToHome:
      "Sur iPhone : touchez Partager puis Ajouter à l\'écran d\'accueil.",
    validations: {
      needItems: "Ajoutez d'abord des produits au panier.",
      needName: "Veuillez saisir votre nom.",
      needPhone: "Veuillez saisir votre numéro de téléphone.",
      needAddress: "Veuillez saisir votre adresse.",
      closed: "Nous sommes fermés. Vous ne pouvez pas commander maintenant.",
    },
    footer: "© siymon",
    policyLink: "Politique de l’entreprise",
    myOrders: "Mes commandes",
    ratingsTitle: "Avis des clients",
    ratingsSubtitle: "Derniers avis",
    ratingsEmpty: "Aucun avis pour le moment.",
  },
};

let RESTAURANTS = [];
let products = [];
let selectedRestaurantId = "";
let RATINGS = [];

// ======= إضافة متغيرات لحفظ الإحداثيات الدقيقة ======
let exactLat = null;

// ===== Service area (Berrechid only) — enforced by the server, mirrored here for early feedback =====
let SERVICE_AREA = null; // { city, enforce, center, radiusMeters, polygon }
let areaInside = null; // true | false | null (unknown)
const AREA_MSG = {
  ar: {
    inside: "الموقع داخل منطقة التوصيل في برشيد ✅",
    outside: "عذرًا، التوصيل متاح في مدينة برشيد فقط. موقعك خارج منطقة الخدمة.",
    needLocation: "يرجى الضغط على «جلب العنوان تلقائياً» لتحديد موقع التسليم في برشيد.",
    unknown: "تعذّر التحقق من منطقة التوصيل الآن.",
  },
  fr: {
    inside: "Position dans la zone de livraison de Berrechid ✅",
    outside: "Désolé, la livraison est disponible uniquement à Berrechid. Votre position est hors zone.",
    needLocation: "Appuyez sur « Remplir l'adresse automatiquement » pour indiquer votre position à Berrechid.",
    unknown: "Impossible de vérifier la zone de livraison pour le moment.",
  },
  en: {
    inside: "Location is inside the Berrechid delivery area ✅",
    outside: "Sorry, delivery is available in Berrechid only. Your location is outside the service area.",
    needLocation: "Please tap “Auto-fill address” to set your delivery location in Berrechid.",
    unknown: "Couldn't verify the delivery area right now.",
  },
};
let areaServerMsg = null; // the server's own explanation ({ar,fr,en}) for the last "outside" answer (zone, store zone, ...)
const areaMsg = (k) => (k === "outside" && areaServerMsg && areaServerMsg[lang]) || (AREA_MSG[lang] || AREA_MSG.en)[k];

async function loadServiceArea() {
  try {
    const r = await fetch("/api/service-area");
    const d = await r.json();
    if (d && d.ok) SERVICE_AREA = d;
  } catch (_e) {
    SERVICE_AREA = null;
  }
}

async function checkServiceArea(lat, lng) {
  try {
    const r = await fetch("/api/service-area/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
    const d = await r.json();
    areaInside = d && d.ok && typeof d.inside === "boolean" ? d.inside : null; // unknown unless the server says so
    areaServerMsg = d && d.inside === false && d.message && typeof d.message === "object" ? d.message : null;
  } catch (_e) {
    areaInside = null;
    areaServerMsg = null;
  }
  return areaInside;
}
let exactLng = null;
// ====================================================

const LANG_KEY = "siymon_lang_v1";
let lang = localStorage.getItem(LANG_KEY) || "ar";
let activeCat = "all";
let searchQ = "";
const cart = new Map();

const el = (id) => document.getElementById(id);
const productsGrid = el("productsGrid");
const cartItems = el("cartItems");
const restaurantChips = el("restaurantChips");
const categoryChips = el("categoryChips");
const subTotalValue = el("subTotalValue");
const totalValue = el("totalValue");
const cartCount = el("cartCount");
const openBadge = el("openBadge");
let isOpenNow = true;
const openText = el("openText");
const hoursText = el("hoursText");
const langToggle = el("langToggle");
const themeToggle = el("themeToggle");
const installBtn = el("installBtn");
const supportCall = el("supportCall");
const clearCartBtn = el("clearCart");
const goCartBtn = el("goCart");
const placeBtn = el("placeOrder");
const getAddrBtn = el("getAddrBtn");
const locHint = el("locHint");
const orderHint = el("orderHint");
const toastEl = el("toast");
const custName = el("custName");
const custPhone = el("custPhone");
const custAddr = el("custAddr");
const custNotes = el("custNotes");
const closedHint = el("closedHint");

const REST_KEY = "siymon_selected_rest_v1";
const CUSTOMER_TOKEN_KEY = "siymon_customer_token_v1";
const CUSTOMER_PROFILE_KEY = "siymon_customer_profile_v1";

function textForLang(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object")
    return String(v[lang] || v.en || v.ar || v.fr || "");
  return String(v);
}

function getCustomerToken() {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}

function getCustomerProfile() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function prefillCustomerFields() {
  const c = getCustomerProfile();
  if (!c) return;
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (fullName && !custName.value.trim()) custName.value = fullName;
  if (c.phone && !custPhone.value.trim()) custPhone.value = String(c.phone);
}

async function loadCatalog() {
  try {
    const [rr, mm] = await Promise.all([
      fetch("/api/restaurants").then((r) => r.json()),
      fetch("/api/menu").then((r) => r.json()),
    ]);
    RESTAURANTS = Array.isArray(rr?.restaurants) ? rr.restaurants : [];
    products = Array.isArray(mm?.items) ? mm.items : [];
  } catch (_e) {
    RESTAURANTS = [];
    products = [];
  }

  const prodRestIds = Array.from(
    new Set(
      (products || [])
        .map((p) => String(p?.restaurantId || ""))
        .filter(Boolean),
    ),
  );
  // Only stores published by the admin are shown (no ids invented from products).
  products = (products || []).filter((p) =>
    RESTAURANTS.some((r) => String(r.id) === String(p?.restaurantId || "")),
  );
  // No published stores => empty state (nothing is fabricated client-side).

  const saved = localStorage.getItem(REST_KEY);
  const exists = (id) => RESTAURANTS.some((r) => String(r.id) === String(id));
  let nextId = "";
  if (saved && exists(saved)) nextId = String(saved);
  if (!nextId) {
    const prodId = (products || [])
      .map((p) => String(p?.restaurantId || ""))
      .find((id) => id && exists(id));
    if (prodId) nextId = String(prodId);
  }
  if (!nextId) nextId = String(RESTAURANTS[0]?.id || "");
  if (!exists(nextId)) nextId = "";
  selectedRestaurantId = nextId;
  localStorage.setItem(REST_KEY, selectedRestaurantId);
}

async function loadRatings() {
  try {
    const res = await fetch("/api/ratings?limit=12");
    const data = await res.json();
    RATINGS = Array.isArray(data?.ratings) ? data.ratings : [];
  } catch (_e) {
    RATINGS = [];
  }
}

function renderRatings() {
  const section = el("ratingsSection");
  const listEl = el("ratingsList");
  if (!section || !listEl) return;
  section.style.display = "";
  listEl.innerHTML = "";
  const list = Array.isArray(RATINGS) ? RATINGS : [];
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent =
      i18n[lang].ratingsEmpty ||
      (lang === "ar"
        ? "لا توجد تقييمات بعد."
        : lang === "fr"
          ? "Aucun avis pour le moment."
          : "No ratings yet.");
    listEl.appendChild(empty);
    return;
  }
  for (const r of list) {
    const card = document.createElement("div");
    card.className = "rating-card";
    const starsEl = document.createElement("div");
    starsEl.className = "rating-stars";
    const n = Math.max(1, Math.min(5, Number(r?.stars || 0)));
    starsEl.textContent = "★".repeat(n) + "☆".repeat(5 - n);
    card.appendChild(starsEl);
    const comment = String(r?.comment || "").trim();
    if (comment) {
      const c = document.createElement("div");
      c.className = "rating-comment";
      c.textContent = comment;
      card.appendChild(c);
    }
    const meta = document.createElement("div");
    meta.className = "rating-meta";
    const who = document.createElement("span");
    who.textContent = String(
      r?.customerName ||
        (lang === "ar" ? "زبون" : lang === "fr" ? "Client" : "Customer"),
    );
    const where = document.createElement("span");
    const rest = String(r?.restaurantName || "").trim();
    let date = "";
    try {
      if (r?.createdAt) date = new Date(r.createdAt).toLocaleDateString();
    } catch (_e) {}
    where.textContent = [rest, date].filter(Boolean).join(" • ");
    meta.appendChild(who);
    meta.appendChild(where);
    card.appendChild(meta);
    listEl.appendChild(card);
  }
}

function mountIcons() {
  el("cartIcon").innerHTML = ICONS.cart;
  el("clearIcon").innerHTML = ICONS.trash;
  el("sendIcon").innerHTML = ICONS.send;
  el("locIcon").innerHTML = ICONS.locate;
  installBtn.innerHTML = ICONS.install;
  themeToggle.innerHTML = ICONS.moon;
  supportCall.innerHTML = ICONS.phone;
}

const THEME_KEY = "siymon_theme_v3";
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.innerHTML = ICONS.sun;
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.innerHTML = ICONS.moon;
  }
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
    return;
  }
  // الوضع الداكن هو الافتراضي (هوية SIYMON)
  applyTheme("dark");
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

const LS_KEY = "siymon_cart_v5";
function saveCart() {
  const obj = {
    lang,
    items: Array.from(cart.entries()),
    activeCat,
    customer: {
      name: custName.value || "",
      phone: custPhone.value || "",
      addr: custAddr.value || "",
      notes: custNotes.value || "",
    },
  };
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}
function loadCart() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj?.lang) lang = obj.lang;
    if (obj?.activeCat) activeCat = obj.activeCat;
    if (Array.isArray(obj?.items)) {
      cart.clear();
      obj.items.forEach(([id, qty]) => {
        if (typeof id === "string" && Number.isFinite(qty) && qty > 0)
          cart.set(id, qty);
      });
    }
    if (obj?.customer) {
      custName.value = obj.customer.name || "";
      custPhone.value = obj.customer.phone || "";
      custAddr.value = obj.customer.addr || "";
      custNotes.value = obj.customer.notes || "";
    }
  } catch (e) {}
}

function money(v) {
  const num = Number(v || 0);
  return (
    num.toFixed(2) +
    " " +
    (lang === "ar" ? CURRENCY_AR : lang === "fr" ? CURRENCY_FR : CURRENCY_EN)
  );
}
function getProduct(id) {
  return products.find((p) => p.id === id);
}
function unitPrice(p) {
  const sp = p && p.salePrice;
  if (sp !== undefined && sp !== null && Number(sp) >= 0 && Number(sp) < Number(p.price))
    return Number(sp);
  return Number(p?.price || 0);
}
function priceHtml(p) {
  const u = unitPrice(p);
  return u < Number(p.price)
    ? `${money(u)} <s class="old-price">${money(p.price)}</s>`
    : money(p.price);
}
function selStore() {
  return (
    (RESTAURANTS || []).find(
      (r) => String(r.id) === String(selectedRestaurantId),
    ) || null
  );
}
/* ---- road-distance delivery fee (server computes; this only displays the estimate) ---- */
const DQ = { key: "", state: "idle", fee: 0, km: 0, code: "", msg: null }; // idle|loading|ok|error
function distanceMode() {
  return !!(PUBLIC && PUBLIC.deliveryPricing && PUBLIC.deliveryPricing.mode === "distance");
}
function dqMessage() {
  if (DQ.state === "loading") return trL("جارٍ حساب رسوم التوصيل…", "Calcul des frais…", "Calculating delivery fee…");
  if (DQ.state === "needpin") return trL("حدّد موقع التوصيل على الخريطة لحساب الرسوم", "Choisissez le lieu de livraison pour calculer les frais", "Pick the delivery location to calculate the fee");
  if (DQ.msg && DQ.msg[lang] && DQ.state === "error") return DQ.msg[lang]; // the server explains why (outside the zone, road distance over the limit, ...)
  if (DQ.code === "OUT_OF_RANGE") return trL("العنوان بعيد جدًا عن هذا المتجر", "Adresse trop éloignée de ce magasin", "Address is too far from this store");
  if (DQ.code === "STORE_LOCATION_MISSING") return trL("موقع المتجر غير مضبوط، لا يمكن حساب الرسوم", "Position du magasin non configurée", "Store location is not configured");
  return trL("تعذّر حساب مسافة الطريق الآن. حاول لاحقًا.", "Calcul de la distance impossible pour le moment. Réessayez.", "Road distance cannot be calculated right now. Try again later.");
}
function refreshDeliveryQuote() {
  if (!distanceMode() || cart.size === 0 || !selectedRestaurantId) {
    if (DQ.state !== "idle") { DQ.state = "idle"; DQ.key = ""; }
    return;
  }
  if (!(exactLat && exactLng)) {
    if (DQ.state !== "needpin") { DQ.state = "needpin"; DQ.key = ""; renderCart(); }
    return;
  }
  const sub = cartSubTotal();
  const key = [selectedRestaurantId, exactLat, exactLng, sub].join("|");
  if (key === DQ.key) return; // already loading / loaded for these inputs
  DQ.key = key;
  DQ.state = "loading";
  fetch("/api/delivery/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId: selectedRestaurantId, lat: exactLat, lng: exactLng, subtotal: sub }),
  })
    .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
    .then(({ ok, d }) => {
      if (DQ.key !== key) return; // a newer request superseded this one
      if (ok && d && d.ok) { DQ.state = "ok"; DQ.fee = Number(d.fee) || 0; DQ.km = Number(d.km) || 0; DQ.code = ""; DQ.msg = null; }
      else { DQ.state = "error"; DQ.code = (d && d.code) || ""; DQ.msg = d && d.message && typeof d.message === "object" ? d.message : null; }
      renderCart();
    })
    .catch(() => {
      if (DQ.key !== key) return;
      DQ.state = "error"; DQ.code = "ROUTING_UNAVAILABLE";
      renderCart();
    });
}
document.addEventListener("siymon:address-changed", () => { DQ.key = ""; if (typeof renderCart === "function") renderCart(); });

function cartDeliveryFee() {
  const s = selStore();
  if (!s || cart.size === 0) return 0;
  if (distanceMode()) return DQ.state === "ok" ? DQ.fee : 0;
  if (s.freeDeliveryOver != null && cartSubTotal() >= Number(s.freeDeliveryOver))
    return 0;
  return Number(s.deliveryFee || 0);
}
function cartMinShortfall() {
  const s = selStore();
  const min = Number(s?.minOrder || 0);
  return min > cartSubTotal() ? min - cartSubTotal() : 0;
}
function storeOpenNow() {
  const s = selStore();
  return !s || s.isOpen !== false;
}
function cartSubTotal() {
  let total = 0;
  for (const [id, qty] of cart.entries()) {
    const p = getProduct(id);
    if (p) total += unitPrice(p) * qty;
  }
  return total;
}
/* ---- discount code: the server decides the amount; the client only shows it ---- */
const PROMO = { code: "", discount: 0, state: "idle", key: "", msg: "" }; // idle|loading|ok|error
function cartDiscount() {
  return PROMO.state === "ok" ? Math.min(PROMO.discount, cartSubTotal()) : 0;
}
function promoErrorText(code, d) {
  const m = {
    PROMO_INVALID: trL("الكود غير صحيح", "Code invalide", "Invalid code"),
    PROMO_NOT_STARTED: trL("الكود غير مفعّل بعد", "Code pas encore actif", "Code not active yet"),
    PROMO_EXPIRED: trL("انتهت صلاحية الكود", "Code expiré", "Code expired"),
    PROMO_STORE: trL("الكود غير صالح لهذا المتجر", "Code non valable pour ce magasin", "Code not valid for this store"),
    LOGIN_REQUIRED: trL("سجّل الدخول لاستعمال كود الخصم", "Connectez-vous pour utiliser un code", "Sign in to use a discount code"),
    PROMO_MIN: trL("قيمة السلة أقل من الحد الأدنى لهذا الكود", "Panier inférieur au minimum pour ce code", "Basket is below the minimum for this code"),
    PROMO_EXHAUSTED: trL("استُنفد هذا الكود", "Ce code est épuisé", "This code has been fully used"),
    PROMO_USED: trL("استعملت هذا الكود من قبل", "Vous avez déjà utilisé ce code", "You already used this code"),
    PROMO_FIRST_ONLY: trL("هذا الكود لأول طلب فقط", "Code réservé à la première commande", "This code is for a first order only"),
    PROMO_CATEGORY: trL("لا توجد في السلة منتجات مؤهلة لهذا الكود", "Aucun article éligible dans le panier", "No eligible items in your basket"),
    PROMO_ZERO: trL("لا خصم لهذه السلة", "Aucune remise pour ce panier", "No discount for this basket"),
  };
  return m[code] || trL("تعذّر التحقق من الكود", "Impossible de vérifier le code", "Could not check the code");
}
function promoKey() {
  return JSON.stringify([PROMO.code, selectedRestaurantId, [...cart.entries()].sort()]);
}
async function previewPromo() {
  if (!PROMO.code || !cart.size) return;
  const key = promoKey();
  if (key === PROMO.key) return;
  PROMO.key = key;
  PROMO.state = "loading";
  try {
    const headers = { "Content-Type": "application/json" };
    const tk = getCustomerToken();
    if (tk) headers.Authorization = `Bearer ${tk}`;
    const res = await fetch("/api/promo/preview", {
      method: "POST",
      headers,
      body: JSON.stringify({ code: PROMO.code, restaurantId: selectedRestaurantId, items: [...cart.entries()].map(([id, qty]) => ({ id, qty })) }),
    });
    const d = await res.json().catch(() => ({}));
    if (PROMO.key !== key) return; // superseded
    if (res.ok && d.ok) { PROMO.state = "ok"; PROMO.discount = Number(d.discount) || 0; PROMO.msg = ""; }
    else { PROMO.state = "error"; PROMO.discount = 0; PROMO.msg = promoErrorText(d.code, d); }
  } catch (_e) {
    if (PROMO.key !== key) return;
    PROMO.state = "error"; PROMO.discount = 0; PROMO.msg = promoErrorText("", {});
  }
  renderCart();
}
function resetPromo() {
  PROMO.code = ""; PROMO.discount = 0; PROMO.state = "idle"; PROMO.key = ""; PROMO.msg = "";
  const i = document.getElementById("promoInput"); if (i) i.value = "";
}
function cartGrandTotal() {
  return Math.max(0, cartSubTotal() + cartDeliveryFee() - cartDiscount());
}
function cartItemsCount() {
  let c = 0;
  for (const qty of cart.values()) c += qty;
  return c;
}

function isBusinessOpen(now = new Date()) {
  const day = now.getDay();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const isDayAllowed = (d) => BUSINESS.days.includes(d);
  const openMin = BUSINESS.open.h * 60 + BUSINESS.open.m;
  let closeMin = BUSINESS.close.h * 60 + BUSINESS.close.m;
  if (closeMin === 0 && openMin > 0) closeMin = 24 * 60;
  if (closeMin === openMin) return isDayAllowed(day);
  const overnight = closeMin < openMin;
  if (!overnight)
    return isDayAllowed(day) && minutesNow >= openMin && minutesNow < closeMin;
  if (minutesNow < closeMin) {
    const prevDay = (day + 6) % 7;
    return isDayAllowed(prevDay);
  }
  return isDayAllowed(day) && minutesNow >= openMin;
}
function updateOpenStatus() {
  const mode = String(PUBLIC?.restaurantMode || "auto");
  const open =
    (mode === "open"
      ? true
      : mode === "closed"
        ? false
        : isBusinessOpen(new Date())) && storeOpenNow();
  openBadge.classList.toggle("open", open);
  openBadge.classList.toggle("closed", !open);
  openText.textContent = open ? i18n[lang].openNow : i18n[lang].closedNow;
  hoursText.textContent = i18n[lang].hoursText;
  isOpenNow = !!open;
  closedHint.style.display = open ? "none" : "block";
  updateLoginGate();
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.documentElement.dir = i18n[lang].dir;
  document.title = i18n[lang].title;
  el("subtitle").textContent = i18n[lang].subtitle;
  el("cartTitle").textContent = i18n[lang].cartTitle;
  el("subTotalLabel").textContent = i18n[lang].subTotalLabel;
  el("totalLabel").textContent = i18n[lang].totalLabel;
  el("nameLabel").textContent = i18n[lang].nameLabel;
  el("phoneLabel").textContent = i18n[lang].phoneLabel;
  el("addrLabel").textContent = i18n[lang].addrLabel;
  el("notesLabel").textContent = i18n[lang].notesLabel;
  el("placeText").textContent = i18n[lang].placeText;
  el("getAddrText").textContent = i18n[lang].getAddrText;
  locHint.textContent = i18n[lang].locHint;
  el("clearText").textContent = i18n[lang].clearText;
  el("footerText").textContent = i18n[lang].footer;
  const pl = el("policyLink");
  if (pl) {
    pl.textContent =
      i18n[lang].policyLink ||
      (lang === "ar" ? "سياسة الشركة" : "Company policy");
    pl.style.display = "inline";
  }
  const mol = el("myOrdersLink");
  if (mol) mol.textContent = i18n[lang].myOrders;
  const wl = lang === "ar" ? "المحفظة" : lang === "fr" ? "Portefeuille" : "Wallet";
  if (el("navWalletTxt")) el("navWalletTxt").textContent = wl;
  if (el("walletSheetTitle")) el("walletSheetTitle").textContent = wl;
  const rt = el("ratingsTitle");
  if (rt)
    rt.textContent =
      i18n[lang].ratingsTitle ||
      (lang === "ar" ? "آراء الزبائن" : "Customer reviews");
  const rs = el("ratingsSubtitle");
  if (rs) rs.textContent = i18n[lang].ratingsSubtitle || "";
  langToggle.textContent = lang === "ar" ? "EN" : lang === "en" ? "FR" : "AR";
  custName.placeholder = lang === "ar" ? "مثال: محمد" : "e.g. John";
  custPhone.placeholder = lang === "ar" ? "06/07xxxxxxxx" : "Phone number";
  custAddr.placeholder = lang === "ar" ? "المدينة، الحي..." : "City, street...";
  custNotes.placeholder =
    lang === "ar" ? "بدون بصل، حار، ..." : "No onions, spicy, ...";
  supportCall.setAttribute(
    "href",
    "tel:" + (PUBLIC?.supportPhone || "+212000000000"),
  );
}

async function handleGoogleLogin(response) {
  try {
    const res = await fetch("/api/auth/google/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: response.credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "فشل التسجيل بجوجل");
    localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
    if (data.customer)
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(data.customer));
    toast("تم تسجيل الدخول بنجاح ✅");
    updateLoginGate();
    prefillCustomerFields();
    if (typeof window.siymonSyncAddresses === "function") window.siymonSyncAddresses();
  } catch (err) {
    console.error(err);
    toast("حدث خطأ أثناء تسجيل الدخول بجوجل");
  }
}

function updateLoginGate() {
  const gate = el("loginGate");
  if (gate) {
    gate.style.display = "none"; // إخفاء البوابة نهائياً للسماح للزوار بالطلب
  }
  placeBtn.disabled = !isOpenNow;
}

function renderRestaurants() {
  if (!restaurantChips) return;
  const list = (RESTAURANTS || []).filter((r) => r && r.isActive !== false);
  if (list.length <= 1) {
    restaurantChips.style.display = "none";
    return;
  }
  restaurantChips.style.display = "flex";
  restaurantChips.innerHTML = "";
  list.forEach((r) => {
    const btn = document.createElement("div");
    btn.className =
      "chip" + (String(selectedRestaurantId) === String(r.id) ? " active" : "");
    btn.textContent = textForLang(r.name) || String(r.id);
    btn.addEventListener("click", () => {
      selectedRestaurantId = String(r.id);
      localStorage.setItem(REST_KEY, selectedRestaurantId);
      normalizeActiveCat();
      renderAll();
      saveCart();
    });
    restaurantChips.appendChild(btn);
  });
}

function buildCategoriesFromProducts() {
  const map = new Map();
  for (const p of products) {
    if (
      selectedRestaurantId &&
      String(p.restaurantId || "") !== String(selectedRestaurantId)
    )
      continue;
    if (!p?.cat) continue;
    if (map.has(p.cat)) continue;
    const label = p.catLabel || { ar: p.cat, en: p.cat };
    map.set(p.cat, label);
  }
  return Array.from(map.entries()).map(([key, label]) => ({
    key,
    label: textForLang(label) || key,
  }));
}
function normalizeActiveCat() {
  if (activeCat === "all") return;
  const cats = buildCategoriesFromProducts().map((c) => c.key);
  if (!cats.includes(activeCat)) activeCat = "all";
}
function renderCategories() {
  normalizeActiveCat();
  const cats = buildCategoriesFromProducts();
  const list = cats;
  categoryChips.innerHTML = "";
  list.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "cat-tile";
    btn.type = "button";
    const _p = products.find((x) => x && x.cat === c.key && x.img && (!selectedRestaurantId || String(x.restaurantId || "") === String(selectedRestaurantId))) || (c.key === "all" ? products.find((x) => x && x.img) : null);
    if (_p) { const im = document.createElement("img"); im.src = _p.img; im.alt = ""; im.loading = "lazy"; im.addEventListener("error", () => { const em2 = document.createElement("span"); em2.className = "em"; em2.textContent = "🍽️"; im.replaceWith(em2); }, { once: true }); btn.appendChild(im); } else { const em = document.createElement("span"); em.className = "em"; em.textContent = "🍽️"; btn.appendChild(em); }
    const nm = document.createElement("span");
    nm.className = "cat-name";
    nm.textContent = c.label;
    btn.appendChild(nm);
    btn.addEventListener("click", () => openCategory(c.key, c.label));
    categoryChips.appendChild(btn);
  });
}

const FALLBACK_IMG_DATA =
  "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23eee%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2220%22>Image</text></svg>";

function renderProducts() {
  let filtered = products.filter((p) => p && p.isAvailable !== false);
  if (selectedRestaurantId)
    filtered = filtered.filter(
      (p) => String(p.restaurantId || "") === String(selectedRestaurantId),
    );
  filtered =
    activeCat === "all"
      ? filtered
      : filtered.filter((p) => p.cat === activeCat);
  const q = searchQ.trim().toLowerCase();
  if (q)
    filtered = filtered.filter((p) =>
      (textForLang(p.name) + " " + textForLang(p.desc)).toLowerCase().includes(q),
    );
  productsGrid.style.display = q ? "" : "none";
  productsGrid.innerHTML = "";
  if (!filtered.length) productsGrid.innerHTML = `<div class="empty" style="grid-column:1/-1">${q ? "لا نتائج للبحث" : ""}</div>`;
  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="img"><img src="${p.img}" alt="${textForLang(p.name)}" loading="lazy" /><span class="price-pill">${priceHtml(p)}</span></div><div class="card-body"><h3>${textForLang(p.name)}</h3><p>${textForLang(p.desc)}</p></div><button class="addBtn" data-id="${p.id}" type="button" aria-label="${i18n[lang].addBtn}">+</button>`;
    productsGrid.appendChild(card);
    card.addEventListener("click", (e) => { if (!e.target.closest(".addBtn")) openDetail(p.id); });
    const imgEl = card.querySelector("img");
    if (imgEl)
      imgEl.addEventListener(
        "error",
        () => {
          imgEl.onerror = null;
          imgEl.src = FALLBACK_IMG_DATA;
        },
        { once: true },
      );
  });
  document
    .querySelectorAll(".addBtn")
    .forEach((b) =>
      b.addEventListener("click", () =>
        addToCart(b.getAttribute("data-id"), 1),
      ),
    );
}

// ---- cart helpers (cart/checkout redesign) ----
const trL = (ar, fr, en) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
function escHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function safeImgUrl(u) {
  const x = String(u || "");
  return /^(\/|https:\/\/|data:image\/)/.test(x) ? x : "";
}
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M9 3h6l1 2h4a1 1 0 1 1 0 2h-1l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7H4a1 1 0 0 1 0-2h4l1-2Zm-2 4 1 12h8l1-12H7Zm3 3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"/></svg>';

function renderCart() {
  cartItems.innerHTML = "";
  const sheetTitle = document.querySelector("#cartSheet .sheet-head h2");
  if (sheetTitle) {
    const n = cartItemsCount();
    sheetTitle.textContent = i18n[lang].cartTitle + (n ? ` (${n})` : "");
  }
  const panelEl = document.getElementById("cartPanel");
  if (panelEl) panelEl.classList.toggle("is-empty", cart.size === 0);
  if (cart.size === 0) {
    cartItems.innerHTML = `<div class="cart-empty"><div class="cart-empty-ic" aria-hidden="true">🛒</div><b>${escHtml(trL("سلتك فارغة", "Votre panier est vide", "Your cart is empty"))}</b><p>${escHtml(trL("أضف وجباتك المفضلة وستظهر هنا.", "Ajoutez vos plats préférés, ils apparaîtront ici.", "Add your favorite meals and they will show up here."))}</p><button type="button" class="btn primary" id="cartBackShop">${escHtml(trL("العودة للتسوق", "Retour aux achats", "Back to shopping"))}</button></div>`;
    const back = document.getElementById("cartBackShop");
    if (back) back.addEventListener("click", () => document.getElementById("cartClose")?.click());
  } else {
    for (const [id, qty] of cart.entries()) {
      const p = getProduct(id);
      if (!p) continue;
      const subtotal = unitPrice(p) * qty;
      const name = escHtml(textForLang(p.name));
      const img = safeImgUrl(p.img);
      const item = document.createElement("div");
      item.className = "cart-item";
      item.innerHTML =
        `<div class="ci-img">${img ? `<img src="${escHtml(img)}" alt="" loading="lazy" />` : "🍽️"}</div>` +
        `<div class="ci-main"><div class="ci-top"><b class="ci-name">${name}</b>` +
        `<button type="button" class="ci-del" data-act="remove" data-id="${escHtml(id)}" aria-label="${escHtml(trL("حذف", "Supprimer", "Remove"))} ${name}">${TRASH_SVG}</button></div>` +
        `<small class="ci-unit">${money(unitPrice(p))}</small>` +
        `<div class="ci-row"><div class="qty"><button type="button" data-act="minus" data-id="${escHtml(id)}" aria-label="−">−</button><span aria-live="polite">${qty}</span><button type="button" data-act="plus" data-id="${escHtml(id)}" aria-label="+">+</button></div>` +
        `<span class="ci-line">${money(subtotal)}</span></div></div>`;
      cartItems.appendChild(item);
    }
    cartItems.querySelectorAll("button[data-act]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if (act === "plus") addToCart(id, 1);
        if (act === "minus") addToCart(id, -1);
        if (act === "remove") {
          const row = btn.closest(".cart-item");
          const doRemove = () => { addToCart(id, -(cart.get(id) || 0)); toast(trL("تم حذف المنتج من السلة", "Produit retiré du panier", "Item removed from cart")); };
          if (row) { row.classList.add("removing"); setTimeout(doRemove, 160); } else doRemove();
        }
      }),
    );
  }
  const sT = document.getElementById("summaryTitle");
  if (sT) { sT.textContent = trL("ملخص الطلب", "Résumé de la commande", "Order summary"); sT.style.display = cart.size ? "" : "none"; }
  subTotalValue.textContent = money(cartSubTotal());
  const fee = cartDeliveryFee();
  const dRow = el("deliveryRow");
  if (dRow) {
    dRow.style.display = cart.size ? "" : "none";
    el("deliveryLabel").textContent =
      lang === "ar" ? "رسوم التوصيل" : lang === "fr" ? "Frais de livraison" : "Delivery fee";
    el("deliveryValue").textContent = fee > 0 ? money(fee) : lang === "ar" ? "مجاني" : lang === "fr" ? "Gratuit" : "Free";
    if (distanceMode() && cart.size) {
      refreshDeliveryQuote();
      const dv = el("deliveryValue");
      if (DQ.state === "ok") {
        if (DQ.km > 0) dv.textContent += ` (${DQ.km.toFixed(1)} km)`;
      } else if (DQ.state !== "idle") {
        dv.textContent = dqMessage();
      }
    }
  }
  const mh = el("minOrderHint");
  if (mh) {
    const short = cart.size ? cartMinShortfall() : 0;
    mh.style.display = short > 0 ? "block" : "none";
    mh.textContent =
      short > 0
        ? lang === "ar"
          ? `الحد الأدنى للطلب ${money(selStore().minOrder)} — أضف ${money(short)} لإكمال الطلب.`
          : lang === "fr"
            ? `Commande minimum ${money(selStore().minOrder)} — ajoutez ${money(short)}.`
            : `Minimum order ${money(selStore().minOrder)} — add ${money(short)} more.`
        : "";
  }
  {
    const pRow = el("promoRow"), pMsg = el("promoMsg"), dRow2 = el("discountRow");
    if (pRow) {
      pRow.style.display = cart.size ? "flex" : "none";
      el("promoInput").placeholder = trL("كود الخصم", "Code promo", "Discount code");
      el("promoApply").textContent = PROMO.state === "ok" ? trL("إزالة", "Retirer", "Remove") : trL("تطبيق", "Appliquer", "Apply");
    }
    if (PROMO.code && cart.size) previewPromo(); // re-check when the basket changed
    if (PROMO.code && !cart.size) resetPromo();
    if (pMsg) {
      const show = (PROMO.state === "error" || PROMO.state === "ok") && cart.size;
      pMsg.style.display = show ? "block" : "none";
      pMsg.style.color = PROMO.state === "ok" ? "#15803d" : "#b91c1c";
      pMsg.textContent = PROMO.state === "ok" ? trL("تم تطبيق الكود ✅", "Code appliqué ✅", "Code applied ✅") : PROMO.msg;
    }
    if (dRow2) {
      dRow2.style.display = cartDiscount() > 0 ? "" : "none";
      el("discountLabel").textContent = trL("خصم", "Remise", "Discount") + (PROMO.code ? ` (${PROMO.code})` : "");
      el("discountValue").textContent = "− " + money(cartDiscount());
    }
  }
  totalValue.textContent = money(cartGrandTotal());
  const bTv = document.getElementById("barTotalValue");
  if (bTv) bTv.textContent = money(cartGrandTotal());
  const bTl = document.getElementById("barTotalLabel");
  if (bTl) bTl.textContent = i18n[lang].totalLabel || trL("الإجمالي", "Total", "Total");
  const bar = document.querySelector("#cartPanel .cart-bar");
  if (bar) bar.classList.toggle("is-empty", cart.size === 0);
  document.querySelectorAll("#cartPanel .form .field, #cartPanel .form #getAddrBtn, #cartPanel .form #locHint, #cartPanel .form .pay").forEach((n) => { n.style.display = cart.size ? "" : "none"; });
  renderPayments();
  renderWalletUse();
  cartCount.textContent = String(cartItemsCount());
  updateLoginGate();
}

// ---- payment methods: the list, status and instructions come from the server (supervisor-configured);
// the server re-checks the chosen method when the order is created, so this is display + a request only ----
let PAYMENT_METHODS = [{ id: "cod", kind: "cod", available: true, name: {}, statusMessage: {} }]; // fallback if the list cannot load
let SELECTED_PAYMENT = "cod";
let paymentsLoaded = false;
function payIcon(m) {
  const t = { stripe: "💳", cod: "💵", tpe: "🏧", wallet: "👛" }[m.id] || (m.kind === "transfer" ? "🏦" : "•");
  return `<span class="pay-ic pay-ic-${escHtml(m.id)}" aria-hidden="true">${t}</span>`;
}
function payName(m) {
  return (m.name && (m.name[lang] || m.name.ar || m.name.en)) || m.id;
}
function payNote(m) {
  if (m.id === "wallet") {
    const bal = money(WALLET.balance);
    const goods = Math.max(0, cartSubTotal() - cartDiscount());
    if (!(WALLET.balance > 0)) return trL("الرصيد فارغ — اشحن محفظتك", "Solde vide — rechargez votre portefeuille", "Empty balance — top up your wallet");
    if (WALLET.balance + 0.001 < goods) return trL(`الرصيد ${bal} لا يغطي السلة (${money(goods)})`, `Solde ${bal} insuffisant pour ${money(goods)}`, `Balance ${bal} does not cover ${money(goods)}`);
    return trL(`الرصيد المتاح ${bal}`, `Solde disponible ${bal}`, `Available balance ${bal}`);
  }
  const msg = m.statusMessage && (m.statusMessage[lang] || m.statusMessage.ar);
  if (msg) return msg;
  if (m.available) return m.kind === "tpe" ? trL("ادفع ببطاقتك عبر جهاز TPE عند التسليم", "Payez par carte via TPE à la livraison", "Pay by card terminal when delivered") : trL("ادفع عند استلام طلبك", "Payez à la réception de votre commande", "Pay when you receive your order");
  if (m.reason === "order_workflow_pending") return trL("متاح حاليًا لشحن المحفظة فقط", "Disponible pour recharger le portefeuille uniquement", "Currently available for wallet top-ups only");
  if (m.reason === "disabled" || m.reason === "not_configured") return trL("غير مفعّلة حاليًا", "Non activé pour le moment", "Not enabled right now");
  return trL("غير متاحة حاليًا", "Indisponible", "Unavailable");
}
async function loadPaymentMethods() {
  try {
    const r = await fetch("/api/payment-methods?context=checkout", { cache: "no-store" });
    const d = await r.json();
    if (r.ok && d && Array.isArray(d.methods) && d.methods.length) {
      PAYMENT_METHODS = d.methods;
      paymentsLoaded = true;
      const cur = PAYMENT_METHODS.find((m) => m.id === SELECTED_PAYMENT);
      // Never pre-select the wallet: paying from the balance must stay a deliberate choice.
      if (!cur || !cur.available) {
        const first = PAYMENT_METHODS.find((m) => m.available && m.id !== "wallet") || PAYMENT_METHODS.find((m) => m.available);
        SELECTED_PAYMENT = first ? first.id : "";
      }
    }
  } catch (_e) { /* keep fallback */ }
  renderPayments();
}
function renderPayments() {
  const list = document.getElementById("payList");
  if (!list) return;
  const t = document.getElementById("payTitle");
  if (t) t.textContent = trL("طريقة الدفع", "Mode de paiement", "Payment method");
  list.innerHTML = PAYMENT_METHODS.map((m) => {
    const note = escHtml(payNote(m));
    if (m.available) {
      const on = m.id === SELECTED_PAYMENT;
      return `<div class="pay-opt${on ? " is-selected" : ""}" role="radio" aria-checked="${on}" tabindex="0" data-method="${escHtml(m.id)}">${payIcon(m)}<span class="pay-txt"><b>${escHtml(payName(m))}</b><small>${note}</small></span>${on ? '<span class="pay-check" aria-hidden="true">✓</span>' : ""}</div>`;
    }
    const badge = m.statusLabel && lang === "ar" ? m.statusLabel : trL("غير متاحة حاليًا", "Indisponible", "Unavailable");
    return `<div class="pay-opt is-disabled" role="radio" aria-checked="false" aria-disabled="true" data-method="${escHtml(m.id)}">${payIcon(m)}<span class="pay-txt"><b>${escHtml(payName(m))}</b><small>${note}</small></span><span class="pay-badge">${escHtml(badge)}</span></div>`;
  }).join("");
}
// ---- customer wallet at checkout: pays the GOODS part only; delivery is paid on delivery (the server re-validates) ----
let WALLET = { balance: 0, loaded: false, use: false };
async function loadCheckoutWallet() {
  const tk = getCustomerToken();
  if (!tk) { WALLET = { balance: 0, loaded: true, use: false }; return renderWalletUse(); }
  try {
    const r = await fetch("/api/customer/wallet", { headers: { Authorization: "Bearer " + tk }, cache: "no-store" });
    if (r.ok) { const d = await r.json(); WALLET.balance = Number(d.walletBalance || 0); }
  } catch (_e) {}
  WALLET.loaded = true;
  if (SELECTED_PAYMENT === "wallet" && !(WALLET.balance > 0) && cart.size > 0) {
    // The balance no longer exists (or is empty): never keep an unusable method selected.
    const first = (PAYMENT_METHODS || []).find((m) => m.available && m.id !== "wallet");
    SELECTED_PAYMENT = first ? first.id : "";
  }
  renderWalletUse();
  renderPayments();
}
// The wallet pays the GOODS part in full (never a silent partial payment): the server
// refuses the order when the balance does not cover it. Mixing the wallet with another
// method is NOT offered until it is fully implemented and tested.
function walletGoods() { return Math.max(0, cartSubTotal() - cartDiscount()); }
function walletShortfall() { return Math.max(0, Math.round((walletGoods() - WALLET.balance) * 100) / 100); }
function renderWalletUse() {
  const box = document.getElementById("walletUse");
  if (!box) return;
  const usingWallet = SELECTED_PAYMENT === "wallet";
  WALLET.use = usingWallet;
  if (!usingWallet || !WALLET.loaded || cart.size === 0) { box.style.display = "none"; box.innerHTML = ""; return; }
  const goods = walletGoods();
  const delivery = Math.max(0, cartGrandTotal() - goods);
  box.style.display = "";
  const short = WALLET.balance + 0.001 < goods;
  box.innerHTML = `<div class="pay-txt" style="padding:6px 4px"><small>${
    short
      ? trL(`المطلوب من المحفظة ${money(goods)} والرصيد ${money(WALLET.balance)} — ستحتاج إلى شحن المحفظة.`, `Requis ${money(goods)}, solde ${money(WALLET.balance)} — rechargez votre portefeuille.`, `Required ${money(goods)}, balance ${money(WALLET.balance)} — top up your wallet.`)
      : trL(`سيُخصم <b>${money(goods)}</b> من محفظتك الآن؛ رسوم التوصيل <b>${money(delivery)}</b> تُدفع عند التسليم.`, `Débit de <b>${money(goods)}</b> du portefeuille ; livraison <b>${money(delivery)}</b> à la réception.`, `<b>${money(goods)}</b> will be debited now; delivery <b>${money(delivery)}</b> is paid on delivery.`)
  }</small></div>`;
}

/* ---- insufficient wallet balance: one modal, real numbers, two ways forward ---- */
function walletModalEl() { return document.getElementById("walletShortSheet"); }
function closeWalletShort() {
  const s = walletModalEl();
  if (s) { s.hidden = true; if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll"); }
}
function openWalletShort(info) {
  const s = walletModalEl();
  if (!s) return;
  const available = Number(info && info.available != null ? info.available : WALLET.balance) || 0;
  const required = Number(info && info.required != null ? info.required : walletGoods()) || 0;
  const shortfall = Number(info && info.shortfall != null ? info.shortfall : Math.max(0, required - available)) || 0;
  const cur = (info && info.currency) || "MAD";
  document.getElementById("wsTitle").textContent = trL("رصيد المحفظة غير كافٍ", "Solde du portefeuille insuffisant", "Wallet balance is not enough");
  document.getElementById("wsBody").innerHTML =
    `<p>${trL("رصيد محفظتك غير كافٍ لإتمام الدفع. اختر طريقة دفع أخرى أو اشحن محفظتك للمتابعة.", "Le solde de votre portefeuille est insuffisant pour payer. Choisissez un autre moyen ou rechargez votre portefeuille.", "Your wallet balance is not enough to complete the payment. Choose another method or top up your wallet.")}</p>` +
    `<div class="ws-figures">` +
    `<div><span>${trL("الرصيد الحالي", "Solde actuel", "Current balance")}</span><b>${money(available)} ${cur}</b></div>` +
    `<div><span>${trL("المطلوب", "Requis", "Required")}</span><b>${money(required)} ${cur}</b></div>` +
    `<div class="short"><span>${trL("النقص", "Manque", "Shortfall")}</span><b>${money(shortfall)} ${cur}</b></div>` +
    `</div>` +
    `<p class="ws-note">${trL("طلبك محفوظ في السلة ولم يُرسل — لن يتم خصم أي مبلغ.", "Votre panier est conservé et rien n'a été débité.", "Your cart is kept and nothing was charged.")}</p>`;
  document.getElementById("wsTop").textContent = trL("شحن المحفظة", "Recharger", "Top up wallet");
  document.getElementById("wsOther").textContent = trL("اختيار طريقة دفع أخرى", "Choisir un autre moyen", "Choose another method");
  s.hidden = false;
  document.body.classList.add("no-scroll");
  const b = document.getElementById("wsTop");
  if (b) b.focus();
}

// Buttons of the insufficient-balance modal: top up (opens the real wallet page in the
// sheet, the cart is preserved) or go back to the method list (no order is created).
document.addEventListener("click", (e) => {
  const hit = (sel) => e.target && e.target.closest && e.target.closest(sel);
  if (hit("#wsClose") || e.target === walletModalEl()) { closeWalletShort(); return; }
  if (hit("#wsTop")) {
    closeWalletShort();
    if (typeof window.siymonOpenWallet === "function") window.siymonOpenWallet();
    else location.href = "/wallet/";
    return;
  }
  if (hit("#wsOther")) {
    closeWalletShort();
    const first = (PAYMENT_METHODS || []).find((m) => m.available && m.id !== "wallet");
    if (first) { SELECTED_PAYMENT = first.id; renderPayments(); renderWalletUse(); }
    const list = document.getElementById("payList");
    if (list) { list.scrollIntoView({ block: "center", behavior: "smooth" }); const o = list.querySelector(".pay-opt:not(.is-disabled)"); if (o) o.focus(); }
    return;
  }
});
window.addEventListener("siymon:wallet-closed", () => { loadCheckoutWallet(); });
window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type !== "siymon:wallet") return;
  if (d.event === "close") { const s = document.getElementById("walletSheet"); if (s) { s.hidden = true; const f = document.getElementById("walletFrame"); if (f) f.removeAttribute("src"); document.body.classList.remove("no-scroll"); } }
  loadCheckoutWallet();
});
document.addEventListener("click", (e) => {
  const o = e.target.closest && e.target.closest("#payList .pay-opt");
  if (!o || o.classList.contains("is-disabled")) return;
  SELECTED_PAYMENT = o.getAttribute("data-method");
  renderPayments();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const o = e.target.closest && e.target.closest("#payList .pay-opt");
  if (!o || o.classList.contains("is-disabled")) return;
  e.preventDefault();
  SELECTED_PAYMENT = o.getAttribute("data-method");
  renderPayments();
});

function renderOffersBanner() {
  const wrap = document.getElementById("offersBanner");
  if (!wrap) return;
  let featured = products.filter((p) => p && p.isAvailable !== false);
  if (selectedRestaurantId)
    featured = featured.filter(
      (p) => String(p.restaurantId || "") === String(selectedRestaurantId),
    );
  if (featured.length === 0) {
    wrap.style.display = "none";
    if (offersTimer) {
      clearInterval(offersTimer);
      offersTimer = null;
    }
    return;
  }
  wrap.style.display = "block";
  offersIndex = (offersIndex || 0) % featured.length;
  const p = featured[offersIndex];
  const safeName = textForLang(p.name)
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");

  wrap.innerHTML = `<div id="featuredBannerCard" style="display:flex; background:var(--surface, #fff); border-radius:16px; overflow:hidden; margin-bottom:20px; cursor:pointer; min-height:130px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.05); transition:transform 0.2s;">
      <div style="flex:1; padding:16px; display:flex; flex-direction:column; justify-content:center;">
          <span style="background:var(--primary); color:#fff; font-size:11px; font-weight:bold; padding:4px 10px; border-radius:20px; align-self:flex-start; margin-bottom:8px;">${({ ar: "اقتراحنا لك", fr: "Notre suggestion", en: "Our pick" })[lang] || "Our pick"}</span>
          <h3 style="margin:0 0 4px 0; font-size:16px;">${textForLang(p.name)}</h3>
          <p style="margin:0 0 10px 0; font-size:13px; color:var(--muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${textForLang(p.desc)}</p>
          <div style="margin-top:auto; display:flex; align-items:center; gap:10px;">
              <b style="font-size:16px;">${money(unitPrice(p))}</b>
              <span class="btn primary addBtn" style="padding:4px 8px; border-radius:8px;">+ ${i18n[lang].addBtn}</span>
          </div>
      </div>
      <div style="width:40%; max-width:160px; position:relative;">
          <img src="${p.img}" style="width:100%; height:100%; object-fit:cover;" />
      </div>
  </div>`;

  const bannerImg = wrap.querySelector("img");
  if (bannerImg) bannerImg.addEventListener("error", () => bannerImg.remove(), { once: true });
  const bannerCard = document.getElementById("featuredBannerCard");
  if (bannerCard) {
    bannerCard.addEventListener("click", () => {
      addToCart(p.id, 1);
      toast("تم إضافة " + safeName + " للسلة ✅");
    });
  }

  if (!offersTimer) {
    offersTimer = setInterval(() => {
      offersIndex = (offersIndex + 1) % featured.length;
      renderOffersBanner();
    }, 3500);
  }
}

function renderRestaurantCard() {
  const card = document.getElementById("restCard");
  if (!card) return;
  const list = (RESTAURANTS || []).filter((r) => r && r.isActive !== false);
  const r = list.find((x) => String(x.id) === String(selectedRestaurantId)) || list[0];
  if (!r) { card.style.display = "none"; return; }
  card.style.display = "";
  document.getElementById("restName").textContent = textForLang(r.name) || "";
  document.getElementById("restAddr").textContent = r.address || "";
  const cover = document.getElementById("restCover");
  cover.style.backgroundImage = r.cover ? `url("${r.cover}")` : "";
  cover.classList.toggle("empty-cover", !r.cover);
  const lg = document.getElementById("restLogo");
  const ini = (textForLang(r.name) || "?").trim().charAt(0).toUpperCase().replace(/[<>&"']/g, "");
  const initial = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#5DD62C"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="64" fill="#fff" font-family="Arial">${ini}</text></svg>`);
  lg.onerror = () => { lg.onerror = null; lg.src = initial; };
  lg.src = r.logo || initial;
}

function renderAll() {
  applyI18n();
  renderRestaurantCard();
  renderOffersBanner();
  renderRestaurants();
  renderCategories();
  renderProducts();
  renderCart();
  renderRatings();
  updateOpenStatus();
}

function addToCart(id, delta) {
  const p = getProduct(id);
  if (!p) return;
  const cur = cart.get(id) || 0;
  const next = cur + delta;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  renderCart();
  saveCart();
}
function clearCart() {
  cart.clear();
  renderCart();
  saveCart();
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ======== دالة جلب الموقع (معدلة لحفظ الإحداثيات) ========
// ======== دالة جلب الموقع (معدلة لتوجيه العميل لفتح الـ GPS) ========
async function getLocation() {
  if (!navigator.geolocation) {
    alert(i18n[lang].geo?.unsupported || "Geolocation unsupported");
    return;
  }
  getAddrBtn.disabled = true;
  const oldText = el("getAddrText").textContent;
  el("getAddrText").textContent = i18n[lang].geo?.locating || "Locating...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // حفظ الإحداثيات الدقيقة
      exactLat = lat;
      exactLng = lng;
      areaInside = null;
      const areaPromise = checkServiceArea(lat, lng);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          { headers: { Accept: "application/json", "Accept-Language": lang } },
        );
        const data = await res.json();
        custAddr.value = data?.display_name || `Lat: ${lat}, Lng: ${lng}`;
        custAddr.dispatchEvent(new Event("input", { bubbles: true }));
        locHint.textContent = i18n[lang].geo?.filled || "Address filled ✅";
      } catch (e) {
        custAddr.value = `Lat: ${lat}, Lng: ${lng}`;
        custAddr.dispatchEvent(new Event("input", { bubbles: true }));
        locHint.textContent = i18n[lang].geo?.fallback || "Used coordinates.";
      } finally {
        const inside = await areaPromise;
        if (inside === false) locHint.textContent = areaMsg("outside");
        else if (inside === true && SERVICE_AREA?.enforce) locHint.textContent = areaMsg("inside");
        getAddrBtn.disabled = false;
        el("getAddrText").textContent = oldText;
      }
    },
    (err) => {
      // التفرقة بين رفض الإذن وبين قفل الـ GPS
      let errorMsg = "";
      if (err.code === 1) {
        // PERMISSION_DENIED
        errorMsg =
          lang === "ar"
            ? "لقد رفضت إذن الوصول للموقع. يرجى السماح للمتصفح بالوصول لموقعك من الإعدادات."
            : "Permission denied. Please allow location access in your browser settings.";
      } else {
        // POSITION_UNAVAILABLE أو TIMEOUT
        errorMsg =
          lang === "ar"
            ? "الرجاء سحب الشاشة لأسفل وتشغيل (الموقع / GPS) في هاتفك أولاً، ثم المحاولة مجدداً."
            : "Please turn on (Location / GPS) from your phone settings and try again.";
      }

      alert(errorMsg);
      getAddrBtn.disabled = false;
      el("getAddrText").textContent = oldText;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
}

// ======== دالة بناء الطلب (معدلة لإرفاق الإحداثيات ورابط الخريطة) ========
function buildOrderPayload() {
  const mode = String(PUBLIC?.restaurantMode || "auto");
  const open =
    (mode === "open"
      ? true
      : mode === "closed"
        ? false
        : isBusinessOpen(new Date())) && storeOpenNow();
  if (!open) return { error: i18n[lang].validations.closed };
  if (cart.size > 0 && cartMinShortfall() > 0)
    return {
      error:
        lang === "ar"
          ? `الحد الأدنى للطلب ${money(selStore().minOrder)}`
          : lang === "fr"
            ? `Commande minimum ${money(selStore().minOrder)}`
            : `Minimum order ${money(selStore().minOrder)}`,
    };

  const name = custName.value.trim();
  const phone = custPhone.value.trim();
  const addr = custAddr.value.trim();
  let notes = custNotes.value.trim();

  if (cart.size === 0) return { error: i18n[lang].validations.needItems };
  if (!name) return { error: i18n[lang].validations.needName };
  if (!phone) return { error: i18n[lang].validations.needPhone };
  if (!addr) return { error: i18n[lang].validations.needAddress };
  if (SERVICE_AREA?.enforce) {
    if (!(exactLat && exactLng)) return { error: areaMsg("needLocation") };
    if (areaInside === false) return { error: areaMsg("outside") };
  }

  const items = [];
  for (const [id, qty] of cart.entries()) items.push({ id, qty });

  const customerInfo = { name, phone, addr, notes };

  // إذا تم سحب الموقع تلقائياً بنجاح، يتم إرفاقه بالطلب ورابط مباشر للملاحظات
  if (exactLat && exactLng) {
    customerInfo.lat = exactLat;
    customerInfo.lng = exactLng;
    const mapsLink = `https://maps.google.com/?q=${exactLat},${exactLng}`;
    // وضع رابط الخريطة بشكل جميل في الملاحظات ليظهر للجميع (مطعم / أدمن / سواق)
    customerInfo.notes = notes
      ? `${notes}\n\n📍 الموقع الدقيق للعميل:\n${mapsLink}`
      : `📍 الموقع الدقيق للعميل:\n${mapsLink}`;
  }

  return {
    payload: {
      lang,
      restaurantId: selectedRestaurantId,
      customer: customerInfo,
      items,
      paymentMethod: SELECTED_PAYMENT,
      currency: lang === "ar" ? CURRENCY_AR : CURRENCY_EN,
      ...(PROMO.code && PROMO.state === "ok" ? { promoCode: PROMO.code } : {}),
    },
  };
}

let orderInFlight = false;
async function placeOrder() {
  if (orderInFlight) return; // prevent duplicate orders on repeated taps
  orderHint.textContent = "";

  const { error, payload } = buildOrderPayload();
  if (error) {
    alert(error);
    return;
  }
  if (!SELECTED_PAYMENT) {
    alert(trL("لا توجد طريقة دفع متاحة حاليًا", "Aucun mode de paiement disponible", "No payment method is available right now"));
    return;
  }
  if (SELECTED_PAYMENT === "wallet") {
    // The server re-checks everything; this only avoids a pointless round-trip and
    // explains the refusal with the real numbers instead of a generic error.
    if (!getCustomerToken()) { alert(trL("سجّل الدخول لاستخدام المحفظة", "Connectez-vous pour utiliser le portefeuille", "Sign in to use your wallet")); updateLoginGate(); return; }
    if (WALLET.balance + 0.001 < walletGoods()) { openWalletShort({ available: WALLET.balance, required: walletGoods(), shortfall: walletShortfall() }); loadCheckoutWallet(); return; }
  }
  if (distanceMode() && DQ.state !== "ok") {
    refreshDeliveryQuote();
    alert(dqMessage());
    return;
  }
  orderInFlight = true;
  placeBtn.disabled = true;
  placeBtn.classList.add("is-loading");
  try {
    const custToken = getCustomerToken();
    const headers = { "Content-Type": "application/json" };
    // لو مسجل دخول هيبعت التوكن، لو مش مسجل هيبعت الطلب عادي كزائر
    if (custToken) headers.Authorization = `Bearer ${custToken}`;
    const res = await fetch("/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data?.code === "WALLET_INSUFFICIENT") {
        openWalletShort(Object.assign({}, data.wallet || {}, { currency: data?.wallet?.currency || "MAD" }));
        loadCheckoutWallet();
        return;
      }
      if (String(data?.code || "").startsWith("WALLET_")) {
        alert((data?.message && (data.message[lang] || data.message.ar)) || trL("تعذّر إتمام الدفع من المحفظة. حاول مجددًا.", "Le paiement par portefeuille a échoué. Réessayez.", "The wallet payment could not be completed. Please try again."));
        loadCheckoutWallet();
        return;
      }
      if (data?.code === "LOGIN_REQUIRED") { alert(trL("سجّل الدخول لاستخدام المحفظة", "Connectez-vous pour utiliser le portefeuille", "Sign in to use your wallet")); updateLoginGate(); return; }
      if (data?.code === "PAYMENT_METHOD_NOT_AVAILABLE") { alert(trL("طريقة الدفع هذه غير متاحة حاليًا. اختر طريقة أخرى.", "Ce mode de paiement n'est pas disponible. Choisissez-en un autre.", "This payment method is not available right now. Please choose another.")); loadPaymentMethods(); return; }
      if (["ADDRESS_LOCATION_REQUIRED", "ROUTING_UNAVAILABLE", "OUT_OF_RANGE", "STORE_LOCATION_MISSING"].includes(data?.code)) {
        DQ.state = data.code === "ADDRESS_LOCATION_REQUIRED" ? "needpin" : "error"; DQ.code = data.code; DQ.key = ""; DQ.msg = data.message && typeof data.message === "object" ? data.message : null;
        renderCart();
        alert(DQ.state === "needpin" ? dqMessage() : dqMessage());
        return;
      }
      if (String(data?.code || "").startsWith("PROMO_") || data?.code === "LOGIN_REQUIRED") {
        PROMO.state = "error"; PROMO.discount = 0; PROMO.msg = promoErrorText(data.code, data); PROMO.key = "";
        renderCart();
        alert(PROMO.msg);
        return;
      }
      if (data?.error === "OUT_OF_SERVICE_AREA") { alert((data.message && data.message[lang]) || areaMsg("outside")); return; }
      if (data?.error === "LOCATION_REQUIRED") { alert((data.message && data.message[lang]) || areaMsg("needLocation")); return; }
      const em = String(data?.error || "");
      const tr3 = (ar, fr, en) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
      if (em === "Minimum order not reached") { alert(tr3(`الحد الأدنى للطلب ${money(data.minOrder)}`, `Commande minimum ${money(data.minOrder)}`, `Minimum order ${money(data.minOrder)}`)); return; }
      if (em === "Restaurant is closed" || em === "Restaurant not accepting orders") { alert(i18n[lang].validations.closed); return; }
      if (em.startsWith("Item unavailable") || em.startsWith("Insufficient stock") || em.startsWith("Invalid item")) {
        alert(tr3("بعض المنتجات لم تعد متوفرة. تم تحديث القائمة.", "Certains produits ne sont plus disponibles. Menu mis à jour.", "Some items are no longer available. The menu was refreshed."));
        await loadCatalog(); renderAll(); return;
      }
      throw new Error(data?.error || "failed");
    }
    toast(i18n[lang].orderSentToast || "Order sent ✅");
    orderHint.innerHTML = `<b>${i18n[lang].placeSuccess}</b> <code>${data.id}</code>`;
    if (data.trackingToken) {
      // Guest order: the private link is the ONLY way to follow it (id/phone alone reveal nothing).
      try {
        const k = "siymon_guest_tracks_v1";
        const all = JSON.parse(localStorage.getItem(k) || "[]").filter((x) => x && x.id !== data.id);
        all.unshift({ id: data.id, token: data.trackingToken, at: Date.now() });
        localStorage.setItem(k, JSON.stringify(all.slice(0, 20)));
      } catch (_e) {}
      const tl = `/track/#${encodeURIComponent(data.id)}.${data.trackingToken}`;
      orderHint.insertAdjacentHTML("beforeend", ` <a href="${tl}">${lang === "ar" ? "تتبّع طلبك" : lang === "fr" ? "Suivre ma commande" : "Track your order"}</a>`);
    }
    resetPromo();
    clearCart();
    WALLET.use = false; loadCheckoutWallet(); renderPayments();
    // تصفير الإحداثيات بعد نجاح الطلب
    exactLat = null;
    exactLng = null;
    // keep the chosen delivery address (and its coordinates) ready for the next order
    if (typeof window.siymonReapplyAddress === "function") window.siymonReapplyAddress();
  } catch (e) {
    console.error(e);
    alert(i18n[lang].placeFail);
  } finally {
    orderInFlight = false;
    placeBtn.classList.remove("is-loading");
    updateLoginGate(); // re-evaluates disabled state (closed store etc.)
  }
}

let deferredPrompt = null;
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "inline-flex";
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) {
    if (isIOS())
      alert(
        i18n[lang].iosAddToHome ||
          "On iPhone: tap Share then Add to Home Screen.",
      );
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = "none";
});
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );

async function loadPublicConfig() {
  try {
    const res = await fetch("/api/public-config");
    PUBLIC = await res.json();
  } catch (e) {
    PUBLIC = { supportPhone: "+212000000000", adminWhatsappNumber: null };
  }
}

langToggle.addEventListener("click", () => {
  lang = lang === "ar" ? "en" : lang === "en" ? "fr" : "ar";
  localStorage.setItem(LANG_KEY, lang);
  renderAll();
  saveCart();
});
themeToggle.addEventListener("click", toggleTheme);
clearCartBtn.addEventListener("click", clearCart);
goCartBtn.addEventListener("click", () => {
  const cs = document.getElementById("cartSheet");
  if (cs) { cs.hidden = false; document.body.classList.add("no-scroll"); }
});
getAddrBtn.addEventListener("click", getLocation);
placeBtn.addEventListener("click", placeOrder);
[custName, custPhone, custAddr, custNotes].forEach((input) =>
  input.addEventListener("input", () => saveCart()),
);

(async function init() {
  await loadPublicConfig();
  await loadServiceArea();
  await loadCatalog();
  loadPaymentMethods(); // does not block the page; falls back to cash on delivery
  loadCheckoutWallet();
  await loadRatings();
  mountIcons();
  loadCart();
  loadTheme();
  prefillCustomerFields();
  renderAll();
  setInterval(() => updateOpenStatus(), 60_000);
})();


/* ---- Home redesign: search, product detail sheet, bottom nav ---- */
(function () {
  const $ = (id) => document.getElementById(id);
  const search = $("searchInput");
  if (search) search.addEventListener("input", () => { searchQ = search.value; renderProducts(); });
  const sheet = $("detailSheet");
  let dQty = 1, dId = null;
  window.openDetail = function (id) {
    const p = getProduct(id);
    if (!p || !sheet) return;
    dId = id; dQty = 1;
    $("dImg").src = p.img || "";
    $("dName").textContent = textForLang(p.name);
    $("dPrice").innerHTML = priceHtml(p);
    $("dDesc").textContent = textForLang(p.desc) || "";
    $("dQty").textContent = "1";
    sheet.hidden = false;
    document.body.classList.add("no-scroll");
  };
  function closeDetail() { if (sheet) sheet.hidden = true; document.body.classList.remove("no-scroll"); }
  if (sheet) {
    $("dClose").addEventListener("click", closeDetail);
    $("dMinus").addEventListener("click", () => { dQty = Math.max(1, dQty - 1); $("dQty").textContent = dQty; });
    $("dPlus").addEventListener("click", () => { dQty += 1; $("dQty").textContent = dQty; });
    $("dAdd").addEventListener("click", () => { addToCart(dId, dQty); closeDetail(); toast("✅"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  }
  $("navHome")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("navSearch")?.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: "smooth" }); search?.focus(); });
  $("navCart")?.addEventListener("click", () => $("goCart")?.click());
  setInterval(() => { const c = $("cartCount"), n = $("navBadge"); const nc = $("navCart"); const cnt = c ? c.textContent.trim() : "0"; if (n) { n.textContent = cnt; n.hidden = cnt === "0"; } if (nc) nc.hidden = cnt === "0"; }, 300);
  const wSheet = $("walletSheet");
  const closeWallet = () => { if (!wSheet) return; wSheet.hidden = true; const f = $("walletFrame"); if (f) f.removeAttribute("src"); if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll"); loadCheckoutWallet(); window.dispatchEvent(new Event("siymon:wallet-closed")); };
  // The home page rebuilds its bottom bar (home-v2.js) without the old wallet button, so the wallet is opened from the
  // profile through this function (falls back to the standalone page if the sheet is missing).
  const openWallet = () => { if (!wSheet) { location.href = "/wallet/"; return; } $("walletFrame").src = "/wallet/?embed=1"; wSheet.hidden = false; document.body.classList.add("no-scroll"); };
  window.siymonOpenWallet = openWallet;
  $("navWallet")?.addEventListener("click", openWallet);
  $("walletClose")?.addEventListener("click", closeWallet);
  wSheet?.addEventListener("click", (e) => { if (e.target === wSheet) closeWallet(); });
  $("navMenu")?.addEventListener("click", () => { const m = $("menuSheet"); if (m) { m.hidden = false; document.body.classList.add("no-scroll"); } });
  const cSheet = $("cartSheet"), host = $("cartHost"), panel = $("cartPanel");
  if (cSheet && host && panel) host.appendChild(panel);
  const closeCart = () => { cSheet.hidden = true; if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll"); };
  $("cartClose")?.addEventListener("click", closeCart);
  cSheet?.addEventListener("click", (e) => { if (e.target === cSheet) closeCart(); });
})();

/* ---- category window + menu ---- */
(function () {
  const $ = (id) => document.getElementById(id);
  const cs = $("catSheet"), ms = $("menuSheet");
  const open = (el) => { el.hidden = false; document.body.classList.add("no-scroll"); };
  const close = (el) => { el.hidden = true; if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll"); };
  window.openCategory = function (key, label) {
    let list = products.filter((p) => p && p.isAvailable !== false);
    if (selectedRestaurantId) list = list.filter((p) => String(p.restaurantId || "") === String(selectedRestaurantId));
    if (key !== "all") list = list.filter((p) => p.cat === key);
    $("catTitle").textContent = label;
    const g = $("catGrid"); g.innerHTML = "";
    list.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="img"><img src="${p.img}" alt="" loading="lazy" /><span class="price-pill">${priceHtml(p)}</span></div><div class="card-body"><h3></h3><p></p></div><button class="addBtn" data-id="${p.id}" type="button" aria-label="+">+</button>`;
      card.querySelector("h3").textContent = textForLang(p.name);
      card.querySelector("p").textContent = textForLang(p.desc) || "";
      card.querySelector(".addBtn").addEventListener("click", (e) => { e.stopPropagation(); addToCart(p.id, 1); toast("✅"); });
      card.addEventListener("click", () => openDetail(p.id));
      g.appendChild(card);
    });
    open(cs);
  };
  $("catClose")?.addEventListener("click", () => close(cs));
  cs?.addEventListener("click", (e) => { if (e.target === cs) close(cs); });
  // move the old top-bar buttons into the menu
  const list = $("menuList");
  const labels = { langToggle: "اللغة / Language", installBtn: "تثبيت التطبيق", themeToggle: "المظهر (فاتح / داكن)", supportCall: "اتصل بالدعم", clearCart: "تفريغ السلة" };
  Object.keys(labels).forEach((id) => { const el = $(id); if (el && list) { el.dataset.label = labels[id]; list.appendChild(el); } });
  $("menuBtn")?.addEventListener("click", () => open(ms));
  $("menuClose")?.addEventListener("click", () => close(ms));
  ms?.addEventListener("click", (e) => { if (e.target === ms) close(ms); });
})();

document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#promoApply");
  if (!b) return;
  if (PROMO.state === "ok") { resetPromo(); renderCart(); return; }
  const code = String(document.getElementById("promoInput").value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return;
  PROMO.code = code; PROMO.key = ""; PROMO.state = "idle"; PROMO.msg = "";
  previewPromo();
});
