/* Siymon customer home v2 — delivery address (Berrechid), restaurant cards, favorites.
   Loaded after app.js. Uses app.js globals: RESTAURANTS, selectedRestaurantId, products, cart,
   lang, isOpenNow, textForLang, renderAll, saveCart, toast, exactLat, exactLng, custAddr. */
(function () {
  "use strict";

  var CITY = { ar: "برشيد", fr: "Berrechid", en: "Berrechid" };
  var ADDR_KEY = "siymon_addresses_v1";
  var FAV_KEY = "siymon_fav_rest_v1";

  var T = {
    ar: {
      deliverTo: "التوصيل إلى", choose: "اختر عنوان التوصيل", addrTitle: "عنوان التوصيل",
      useLoc: "استخدام موقعي الحالي", locating: "جارٍ تحديد الموقع…", locOk: "تم حفظ الموقع مع العنوان",
      locDenied: "لم يتم السماح بالوصول إلى الموقع. يمكنك كتابة العنوان يدويًا.",
      locUnsupported: "المتصفح لا يدعم تحديد الموقع.",
      city: "المدينة", hood: "الحي", street: "الشارع", bldg: "رقم المبنى / الطابق / الشقة",
      hint: "ملاحظات للوصول (اختياري)", label: "اسم العنوان", labelPh: "المنزل، العمل…",
      save: "حفظ واستخدام هذا العنوان", saved: "العناوين المحفوظة", none: "لا توجد عناوين محفوظة بعد.",
      del: "حذف", def: "افتراضي", needField: "اكتب الحي أو الشارع على الأقل.",
      cityNote: "الخدمة مخصصة لمدينة برشيد.", gpsTag: "مع الموقع",
      restTitle: "المطاعم", favTitle: "مفضلتي", noRest: "لا توجد مطاعم متاحة الآن.",
      noFav: "لم تضف أي مطعم إلى المفضلة. اضغط على القلب في بطاقة المطعم.",
      open: "مفتوح", closed: "مغلق", fav: "أضف إلى المفضلة", unfav: "أزل من المفضلة",
      switchQ: "سلتك تحتوي على منتجات من مطعم آخر. هل تريد تفريغ السلة والانتقال إلى هذا المطعم؟",
      navFav: "المفضلة", noAddr: "بدون عنوان"
    },
    fr: {
      deliverTo: "Livrer à", choose: "Choisir l’adresse", addrTitle: "Adresse de livraison",
      useLoc: "Utiliser ma position", locating: "Localisation…", locOk: "Position enregistrée avec l’adresse",
      locDenied: "Accès à la position refusé. Saisissez l’adresse à la main.",
      locUnsupported: "Géolocalisation non prise en charge.",
      city: "Ville", hood: "Quartier", street: "Rue", bldg: "N° immeuble / étage / appartement",
      hint: "Indications d’accès (facultatif)", label: "Nom de l’adresse", labelPh: "Maison, travail…",
      save: "Enregistrer et utiliser cette adresse", saved: "Adresses enregistrées", none: "Aucune adresse enregistrée.",
      del: "Supprimer", def: "Par défaut", needField: "Indiquez au moins le quartier ou la rue.",
      cityNote: "Service réservé à Berrechid.", gpsTag: "avec position",
      restTitle: "Restaurants", favTitle: "Mes favoris", noRest: "Aucun restaurant disponible.",
      noFav: "Aucun favori. Touchez le cœur sur la carte d’un restaurant.",
      open: "Ouvert", closed: "Fermé", fav: "Ajouter aux favoris", unfav: "Retirer des favoris",
      switchQ: "Votre panier contient des produits d’un autre restaurant. Vider le panier et changer de restaurant ?",
      navFav: "Favoris", noAddr: "Sans adresse"
    },
    en: {
      deliverTo: "Deliver to", choose: "Choose delivery address", addrTitle: "Delivery address",
      useLoc: "Use my current location", locating: "Locating…", locOk: "Location saved with the address",
      locDenied: "Location access was denied. You can type the address instead.",
      locUnsupported: "This browser can’t share your location.",
      city: "City", hood: "Neighborhood", street: "Street", bldg: "Building / floor / apartment",
      hint: "Access notes (optional)", label: "Address name", labelPh: "Home, work…",
      save: "Save and use this address", saved: "Saved addresses", none: "No saved addresses yet.",
      del: "Delete", def: "Default", needField: "Enter at least the neighborhood or street.",
      cityNote: "Delivery is available in Berrechid only.", gpsTag: "with location",
      restTitle: "Restaurants", favTitle: "My favorites", noRest: "No restaurants available right now.",
      noFav: "No favorites yet. Tap the heart on a restaurant card.",
      open: "Open", closed: "Closed", fav: "Add to favorites", unfav: "Remove from favorites",
      switchQ: "Your cart has items from another restaurant. Clear the cart and switch to this one?",
      navFav: "Favorites", noAddr: "No address"
    }
  };

  var T2 = {
    ar: { navHome:"الرئيسية", navNotif:"الإشعارات", navStores:"المتاجر", navCart:"السلة", navProfile:"حسابي",
      pfTitle:"حسابي", guest:"زائر", guestSub:"سجّل الدخول لمتابعة طلباتك", signIn:"تسجيل الدخول / إنشاء حساب",
      editProfile:"تعديل الحساب", gOrders:"طلباتك", gSettings:"الإعدادات", gLegal:"الخصوصية والحساب",
      walletT:"المحفظة", walletBal:"الرصيد", walletOpen:"شحن المحفظة وعرض الحركات", walletErr:"تعذّر جلب الرصيد", walletRetry:"إعادة المحاولة", walletLoading:"جارٍ التحميل…", myOrders:"طلباتي", pharmacy:"الصيدلية — اطلب دواءك", favorites:"المفضلة", clearCart:"تفريغ السلة", language:"اللغة", theme:"المظهر",
      themeLight:"فاتح", themeDark:"داكن", sound:"الصوت", on:"مفعّل", off:"متوقف", install:"تثبيت التطبيق",
      support:"دردشة مع الدعم", callSupport:"الاتصال بالدعم", privacy:"سياسة الخصوصية", logout:"تسجيل الخروج", delAcc:"حذف الحساب",
      delConfirm:"هل أنت متأكد من حذف حسابك نهائيًا؟ سيتم مسح بياناتك ولا يمكن التراجع عن هذا الإجراء.",
      delOk:"تم حذف حسابك.", delErr:"تعذر حذف الحساب: ", langName:"العربية", close:"إغلاق" },
    fr: { navHome:"Accueil", navNotif:"Notifications", navStores:"Magasins", navCart:"Panier", navProfile:"Profil",
      pfTitle:"Mon profil", guest:"Invité", guestSub:"Connectez-vous pour suivre vos commandes", signIn:"Connexion / Inscription",
      editProfile:"Modifier le profil", gOrders:"Vos commandes", gSettings:"Paramètres", gLegal:"Confidentialité et compte",
      walletT:"Portefeuille", walletBal:"Solde", walletOpen:"Recharger et voir les mouvements", walletErr:"Solde indisponible", walletRetry:"Réessayer", walletLoading:"Chargement…", myOrders:"Mes commandes", pharmacy:"Pharmacie — demander un médicament", favorites:"Favoris", clearCart:"Vider le panier", language:"Langue", theme:"Thème",
      themeLight:"Clair", themeDark:"Sombre", sound:"Son", on:"Activé", off:"Désactivé", install:"Installer l’application",
      support:"Discuter avec le support", callSupport:"Appeler le support", privacy:"Politique de confidentialité", logout:"Déconnexion", delAcc:"Supprimer le compte",
      delConfirm:"Supprimer définitivement votre compte ? Vos données seront effacées et cette action est irréversible.",
      delOk:"Votre compte a été supprimé.", delErr:"Suppression impossible : ", langName:"Français", close:"Fermer" },
    en: { navHome:"Home", navNotif:"Notifications", navStores:"Stores", navCart:"Cart", navProfile:"Profile",
      pfTitle:"My profile", guest:"Guest", guestSub:"Sign in to follow your orders", signIn:"Sign in / Create account",
      editProfile:"Edit profile", gOrders:"Your orders", gSettings:"Settings", gLegal:"Privacy and account",
      walletT:"Wallet", walletBal:"Balance", walletOpen:"Top up and view transactions", walletErr:"Couldn't load the balance", walletRetry:"Retry", walletLoading:"Loading…", myOrders:"My orders", pharmacy:"Pharmacy — ask for a medicine", favorites:"Favorites", clearCart:"Clear cart", language:"Language", theme:"Theme",
      themeLight:"Light", themeDark:"Dark", sound:"Sound", on:"On", off:"Off", install:"Install app",
      support:"Chat with support", callSupport:"Call support", privacy:"Privacy policy", logout:"Log out", delAcc:"Delete account",
      delConfirm:"Delete your account permanently? Your data will be erased and this can’t be undone.",
      delOk:"Your account was deleted.", delErr:"Couldn’t delete the account: ", langName:"English", close:"Close" }
  };
  Object.keys(T2).forEach(function (k) { Object.assign(T[k], T2[k]); });
  function t(k) { var d = T[lang] || T.ar; return d[k] != null ? d[k] : T.ar[k]; }

  function $(id) { return document.getElementById(id); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function readJSON(key, fb) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; }
  }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage full/blocked */ } }

  /* ---------------- addresses (v3: first-run sheet, 2-step bottom sheet, reverse geocoding, account sync) ---------------- */
  var SA = window.SiymonAddr;
  var PROMPTED_KEY = "siymon_addr_prompted_v1";
  var AT = {
    ar: {
      title: "أين تريد استلام طلبك؟", intro: "تحديد موقعك يساعدنا على عرض المطاعم المتاحة وتوصيل طلبك إلى العنوان الصحيح.",
      locate: "تحديد موقعي الحالي", manual: "إدخال العنوان يدويًا", later: "لاحقًا", current: "العنوان الحالي",
      change: "تغيير", refresh: "تحديث الموقع", addNew: "إضافة عنوان جديد", saved: "العناوين المحفوظة", none: "لا توجد عناوين محفوظة بعد.",
      formNew: "عنوان جديد", formEdit: "تعديل العنوان", back: "رجوع", locating: "جارٍ تحديد موقعك…",
      found: "تم تحديد موقعك. راجع العنوان وأكمل التفاصيل.", foundNoName: "تم تحديد موقعك لكن تعذّر تحويله إلى عنوان. أكمل الحقول يدويًا.",
      denied: "لم يتم السماح بالوصول إلى الموقع. يمكنك إدخال العنوان يدويًا.", unsupported: "المتصفح لا يدعم تحديد الموقع. أدخل العنوان يدويًا.",
      timeout: "انتهت مهلة تحديد الموقع. حاول مرة أخرى أو أدخل العنوان يدويًا.", unavailable: "تعذّر تحديد موقعك (GPS غير متاح). أدخل العنوان يدويًا.",
      offline: "لا يوجد اتصال بالإنترنت. أدخل العنوان يدويًا أو حاول لاحقًا.",
      save: "حفظ العنوان واستخدامه", savedToast: "تم حفظ العنوان ✅", changedToast: "تم تغيير عنوان التوصيل ✅",
      needField: "اكتب الحي أو الشارع (حرفان على الأقل).", home: "المنزل", work: "العمل", other: "آخر",
      city: "المدينة", cityNote: "الخدمة مخصصة لمدينة برشيد.", hood: "الحي", street: "الشارع", bldg: "رقم المبنى / الطابق / الشقة",
      hint: "ملاحظات للوصول (اختياري)", label: "اسم العنوان", del: "حذف", edit: "تعديل", def: "الحالي", gps: "مع الموقع", close: "إغلاق",
      choose: "اختر عنوان التوصيل", deliverTo: "التوصيل إلى"
    },
    fr: {
      title: "Où souhaitez-vous être livré ?", intro: "Votre position nous aide à afficher les restaurants disponibles et à livrer à la bonne adresse.",
      locate: "Utiliser ma position", manual: "Saisir l’adresse", later: "Plus tard", current: "Adresse actuelle",
      change: "Changer", refresh: "Actualiser la position", addNew: "Ajouter une adresse", saved: "Adresses enregistrées", none: "Aucune adresse enregistrée.",
      formNew: "Nouvelle adresse", formEdit: "Modifier l’adresse", back: "Retour", locating: "Localisation en cours…",
      found: "Position trouvée. Vérifiez l’adresse et complétez les détails.", foundNoName: "Position trouvée mais impossible de la convertir en adresse. Complétez les champs.",
      denied: "Accès à la position refusé. Vous pouvez saisir l’adresse.", unsupported: "Géolocalisation non prise en charge. Saisissez l’adresse.",
      timeout: "Délai dépassé. Réessayez ou saisissez l’adresse.", unavailable: "Position indisponible (GPS). Saisissez l’adresse.",
      offline: "Pas de connexion Internet. Saisissez l’adresse ou réessayez plus tard.",
      save: "Enregistrer et utiliser", savedToast: "Adresse enregistrée ✅", changedToast: "Adresse de livraison modifiée ✅",
      needField: "Indiquez le quartier ou la rue (2 caractères min.).", home: "Maison", work: "Travail", other: "Autre",
      city: "Ville", cityNote: "Service réservé à Berrechid.", hood: "Quartier", street: "Rue", bldg: "N° immeuble / étage / appartement",
      hint: "Indications d’accès (facultatif)", label: "Nom de l’adresse", del: "Supprimer", edit: "Modifier", def: "Actuelle", gps: "avec position", close: "Fermer",
      choose: "Choisir l’adresse", deliverTo: "Livrer à"
    },
    en: {
      title: "Where should we deliver?", intro: "Your location helps us show available restaurants and deliver to the right address.",
      locate: "Use my current location", manual: "Enter address manually", later: "Later", current: "Current address",
      change: "Change", refresh: "Update location", addNew: "Add new address", saved: "Saved addresses", none: "No saved addresses yet.",
      formNew: "New address", formEdit: "Edit address", back: "Back", locating: "Locating you…",
      found: "Location found. Review the address and add details.", foundNoName: "Location found but couldn’t be turned into an address. Please fill in the fields.",
      denied: "Location access was denied. You can enter the address instead.", unsupported: "Location isn’t supported by this browser. Enter the address instead.",
      timeout: "Locating timed out. Try again or enter the address.", unavailable: "Couldn’t get your location (GPS unavailable). Enter the address.",
      offline: "No internet connection. Enter the address or try again later.",
      save: "Save and use this address", savedToast: "Address saved ✅", changedToast: "Delivery address changed ✅",
      needField: "Enter the neighborhood or street (2+ characters).", home: "Home", work: "Work", other: "Other",
      city: "City", cityNote: "Service is limited to Berrechid.", hood: "Neighborhood", street: "Street", bldg: "Building / floor / apartment",
      hint: "Access notes (optional)", label: "Address name", del: "Delete", edit: "Edit", def: "Current", gps: "with GPS", close: "Close",
      choose: "Choose delivery address", deliverTo: "Deliver to"
    }
  };
  function at(k) { var d = AT[lang] || AT.ar; return d[k] != null ? d[k] : AT.ar[k]; }

  var addresses = readJSON(ADDR_KEY, []);
  addresses = SA.sanitizeList(addresses);
  var draft = null; // { id?, lat, lng, hood, street, bldg, hint, label }
  var view = "home"; // "home" | "form"
  var firstRun = false, locating = false, sheetMsg = "";

  function saveAddresses() { writeJSON(ADDR_KEY, addresses); pushToServer(); }
  function defaultAddress() { return addresses.find(function (a) { return a.isDefault; }) || addresses[0] || null; }
  function cityOf(a) { return (a && a.city) || CITY[lang] || CITY.ar; }
  function addressText(a) { return [cityOf(a), a.hood, a.street, a.bldg].filter(Boolean).join("، "); }
  function shortText(a) { return [a.hood, a.street].filter(Boolean).join("، ") || a.label || ""; }

  function applyAddress(a) {
    var field = $("custAddr");
    if (!a) {
      exactLat = null; exactLng = null; areaInside = null;
      if (field) { field.value = ""; field.dispatchEvent(new Event("input", { bubbles: true })); }
      renderAddrBar(); return;
    }
    if (field) {
      field.value = addressText(a) + (a.hint ? " — " + a.hint : "");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    areaInside = null;
    if (a.lat != null && a.lng != null) {
      exactLat = a.lat; exactLng = a.lng;
      // Early feedback; any server-side area rule still applies on order.
      checkServiceArea(a.lat, a.lng).then(function (inside) {
        var b = $("addrBar"); if (b) b.classList.toggle("out", inside === false);
        if (inside === false && typeof toast === "function") toast(areaMsg("outside"));
      });
    } else { exactLat = null; exactLng = null; }
    var bar = $("addrBar"); if (bar) bar.classList.remove("out");
    renderAddrBar();
    document.dispatchEvent(new CustomEvent("siymon:address-changed", { detail: a }));
  }
  window.siymonReapplyAddress = function () { var d = defaultAddress(); if (d) applyAddress(d); };

  /* ---- top bar: [📍 deliver to / address ▾] [↻] ---- */
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  var REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  function buildAddrBar() {
    var topbar = document.querySelector(".home .topbar");
    if (!topbar || $("addrBar")) return;
    var title = $("brandTitle"); if (title) title.textContent = "Siymon | سيمون";
    var bar = h("div", "addr-bar"); bar.id = "addrBar";
    var main = h("button", "addr-main"); main.type = "button"; main.id = "addrMain";
    var ic = h("span", "addr-pin"); ic.innerHTML = PIN; ic.setAttribute("aria-hidden", "true");
    var tx = h("span", "addr-txt");
    tx.appendChild(h("span", "addr-lbl")); tx.appendChild(h("span", "addr-val"));
    main.appendChild(ic); main.appendChild(tx); main.appendChild(h("span", "addr-chev", "▾"));
    main.addEventListener("click", function () { openAddrSheet({}); });
    var ref = h("button", "addr-refresh"); ref.type = "button"; ref.id = "addrRefresh";
    ref.innerHTML = REFRESH; 
    ref.addEventListener("click", function () { openAddrSheet({ autoLocate: true }); });
    bar.appendChild(main); bar.appendChild(ref);
    topbar.parentNode.insertBefore(bar, topbar.nextSibling);
  }
  function renderAddrBar() {
    var b = $("addrBar"); if (!b) return;
    var d = defaultAddress();
    b.querySelector(".addr-lbl").textContent = at("deliverTo") + " · " + cityOf(d);
    b.querySelector(".addr-val").textContent = d ? (shortText(d) || at("choose")) : at("choose");
    var r = $("addrRefresh"); if (r) { r.setAttribute("aria-label", at("refresh")); r.title = at("refresh"); }
    var m = $("addrMain"); if (m) m.setAttribute("aria-label", at("deliverTo") + ": " + (d ? shortText(d) : at("choose")));
  }

  /* ---- bottom sheet ---- */
  var sheet, trapPrev = null;
  function buildAddrSheet() {
    sheet = h("div", "sheet"); sheet.id = "addrSheet"; sheet.hidden = true;
    var card = h("div", "sheet-card addr-card");
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-labelledby", "addrTitle");
    var head = h("div", "sheet-head");
    var back = h("button", "round addr-back", "→"); back.type = "button"; back.id = "addrBack"; back.hidden = true;
    back.addEventListener("click", function () { view = "home"; sheetMsg = ""; render(); });
    var title = h("h2", null, ""); title.id = "addrTitle";
    var close = h("button", "round", "✕"); close.type = "button"; close.id = "addrClose";
    close.addEventListener("click", closeAddrSheet);
    head.appendChild(back); head.appendChild(title); head.appendChild(close);
    var body = h("div", "addr-body"); body.id = "addrBody";
    card.appendChild(head); card.appendChild(body); sheet.appendChild(card);
    sheet.addEventListener("click", function (e) { if (e.target === sheet) closeAddrSheet(); });
    document.body.appendChild(sheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeAddrSheet(); });
  }
  function closeAddrSheet() {
    if (!sheet) return;
    sheet.hidden = true; locating = false;
    if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll");
    if (trapPrev && trapPrev.focus) { try { trapPrev.focus(); } catch (e) {} }
  }
  function openAddrSheet(opts) {
    opts = opts || {};
    if (!sheet) buildAddrSheet();
    trapPrev = document.activeElement;
    firstRun = !!opts.first; view = "home"; sheetMsg = ""; draft = null;
    sheet.hidden = false; document.body.classList.add("no-scroll");
    render();
    if (opts.autoLocate) locate();
  }
  function lbl(text) { return h("div", "addr-sec", text); }

  function render() {
    var body = $("addrBody"); body.replaceChildren();
    $("addrBack").hidden = view !== "form";
    $("addrClose").setAttribute("aria-label", at("close"));
    $("addrBack").setAttribute("aria-label", at("back"));
    if (view === "form") { renderForm(body); return; }
    $("addrTitle").textContent = at("title");
    if (firstRun) body.appendChild(h("p", "addr-intro", at("intro")));

    var geo = h("button", "btn addr-geo"); geo.type = "button"; geo.id = "addrLocate";
    geo.innerHTML = PIN; geo.appendChild(h("span", null, locating ? at("locating") : at("locate")));
    geo.disabled = locating; if (locating) geo.classList.add("is-loading");
    geo.addEventListener("click", locate);
    body.appendChild(geo);
    var msg = h("div", "addr-msg"); msg.id = "addrMsg"; msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    msg.textContent = locating ? "" : sheetMsg; body.appendChild(msg);

    var man = h("button", "btn addr-manual", at("manual")); man.type = "button"; man.id = "addrManual";
    man.addEventListener("click", function () { startForm(null); });
    body.appendChild(man);

    var cur = defaultAddress();
    if (cur) {
      body.appendChild(lbl(at("saved")));
      addresses.forEach(function (a) {
        var row = h("div", "addr-row" + (a.id === cur.id ? " on" : ""));
        var pick = h("button", "addr-pick"); pick.type = "button";
        pick.setAttribute("data-id", a.id);
        pick.appendChild(h("b", null, a.label || shortText(a)));
        pick.appendChild(h("span", null, addressText(a) + (a.lat != null ? " · " + at("gps") : "")));
        pick.addEventListener("click", function () { chooseAddress(a.id); });
        var side = h("div", "addr-side");
        if (a.id === cur.id) side.appendChild(h("span", "addr-cur", at("def")));
        var ed = h("button", "addr-act", at("edit")); ed.type = "button"; ed.addEventListener("click", function () { startForm(a); });
        var del = h("button", "addr-act addr-del", at("del")); del.type = "button"; del.addEventListener("click", function () { removeAddress(a.id); });
        side.appendChild(ed); side.appendChild(del);
        row.appendChild(pick); row.appendChild(side); body.appendChild(row);
      });
    } else if (!firstRun) {
      body.appendChild(h("div", "addr-none", at("none")));
    }
    if (firstRun) {
      var later = h("button", "addr-later", at("later")); later.type = "button"; later.id = "addrLater";
      later.addEventListener("click", closeAddrSheet); body.appendChild(later);
    }
  }

  function chooseAddress(id) {
    var a = addresses.find(function (x) { return x.id === id; }); if (!a) return;
    addresses.forEach(function (x) { x.isDefault = x.id === id; });
    saveAddresses(); applyAddress(a); closeAddrSheet();
    if (typeof toast === "function") toast(at("changedToast"));
  }
  function removeAddress(id) {
    addresses = addresses.filter(function (x) { return x.id !== id; });
    if (addresses.length && !addresses.some(function (x) { return x.isDefault; })) addresses[0].isDefault = true;
    saveAddresses();
    applyAddress(defaultAddress());
    render();
  }

  function startForm(a) {
    draft = a ? { id: a.id, lat: a.lat, lng: a.lng, hood: a.hood, street: a.street, bldg: a.bldg, hint: a.hint, label: a.label }
              : { id: null, lat: null, lng: null, hood: "", street: "", bldg: "", hint: "", label: "" };
    view = "form"; render();
    var f = $("adHood"); if (f) f.focus();
  }
  function fieldEl(id, label, value, opts) {
    opts = opts || {};
    var w = h("label", "addr-field"); w.appendChild(h("span", null, label));
    var i = h("input"); i.id = id; i.type = "text"; i.maxLength = opts.max || 120; i.value = value || "";
    if (opts.ph) i.placeholder = opts.ph; if (opts.autocomplete) i.autocomplete = opts.autocomplete;
    w.appendChild(i); return w;
  }
  function renderForm(body) {
    $("addrTitle").textContent = draft.id ? at("formEdit") : at("formNew");
    if (sheetMsg) { var m = h("div", "addr-msg ok"); m.setAttribute("role", "status"); m.textContent = sheetMsg; body.appendChild(m); }
    var cityW = h("div", "addr-field"); cityW.appendChild(h("span", null, at("city")));
    var chip = h("div", "addr-city", (CITY[lang] || CITY.ar)); chip.appendChild(h("small", null, at("cityNote"))); cityW.appendChild(chip);
    body.appendChild(cityW);
    body.appendChild(fieldEl("adHood", at("hood"), draft.hood, { max: 80 }));
    body.appendChild(fieldEl("adStreet", at("street"), draft.street));
    body.appendChild(fieldEl("adBldg", at("bldg"), draft.bldg, { max: 80 }));
    body.appendChild(fieldEl("adHint", at("hint"), draft.hint, { max: 200 }));
    var lw = fieldEl("adLabel", at("label"), draft.label, { max: 40 });
    var chips = h("div", "addr-chips");
    [["home", at("home")], ["work", at("work")], ["other", at("other")]].forEach(function (c) {
      var b = h("button", "addr-chip", c[1]); b.type = "button";
      b.addEventListener("click", function () { $("adLabel").value = c[1]; });
      chips.appendChild(b);
    });
    lw.appendChild(chips); body.appendChild(lw);
    var err = h("div", "addr-err"); err.id = "addrErr"; err.setAttribute("role", "alert"); body.appendChild(err);
    var save = h("button", "btn addr-save", at("save")); save.type = "button"; save.id = "addrSave";
    save.addEventListener("click", submitForm);
    body.appendChild(save);
  }
  function submitForm() {
    var err = $("addrErr");
    var cand = SA.sanitizeAddress({
      id: draft.id || undefined, label: $("adLabel").value, city: CITY[lang] || CITY.ar,
      hood: $("adHood").value, street: $("adStreet").value, bldg: $("adBldg").value, hint: $("adHint").value,
      lat: draft.lat, lng: draft.lng, isDefault: true, updatedAt: Date.now()
    });
    if (!cand) { err.textContent = at("needField"); return; }
    err.textContent = "";
    var isEdit = !!draft.id;
    addresses = addresses.filter(function (x) { return x.id !== cand.id; });
    addresses.forEach(function (x) { x.isDefault = false; });
    addresses.unshift(cand); addresses = SA.sanitizeList(addresses);
    saveAddresses(); applyAddress(cand); closeAddrSheet();
    if (typeof toast === "function") toast(isEdit ? at("savedToast") : at("changedToast"));
  }

  /* ---- locate: always a fresh GPS read, then reverse geocode (server-side) ---- */
  function geoErrorMsg(e) {
    if (!e) return at("unavailable");
    if (e.code === 1) return at("denied");
    if (e.code === 3) return at("timeout");
    return at("unavailable");
  }
  function getPosition() {
    return new Promise(function (ok, fail) {
      if (!navigator.geolocation) { fail({ code: -1, unsupported: true }); return; }
      navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    });
  }
  function reverseGeocode(lat, lng) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, 7000) : null;
    return fetch("/api/geocode/reverse", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: lat, lng: lng, lang: lang }), signal: ctl ? ctl.signal : undefined
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) { if (tm) clearTimeout(tm); return d && d.ok ? d : null; });
  }
  var locateSeq = 0;
  function locate() {
    if (locating) return;
    if (!navigator.geolocation) { sheetMsg = at("unsupported"); view = "home"; render(); return; }
    if (navigator.onLine === false) { sheetMsg = at("offline"); view = "home"; render(); return; }
    var seq = ++locateSeq, pos = null;
    locating = true; sheetMsg = ""; view = "home"; render();
    getPosition().then(function (p) {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      return checkServiceArea(pos.lat, pos.lng);
    }).then(function (inside) {
      if (inside === false) return { outside: true };
      return reverseGeocode(pos.lat, pos.lng).then(function (g) { return { g: g }; });
    }).then(function (r) {
      if (seq !== locateSeq || !sheet || sheet.hidden) { locating = false; return; } // closed or superseded
      locating = false;
      if (r.outside) { sheetMsg = areaMsg("outside"); view = "home"; render(); return; }
      var g = r.g;
      draft = { id: null, lat: pos.lat, lng: pos.lng, hood: g ? g.hood : "", street: g ? g.street : "", bldg: g ? g.bldg : "", hint: "", label: "" };
      sheetMsg = g && (g.hood || g.street) ? at("found") : at("foundNoName");
      view = "form"; render();
      var f = $(g && g.hood ? "adStreet" : "adHood"); if (f) f.focus();
    }).catch(function (e) {
      if (seq !== locateSeq) return;
      locating = false; view = "home";
      sheetMsg = e && e.unsupported ? at("unsupported") : geoErrorMsg(e);
      if (sheet && !sheet.hidden) render();
    });
  }

  /* ---- account sync: guests stay local; on login merge without loss/duplicates ---- */
  var pushTimer = null;
  function authHeaders() {
    var tok = typeof getCustomerToken === "function" ? getCustomerToken() : "";
    return tok ? { "Content-Type": "application/json", Authorization: "Bearer " + tok } : null;
  }
  function pushToServer() {
    var hd = authHeaders(); if (!hd) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      fetch("/api/customer/addresses", { method: "PUT", headers: hd, body: JSON.stringify({ addresses: addresses }) }).catch(function () {});
    }, 400);
  }
  function syncFromServer() {
    var hd = authHeaders(); if (!hd) return Promise.resolve(false);
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, 4000) : null;
    return fetch("/api/customer/addresses", { headers: hd, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (tm) clearTimeout(tm);
        if (!d || !d.ok) return false;
        var merged = SA.mergeLists(addresses, d.addresses || []);
        var changed = JSON.stringify(merged) !== JSON.stringify(addresses);
        addresses = merged; writeJSON(ADDR_KEY, addresses);
        if (JSON.stringify(SA.sanitizeList(d.addresses || [])) !== JSON.stringify(merged)) pushToServer();
        return changed;
      }).catch(function () { return false; });
  }
  window.siymonSyncAddresses = function () { return syncFromServer().then(function (c) { if (c) { applyAddress(defaultAddress()); } return c; }); };

  /* ---------------- favorites ---------------- */
  var favs = readJSON(FAV_KEY, []);
  if (!Array.isArray(favs)) favs = [];
  var favOnly = false;
  function isFav(id) { return favs.indexOf(String(id)) >= 0; }
  function toggleFav(id) {
    id = String(id);
    favs = isFav(id) ? favs.filter(function (x) { return x !== id; }) : favs.concat(id);
    writeJSON(FAV_KEY, favs);
  }

  /* ---------------- restaurant cards ---------------- */
  var HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 5 5.9 5c2 0 3.3 1.1 4.1 2.3C10.8 6.1 12.1 5 14.1 5c3.3 0 5 3.4 3.5 6.8C19.5 16.4 12 21 12 21Z";
  function heartSvg() {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icon");
    var p = document.createElementNS(ns, "path"); p.setAttribute("d", HEART); s.appendChild(p); return s;
  }
  function initialAvatar(name) {
    var ch = (name || "?").trim().charAt(0).toUpperCase().replace(/[<>&"']/g, "");
    return "data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#5DD62C"/>' +
      '<text x="48" y="62" font-size="44" text-anchor="middle" fill="#fff" font-family="sans-serif">' + ch + "</text></svg>");
  }
  function cartRestaurantId() {
    var rid = null;
    cart.forEach(function (_q, pid) {
      if (rid) return;
      var p = getProduct(pid);
      if (p && p.restaurantId) rid = String(p.restaurantId);
    });
    return rid;
  }
  function selectRestaurant(id) {
    id = String(id);
    if (id === String(selectedRestaurantId)) return true;
    var inCart = cartRestaurantId();
    if (cart.size > 0 && inCart && inCart !== id) {
      if (!window.confirm(t("switchQ"))) return false;
      cart.clear();
    }
    selectedRestaurantId = id;
    try { localStorage.setItem("siymon_selected_rest_v1", id); } catch (e) { /* ignore */ }
    normalizeActiveCat(); renderAll(); saveCart();
    return true;
  }
  window.siymonSelectRestaurant = selectRestaurant;

  renderRestaurants = function () {
    var box = $("restaurantChips"); if (!box) return;
    var title = $("restTitle");
    var q = String(searchQ || "").trim().toLowerCase();
    var all = (RESTAURANTS || []).filter(function (r) { return r && r.isActive !== false; });
    var list = all.filter(function (r) {
      if (favOnly && !isFav(r.id)) return false;
      if (!q) return true;
      return (textForLang(r.name) + " " + (r.address || "")).toLowerCase().indexOf(q) >= 0;
    });
    box.classList.remove("chips"); box.classList.add("rest-row");
    if (title) title.textContent = favOnly ? t("favTitle") : t("restTitle");
    box.replaceChildren();
    if (!all.length) { box.style.display = "none"; if (title) title.style.display = "none"; return; }
    box.style.display = ""; if (title) title.style.display = "";
    if (!list.length) { box.appendChild(h("div", "rest-empty", favOnly ? t("noFav") : t("noRest"))); return; }

    list.forEach(function (r) {
      var name = textForLang(r.name) || String(r.id);
      var sel = String(selectedRestaurantId) === String(r.id);
      var card = h("div", "rcard" + (sel ? " sel" : ""));
      card.setAttribute("role", "button"); card.tabIndex = 0;
      card.setAttribute("aria-pressed", sel ? "true" : "false");
      var cover = h("div", "rcard-cover" + (r.cover ? "" : " empty"));
      if (r.cover && /^(\/uploads\/|https:\/\/)/.test(r.cover)) cover.style.backgroundImage = 'url("' + r.cover.replace(/"/g, "%22") + '")';
      var heart = h("button", "rcard-fav" + (isFav(r.id) ? " on" : "")); heart.type = "button";
      heart.setAttribute("aria-label", isFav(r.id) ? t("unfav") : t("fav"));
      heart.setAttribute("aria-pressed", isFav(r.id) ? "true" : "false");
      heart.appendChild(heartSvg());
      heart.addEventListener("click", function (e) { e.stopPropagation(); toggleFav(r.id); renderRestaurants(); });
      cover.appendChild(heart);
      var logo = h("img", "rcard-logo"); logo.alt = ""; logo.loading = "lazy";
      logo.onerror = function () { logo.onerror = null; logo.src = initialAvatar(name); };
      logo.src = r.logo || initialAvatar(name);
      var info = h("div", "rcard-info");
      info.appendChild(h("b", "rcard-name", name));
      if (r.address) info.appendChild(h("span", "rcard-addr", r.address));
      var st = h("span", "rcard-st " + (isOpenNow ? "open" : "closed"), isOpenNow ? t("open") : t("closed"));
      info.appendChild(st);
      card.appendChild(cover); card.appendChild(logo); card.appendChild(info);
      var go = function () { selectRestaurant(r.id); };
      card.addEventListener("click", go);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      box.appendChild(card);
    });
  };

  /* ---------------- bottom nav (dark pill) + profile ---------------- */
  var ICON = {
    home: '<path class="fl" d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-7.8Z"/><path class="dt" d="M10 14.5v3M14 14.5v3"/>',
    bell: '<path class="fl" d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.2H4.4L6 16Z"/><path d="M10 20.8a2.2 2.2 0 0 0 4 0"/>',
    store: '<path class="fl" d="M4 9.5 5.6 4.5h12.8L20 9.5a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4-2Z"/><path d="M5.5 12.8V20h13v-7.2"/><path class="dt" d="M10 20v-3.5h4V20"/>',
    cart: '<path class="fl" d="M5 9h14l-1.4 9.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 9Z"/><path d="M8.5 9 11 4.5M15.5 9 13 4.5"/><path class="dt" d="M10 13v3M14 13v3"/>',
    user: '<circle class="fl" cx="12" cy="12" r="9"/><circle class="dt" cx="12" cy="10" r="2.8"/><path class="dt" d="M6.8 18.2c1.2-2.2 3.2-3.2 5.2-3.2s4 1 5.2 3.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.5-2.2-.5-1.2.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-1.5 2.5-4 2.5"/>',
    shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    logout: '<path d="M10 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h4"/><path d="m15 8 4 4-4 4M19 12H9"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.6-9.2C.9 7.4 2.6 4 5.9 4c2 0 3.3 1.1 4.1 2.3C10.8 5.1 12.1 4 14.1 4c3.3 0 5 3.4 3.5 6.8C19.5 15.4 12 20 12 20Z"/>',
    wallet: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5H17v3"/><path d="M3.5 7.5v9a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-13a2 2 0 0 1-2-1Z"/><circle cx="16" cy="13" r="1.1"/>',
    pill: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>'
  };
  function svgIcon(key, cls) {
    var s = h("span", cls || "ic"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + ICON[key] + "</svg>"; // static trusted strings only
    return s;
  }

  var NAV = [["home", "navHome"], ["bell", "navNotif"], ["store", "navStores"], ["cart", "navCart"], ["user", "navProfile"]];
  var navKey = "home", prevNavKey = "home";
  function setActive(key) {
    navKey = key;
    var nav = document.querySelector(".bottom-nav"); if (!nav) return;
    nav.querySelectorAll("button").forEach(function (b) {
      var on = b.dataset.key === key;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }
  function buildNav() {
    var nav = document.querySelector(".bottom-nav"); if (!nav || nav.dataset.v2) return;
    nav.dataset.v2 = "1"; nav.replaceChildren();
    NAV.forEach(function (it) {
      var b = h("button"); b.type = "button"; b.dataset.key = it[0]; b.id = "nav_" + it[0];
      b.appendChild(svgIcon(it[0], "ic")); b.appendChild(h("span", "lb", t(it[1])));
      b.setAttribute("aria-label", t(it[1]));
      if (it[0] === "cart") { var bd = h("b", null, "0"); bd.id = "navBadge"; bd.hidden = true; b.appendChild(bd); }
      if (it[0] === "bell") { var nb = h("b", null, "0"); nb.id = "navNotifBadge"; nb.hidden = true; b.appendChild(nb); }
      nav.appendChild(b);
    });
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var k = b.dataset.key;
      if (k === "home") { favOnly = false; renderRestaurants(); setActive("home"); if (window.siymonFeed) window.siymonFeed.showFeed(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (k === "bell") { window.location.href = "/notifications/"; }
      else if (k === "store") { setActive("store"); if (window.siymonFeed) window.siymonFeed.showStores(); }
      else if (k === "cart") { prevNavKey = navKey === "cart" ? prevNavKey : navKey; setActive("cart"); var g = $("goCart"); if (g) g.click(); }
      else if (k === "user") { prevNavKey = navKey === "user" ? prevNavKey : navKey; setActive("user"); openProfile(); }
    });
    var cs = $("cartSheet");
    if (cs) new MutationObserver(function () { if (cs.hidden && navKey === "cart") setActive(prevNavKey); }).observe(cs, { attributes: true, attributeFilter: ["hidden"] });
  }
  function scrollToStores() { var tt = $("restTitle"); if (tt) tt.scrollIntoView({ behavior: "smooth", block: "start" }); }

  /* profile */
  var SOUND_KEY = "siymon_customer_sound_v1";
  var TOKEN_KEY = "siymon_customer_token_v1", PROFILE_KEY = "siymon_customer_profile_v1";
  var pSheet;
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch (e) { return true; } }
  function langName() { return t("langName"); }
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }

  function row(icon, label, value, opts) {
    opts = opts || {};
    var el = h(opts.href ? "a" : "button", "pf-row" + (opts.danger ? " danger" : ""));
    if (opts.href) el.href = opts.href; else el.type = "button";
    el.appendChild(svgIcon(icon, "pf-ic"));
    el.appendChild(h("span", "pf-lb", label));
    if (value != null && value !== "") el.appendChild(h("span", "pf-val", value));
    if (opts.onClick) el.addEventListener("click", opts.onClick);
    return el;
  }
  function group(title, rows) {
    rows = rows.filter(Boolean);
    if (!rows.length) return null;
    var g = h("section", "pf-group"); g.appendChild(h("h3", null, title));
    rows.forEach(function (r) { g.appendChild(r); });
    return g;
  }
  function userInfo() {
    var p = null; try { p = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) { p = null; }
    if (!token() || !p) return null;
    var name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
    return { name: name || p.email || p.phone || "", sub: p.email || p.phone || "" };
  }

  /* wallet card: REAL balance from /api/customer/wallet (same data as the checkout and the wallet page) */
  var WL = { s: "idle", bal: 0, cur: "MAD" };
  function fetchWallet() {
    if (!token()) { WL = { s: "idle", bal: 0, cur: "MAD" }; return Promise.resolve(); }
    WL.s = "loading"; if (pSheet && !pSheet.hidden) renderProfile();
    return fetch("/api/customer/wallet", { headers: { Authorization: "Bearer " + token() }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (d) { WL = { s: "ok", bal: Number(d.walletBalance || 0), cur: d.currency || "MAD" }; })
      .catch(function () { WL.s = "err"; })
      .then(function () { if (pSheet && !pSheet.hidden) renderProfile(); });
  }
  function walletCard() {
    var c = h("section", "pf-wallet"); c.id = "pfWallet";
    var top = h("div", "pw-top"); top.appendChild(svgIcon("wallet", "pw-ic")); top.appendChild(h("span", "pw-lb", t("walletT")));
    c.appendChild(top);
    var amt = h("b", "pw-amt", WL.s === "ok" ? WL.bal.toFixed(2) + " " + WL.cur : WL.s === "err" ? "—" : "…");
    amt.id = "pfWalletAmt"; c.appendChild(amt);
    c.appendChild(h("small", "pw-sub", WL.s === "loading" || WL.s === "idle" ? t("walletLoading") : WL.s === "err" ? t("walletErr") : t("walletBal")));
    var acts = h("div", "pw-acts");
    var open = h("button", "pw-btn", t("walletOpen")); open.type = "button"; open.id = "pfWalletOpen";
    open.addEventListener("click", function () {
      closeProfile();
      if (window.siymonOpenWallet) window.siymonOpenWallet(); else location.href = "/wallet/";
    });
    acts.appendChild(open);
    if (WL.s === "err") { var rt = h("button", "pw-btn ghost", t("walletRetry")); rt.type = "button"; rt.id = "pfWalletRetry"; rt.addEventListener("click", fetchWallet); acts.appendChild(rt); }
    c.appendChild(acts);
    return c;
  }

  function renderProfile() {
    var body = $("pfBody"); if (!body) return;
    $("pfTitle").textContent = t("pfTitle");
    body.replaceChildren();
    var u = userInfo(), logged = !!token();

    var head = h("div", "pf-head");
    var av = h("div", "pf-av", u && u.name ? u.name.trim().charAt(0).toUpperCase() : "👤");
    if (!(u && u.name)) { av.textContent = ""; av.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'; }
    head.appendChild(av);
    head.appendChild(h("div", "pf-name", u ? u.name : t("guest")));
    head.appendChild(h("div", "pf-sub", u ? (u.sub !== u.name ? u.sub : "") : t("guestSub")));
    var cta = h("a", logged ? "pf-btn" : "pf-btn solid", logged ? t("editProfile") : t("signIn")); cta.href = "/orders/";
    head.appendChild(cta);
    body.appendChild(head);
    if (logged) body.appendChild(walletCard());

    var cartBtn = $("clearCart");
    var g1 = group(t("gOrders"), [
      row("receipt", t("myOrders"), "", { href: "/orders/" }),
      row("pill", t("pharmacy"), "", { href: "/pharmacy/" }),
      row("heart", t("favorites"), favs.length ? String(favs.length) : "", { onClick: function () {
        favOnly = true; renderRestaurants(); closeProfile(); setActive("store"); scrollToStores(); } }),
      cart.size > 0 && cartBtn ? row("cart", t("clearCart"), "", { onClick: function () { cartBtn.click(); renderProfile(); } }) : null
    ]);
    var inst = $("installBtn");
    var support = (typeof PUBLIC !== "undefined" && PUBLIC && PUBLIC.supportPhone) ? String(PUBLIC.supportPhone) : "";
    var g2 = group(t("gSettings"), [
      row("globe", t("language"), langName(), { onClick: function () { var b = $("langToggle"); if (b) b.click(); setTimeout(function () { renderProfile(); renderAddrBar(); }, 50); } }),
      row("palette", t("theme"), isDark() ? t("themeDark") : t("themeLight"), { onClick: function () { var b = $("themeToggle"); if (b) b.click(); setTimeout(renderProfile, 50); } }),
      row("sound", t("sound"), soundOn() ? t("on") : t("off"), { onClick: function () {
        try { localStorage.setItem(SOUND_KEY, soundOn() ? "0" : "1"); } catch (e) { /* ignore */ } renderProfile(); } }),
      inst && inst.style.display !== "none" ? row("download", t("install"), "", { onClick: function () { inst.click(); } }) : null,
      row("headset", t("support"), "", { href: "/chat/" }),
      support ? row("headset", t("callSupport"), "", { href: "tel:" + support.replace(/[^+\d]/g, "") }) : null
    ]);
    var g3 = group(t("gLegal"), [
      row("shield", t("privacy"), "", { href: "/policy/" }),
      logged ? row("logout", t("logout"), "", { onClick: function () {
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
        renderProfile(); } }) : null,
      logged ? row("trash", t("delAcc"), "", { danger: true, onClick: deleteAccount }) : null
    ]);
    [g1, g2, g3].forEach(function (g) { if (g) body.appendChild(g); });
  }

  function deleteAccount() {
    if (!window.confirm(t("delConfirm"))) return;
    fetch("/api/customer/me", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Request failed"); return d; }); })
      .then(function () {
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
        toast(t("delOk")); renderProfile();
      })
      .catch(function (e) { toast(t("delErr") + e.message); });
  }

  function openProfile() {
    if (!pSheet) {
      pSheet = h("div", "sheet"); pSheet.id = "profileSheet"; pSheet.hidden = true;
      var card = h("div", "sheet-card pf"); card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
      var head = h("div", "sheet-head"); var ti = h("h2", null, ""); ti.id = "pfTitle";
      var cl = h("button", "round", "✕"); cl.type = "button"; cl.setAttribute("aria-label", t("close")); cl.addEventListener("click", closeProfile);
      head.appendChild(ti); head.appendChild(cl);
      var body = h("div", "pf-body"); body.id = "pfBody";
      card.appendChild(head); card.appendChild(body); pSheet.appendChild(card);
      pSheet.addEventListener("click", function (e) { if (e.target === pSheet) closeProfile(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pSheet.hidden) closeProfile(); });
      document.body.appendChild(pSheet);
    }
    renderProfile(); pSheet.hidden = false; document.body.classList.add("no-scroll");
    fetchWallet();
  }
  function closeProfile() {
    if (!pSheet) return;
    pSheet.hidden = true;
    if (!document.querySelector(".sheet:not([hidden])")) document.body.classList.remove("no-scroll");
    if (navKey === "user") setActive(prevNavKey);
  }

  window.addEventListener("siymon:wallet-closed", function () { if (pSheet && !pSheet.hidden) fetchWallet(); });

  /* keep texts in sync when the language changes (app.js re-runs renderAll) */
  var baseApply = applyI18n;
  applyI18n = function () {
    baseApply(); renderAddrBar();
    NAV.forEach(function (it) { var b = $("nav_" + it[0]); if (b) { b.querySelector(".lb").textContent = t(it[1]); b.setAttribute("aria-label", t(it[1])); } });
    if (pSheet && !pSheet.hidden) renderProfile();
  };

  var baseOpen = updateOpenStatus;
  updateOpenStatus = function () { baseOpen(); renderRestaurants(); };

  function maybeFirstRun() {
    if (addresses.length) return;
    if (readJSON(PROMPTED_KEY, false)) return;
    if (document.querySelector(".sheet:not([hidden])")) return;
    writeJSON(PROMPTED_KEY, true); // ask once; never nag on every visit
    openAddrSheet({ first: true });
  }
  function pollNotifBadge() {
    var b = $("navNotifBadge"); if (!b) return;
    if (!token()) { b.hidden = true; return; }
    fetch("/api/customer/notifications", { headers: { Authorization: "Bearer " + token() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var n = d ? (window.SNotif ? window.SNotif.unreadCount(d) : Number(d.unreadCount || 0)) : 0;
        b.textContent = n > 99 ? "99+" : String(n); b.hidden = n < 1;
      })
      .catch(function () { /* ignore */ });
  }
  /* links from the bottom bar of other pages: /#stores, /#cart, /#profile */
  function openFromHash() {
    var k = (location.hash || "").replace("#", "");
    if (["stores", "cart", "profile"].indexOf(k) < 0) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    setTimeout(function () {
      if (k === "stores") { setActive("store"); if (window.siymonFeed) window.siymonFeed.showStores(); }
      else if (k === "cart") { prevNavKey = "home"; setActive("cart"); var g = $("goCart"); if (g) g.click(); }
      else { prevNavKey = "home"; setActive("user"); openProfile(); }
    }, 350);
  }
  function init() {
    buildAddrBar(); buildNav();
    pollNotifBadge(); setInterval(pollNotifBadge, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) pollNotifBadge(); }); setActive("home"); renderAddrBar();
    var si = $("searchInput");
    if (si) si.addEventListener("input", function () { searchQ = si.value; renderRestaurants(); });
    var d = defaultAddress();
    if (d) applyAddress(d); // the saved address is the source of truth for cart/checkout
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    syncFromServer().then(function (changed) {
      if (changed) applyAddress(defaultAddress());
      setTimeout(maybeFirstRun, 500);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
