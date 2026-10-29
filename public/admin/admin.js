/* global */

const ICONS = {
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`,
};

const LOGO_RASTER_WB = 32; // 256px / 8 // 192px / 8
const LOGO_RASTER_H = 256;
const LOGO_RASTER_B64 =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/wAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/8AAAAAAAAB/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAA//8AAAAAAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAH//8AAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAf//8AAAAAAAP//wAAAAAAAAAAAAAAAAAAAAAAAAAAAD///4AAAAAAB///gAAAAAAAAAAAAAAAAAAAAAAAAAAAP///wAAAAAAH//+AAAAAAAAAAAAAAAAAAAAAAAAAAAB////gAAAAAA///8AAAAAAAAAAAAAAAAAAAAAAAAAAAH////AAwAAAD///wAAAAAAAAAAAAAAAAAAAAAAAAAAA////+ADAAAwAf//gAAAAAAAAAAAAAAAAAAAAAAAAAAH////4AeAADgA//+AAAAAAAAAAAAAAAAAAAAAAAAAAAf////wB4AAOAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAD/////APwAA4AH//wAAAAAAAAAAAAAAAAAAAAAAAAAAf////+B/AAHgAf//AAAAAAAAAAAAAAAAAAAAAACAAAD/////4H+AAfAB//8AAAAAAAAAAAAAAAAAAAAAAIAAAP/////h/8AD8AH//wAAAAAAAAAAAAAAAAAAAAAAwAAB//n//+P/4AP4Af//AAAAAAAAAAAAAAAAAAAAAADgAAf/8H/////gB/wD//8AAAAAAAAAAAAAAAAAAAAAAPAAD//wP/////gP/gf//wAAAAAAAAAAAAAAAAAAAAAA+AAf//Af/////j//3///AAAAAAAAAAAAAAAAAAAAAAD+AH//4A////////////8AAAAAAAAAAAAAAAAAAAAAAP/////gD////////////wAAAAAAAAAAAAAAAAAAAAAAf////+gP////////////AAAAAAAAAAAAAAAAAAAAAAB/////2B////////////8AAAAAAAAAAAAAAAAAAAAAAH/////cP////////////gAAAAAAAAAAAAAAAAAAAAAAf////5///5//n//////+AAAAAAAAAAAAAAAAAAAAAAB/////n///n/+v//////4AAAAAAAAAAAAAAAAAAAAAAD////8f//8f/w///////AAAAAAAAAAAAAAAAAAAAAAAP////x///w//B//////8AAAAAAAAAAAAAAAAAAAAAAAf///+H//+D/4D//9///gAAAAAAAAAAAAAAAAAAAAAAB////4P//wP/AH//z//8AAAAAAAAAAAAAAAAAAAAAAAD////A//+AfwAP/+H//gAAAAAAAAAAAAAAAAAAAAAAAP///4B//wB8AAf/wP/8AAAAAAAAAAAAAAAAAAAAAAAAf///AH/+AAAAA/+AP/AAAAAAAAAAAAAAAAAAAAAAAAA///4AH/gAAAAA/gADAAAAAAAAAAAAAAAAAAAAAAAAAB///AADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf8PgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADj4+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcHj4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADoODAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAZ/nxz4+AfgHPAAAAAAAAAAAAAAAAAAAAAAAAAAAD+Afj4ef/38Dnj//AAAAAAAAAAAAAAAAAAAAAAAAAAAP/A+Pg5///4efH/8AAAAAAAAAAAAAAAAAAAAAAAAAAA//B4fCD6+Pjw8fH4AAAAAAAAAAAAAAAAAAAAAAAAAAB/+Ph8IPj4+fD58PgAAAAAAAAAAAAAAAAAAAAAAAAAAD/4+Dxh+Pj58Pnw+AAAAAAAAAAAAAAAAAAAAAAAAAAAD/z4PkH4+Pnw+fH4AAAAAAAAAAAAAAAAAAAAAAAAAAGB/Pg+Qfj4+fD58fgAAAAAAAAAAAAAAAAAAAAAAAAAAcB8+B5B+Pj58Pnx+AAAAAAAAAAAAAAAAAAAAAAAAAABwDj4H4H4+Pnw+fH4AAAAAAAAAAAAAAAAAAAAAAAAAAHgOPgfgPj4+PDx8PgAAAAAAAAAAAAAAAAAAAAAAAAAAfBw+A+B+Pj4+eHx+AAAAAAAAAAAAAAAAAAAAAAAAAAA/+D8DwH5+fw7wfn4AAAAAAAAAAAAAAAAAAAAAAAAAAA/wHgDAPDw+B+A8PAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
function logoRasterCmd() {
  try {
    if (!LOGO_RASTER_B64) return null;
    const bin = atob(LOGO_RASTER_B64);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const header = Uint8Array.from([
      0x1d,
      0x76,
      0x30,
      0x00,
      LOGO_RASTER_WB & 0xff,
      (LOGO_RASTER_WB >> 8) & 0xff,
      LOGO_RASTER_H & 0xff,
      (LOGO_RASTER_H >> 8) & 0xff,
    ]);
    const out = new Uint8Array(header.length + data.length);
    out.set(header, 0);
    out.set(data, header.length);
    return out;
  } catch (_e) {
    return null;
  }
}

const el = (id) => document.getElementById(id);

/***********************
 * i18n
 ***********************/
const I18N = {
  ar: {
    dir: "rtl",
    brand: "لوحة المشرف",
    subtitle: "إدارة الطلبات والطباعة",
    logout: "خروج",
    refresh: "تحديث",
    settings: "الإعدادات",
    menuManage: "المطاعم والوجبات",
    connectBt: "اتصال BT",
    btConnected: "BT متصل",
    all: "الكل",
    new: "جديد",
    filterDay: "فلتر حسب اليوم",
    today: "اليوم",
    allBtn: "الكل",
    searchPh: "بحث بالاسم/الهاتف/العنوان/ID",
    thId: "ID",
    thTime: "الوقت",
    thCustomer: "الزبون",
    thTotal: "المجموع",
    thStatus: "الحالة",
    thActions: "إجراءات",
    detailsTitle: "تفاصيل الطلب",
    detailsEmpty: "اختر طلباً لعرض التفاصيل.",
    acceptedDriverTitle: "السائق الذي قبل الطلب",
    driverPhoneLabel: "هاتف السائق",
    driverAcceptedAtLabel: "وقت القبول",
    driverNotAccepted: "لم يتم قبول الطلب بعد",

    soundOn: "الصوت: تشغيل",
    soundOff: "الصوت: إيقاف",

    authTitle: "دخول المشرف",
    tabLogin: "تسجيل الدخول",
    tabSignup: "إنشاء حساب",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    password: "كلمة السر",

    confirmPassword: "تأكيد كلمة المرور",
    login: "دخول",
    signup: "إنشاء الحساب",
    signupHint:
      "إذا كان هذا أول مشرف فالتسجيل مفتوح. بعد ذلك يلزم تسجيل دخول مشرف.",

    wifiPrinting: "طباعة Wi‑Fi",
    enabled: "مفعّل",
    disabled: "معطّل",
    printerIp: "IP الطابعة",
    printerPort: "Port الطابعة",
    couriers: "أرقام السائقين (واتساب) — رقم في كل سطر",
    drivers: "السائقون",
    topups: "الشحن",
    bankAccountName: "اسم الحساب",
    bankAccount: "رقم الحساب البنكي (RIB/IBAN)",
    driverWalletEnabled: "محفظة السائق",
    driverCommission: "خصم/عمولة لكل طلب",
    policyRequireLabel: "إلزام الموافقة على سياسة الشركة عند إنشاء الحساب",
    required: "إلزامي",
    optional: "اختياري",
    policyAr: "سياسة الشركة (عربي)",
    policyFr: "سياسة الشركة (فرنسي)",
    policyEn: "سياسة الشركة (إنجليزي)",
    bannersLabel: "بانر العروض (صور)",
    bannersEmpty: "لا توجد صور عروض",
    bannerUploading: "جاري رفع الصورة...",
    bannerUploadOk: "تم رفع الصورة ✅",
    bannerUploadFail: "فشل رفع الصورة",
    supportTitle: "الدعم (دردشة الزبون)",
    supportConvosTitle: "المحادثات",
    send: "إرسال",
    typeMsg: "اكتب رسالة...",
    profile: "الملف الشخصي",
    nameLabel: "الاسم",
    cardLabel: "البطاقة",
    statusLabel: "الحالة",
    createdLabel: "تاريخ الإنشاء",
    faceBikeCard: "صورة الوجه + بطاقة الدراجة",
    idFront: "الهوية (أمام)",
    idBack: "الهوية (خلف)",
    noImage: "لا توجد صورة",
    save: "حفظ",
    close: "إغلاق",

    menuTitle: "إدارة المطاعم والوجبات",
    tabRestaurants: "المطاعم",
    tabMeals: "الوجبات",
    addRestaurant: "إضافة مطعم",
    addMeal: "إضافة وجبة",
    listRestaurants: "قائمة المطاعم",
    listMeals: "قائمة الوجبات",
    nameAr: "الاسم (AR)",
    nameEn: "الاسم (EN)",
    nameFr: "الاسم (FR)",
    descAr: "الوصف (AR)",
    descEn: "الوصف (EN)",
    descFr: "الوصف (FR)",
    address: "العنوان",
    active: "نشط",
    available: "متوفر",
    categoryKey: "مفتاح الصنف",
    categoryAr: "الصنف (AR)",
    categoryEn: "الصنف (EN)",
    categoryFr: "الصنف (FR)",
    imageUrl: "صورة الوجبة",
    uploadHint: "اختر صورة للوجبة (رفع مباشر)",
    uploading: "جاري رفع الصورة...",
    uploadOk: "تم رفع الصورة ✅",
    uploadFail: "فشل رفع الصورة",
    price: "السعر",
    restaurant: "المطعم",
    actions: "إجراءات",
    status: "الحالة",
    add: "إضافة",
    delete: "حذف",
    edit: "تعديل",
    editRestaurant: "تعديل المطعم",
    editMeal: "تعديل الوجبة",

    restaurantModeLabel: "حالة المطعم",
    modeAuto: "تلقائي",
    modeOpen: "مفتوح دائماً",
    modeClosed: "مغلق",
    restOpenBtn: "المطعم: مفتوح",
    restClosedBtn: "المطعم: مغلق",
    restAutoBtn: "المطعم: تلقائي",
    view: "عرض",
    whatsapp: "واتساب",
    done: "تم",
    sent: "أُرسل",
    wifiPrint: "طباعة Wi‑Fi",
    btPrint: "طباعة BT",
    htmlPrint: "طباعة (شكل احترافي)",
    editTicket: "تعديل وصل الزبون",
    deliveryFee: "رسوم التوصيل",
    addLine: "إضافة سطر",
    saveChanges: "حفظ التعديل",
    subtotal: "المجموع الفرعي",
    total: "المجموع",
    itemName: "الوجبة",
    qty: "الكمية",
    unitPrice: "الثمن",

    toastNew: "طلب جديد",
    toastOrders: "طلبات",
    errNoCourier: "أضف رقم سائق في الإعدادات",
    errBtUnsupported: "Bluetooth غير مدعوم في هذا المتصفح",
    errBtConnect: "فشل الاتصال بالبلوتوث",
    errBtChar: "لم يتم العثور على قناة كتابة للطابعة",
    errWifiDisabled: "طباعة Wi‑Fi معطلة من الإعدادات",
    errPwMismatch: "كلمتا السر غير متطابقتين",
    errNeedEmailPhone: "أدخل البريد الإلكتروني أو رقم الهاتف.",
    customers: "الزبائن",
    notifications: "الإشعارات",
    notificationsTitle: "الإشعارات",
    notifTitleLabel: "العنوان",
    notifMsgLabel: "النص",
    notifImgLabel: "صورة (اختياري)",
    sendNotif: "إرسال الإشعار",
    sentNotifs: "الإشعارات المرسلة",
    closeNotif: "إغلاق",
    restaurantPortal: "بوابة المطعم",
    restaurantLogin: "دخول المطعم",
    restaurantLoginHint: "حدد بريد/هاتف وكلمة سر للمطعم.",
    acceptOrder: "قبول",
    ordersTitle: "الطلبات",
    ordersFound: "{n} طلب",
    ordTabProcessing: "قيد المعالجة",
    ordTabDone: "المكتملة",
    ordTabCanceled: "الملغاة",
    ordShowing: "عرض {a}–{b} من {n}",
    ordPrev: "السابق",
    ordNext: "التالي",
    ordEmpty: "لا توجد طلبات.",
    custSearchPh: "بحث بالاسم أو البريد أو الهاتف",
    custRangeAll: "كل الفترات",
    custRangeToday: "اليوم",
    custRange7: "آخر 7 أيام",
    custRange30: "آخر 30 يوماً",
    custClear: "مسح الفلاتر",
    custCount: "{n} زبون",
    custResults: "{n} من {t} نتيجة",
    custActChat: "محادثة",
    custActOrders: "طلبات الزبون",
    custEmpty: "لا يوجد زبناء.",
    drvTabAll: "الكل",
    drvTabPending: "قيد المراجعة",
    drvTabApproved: "المقبولون",
    drvTabRejected: "المرفوضون",
    drvTabSuspended: "الموقوفون",
    drvCount: "{n} سائق",
    drvSearchPh: "بحث بالاسم أو البريد أو الهاتف أو البطاقة",
    drvEmpty: "لا يوجد سائقون.",
    drvPortal: "بوابة السائق",
    sendToDrivers: "إرسال للسائقين",
    auth: "حساب",
    clearPassword: "مسح كلمة السر",
    statusMap: {
      new: "جديد",
      admin_accepted: "تم قبوله من المشرف",
      restaurant_ready: "مرسل للسائقين",
      accepted: "قبل السائق",
      picked_up: "تم الاستلام",
      on_the_way: "في الطريق",
      delivered: "تم التسليم",
      done: "منتهي",
      canceled: "ملغي",
    },
  },
  en: {
    dir: "ltr",
    brand: "Admin Panel",
    subtitle: "Orders & Printing",
    logout: "Logout",
    refresh: "Refresh",
    settings: "Settings",
    menuManage: "Restaurants & Menu",
    connectBt: "Connect BT",
    btConnected: "BT Connected",
    all: "All",
    new: "New",
    filterDay: "Filter by day",
    today: "Today",
    allBtn: "All",
    searchPh: "Search by name/phone/address/ID",
    thId: "ID",
    thTime: "Time",
    thCustomer: "Customer",
    thTotal: "Total",
    thStatus: "Status",
    thActions: "Actions",
    detailsTitle: "Order details",
    detailsEmpty: "Select an order to view details.",
    acceptedDriverTitle: "Accepted driver",
    driverPhoneLabel: "Driver phone",
    driverAcceptedAtLabel: "Accepted at",
    driverNotAccepted: "Not accepted yet",

    soundOn: "Sound ON",
    soundOff: "Sound OFF",

    authTitle: "Admin access",
    tabLogin: "Login",
    tabSignup: "Sign up",
    email: "Email",
    phone: "Phone",
    password: "Password",

    confirmPassword: "Confirm Password",
    login: "Login",
    signup: "Create account",
    signupHint:
      "If this is the first admin, signup is open. Otherwise it requires an admin login.",

    wifiPrinting: "Wi‑Fi printing",
    enabled: "Enabled",
    disabled: "Disabled",
    printerIp: "Printer IP",
    printerPort: "Printer Port",
    couriers: "Couriers (WhatsApp numbers, one per line)",
    drivers: "Drivers",
    topups: "Topups",
    bankAccountName: "Account name",
    bankAccount: "Bank account (RIB/IBAN)",
    driverWalletEnabled: "Driver wallet",
    driverCommission: "Commission per order",
    policyRequireLabel: "Require policy acceptance at signup",
    required: "Required",
    optional: "Optional",
    policyAr: "Company policy (AR)",
    policyFr: "Company policy (FR)",
    policyEn: "Company policy (EN)",
    bannersLabel: "Offers banner images",
    bannersEmpty: "No banner images",
    bannerUploading: "Uploading image...",
    bannerUploadOk: "Image uploaded ✅",
    bannerUploadFail: "Image upload failed",
    supportTitle: "Support (Customer chat)",
    supportConvosTitle: "Conversations",
    send: "Send",
    typeMsg: "Type a message...",
    profile: "Profile",
    nameLabel: "Name",
    cardLabel: "Card",
    statusLabel: "Status",
    createdLabel: "Created",
    faceBikeCard: "Face + Bike card",
    idFront: "ID Front",
    idBack: "ID Back",
    noImage: "No image",
    save: "Save",
    close: "Close",

    menuTitle: "Restaurants & Meals",
    tabRestaurants: "Restaurants",
    tabMeals: "Meals",
    addRestaurant: "Add restaurant",
    addMeal: "Add meal",
    listRestaurants: "Restaurants",
    listMeals: "Meals",
    nameAr: "Name (AR)",
    nameEn: "Name (EN)",
    nameFr: "Name (FR)",
    descAr: "Description (AR)",
    descEn: "Description (EN)",
    descFr: "Description (FR)",
    address: "Address",
    active: "Active",
    available: "Available",
    categoryKey: "Category key",
    categoryAr: "Category (AR)",
    categoryEn: "Category (EN)",
    categoryFr: "Category (FR)",
    imageUrl: "Meal image",
    uploadHint: "Choose a meal image (upload)",
    uploading: "Uploading image...",
    uploadOk: "Image uploaded ✅",
    uploadFail: "Image upload failed",
    price: "Price",
    restaurant: "Restaurant",
    actions: "Actions",
    status: "Status",
    add: "Add",
    delete: "Delete",
    edit: "Edit",
    editRestaurant: "Edit restaurant",
    editMeal: "Edit meal",

    restaurantModeLabel: "Restaurant status",
    modeAuto: "Auto",
    modeOpen: "Force open",
    modeClosed: "Force closed",
    restOpenBtn: "Restaurant: Open",
    restClosedBtn: "Restaurant: Closed",
    restAutoBtn: "Restaurant: Auto",
    view: "View",
    whatsapp: "WhatsApp",
    done: "Done",
    sent: "Sent",
    wifiPrint: "Wi‑Fi Print",
    btPrint: "BT Print",
    htmlPrint: "Print Ticket",
    editTicket: "Edit customer ticket",
    deliveryFee: "Delivery fee",
    addLine: "Add line",
    saveChanges: "Save changes",
    subtotal: "Subtotal",
    total: "Total",
    itemName: "Item",
    qty: "Qty",
    unitPrice: "Unit price",

    toastNew: "New order",
    toastOrders: "orders",
    errNoCourier: "Add a courier number in Settings",
    errBtUnsupported: "Bluetooth is not supported in this browser",
    errBtConnect: "Bluetooth connection failed",
    errBtChar: "No writable printer characteristic found",
    errWifiDisabled: "Wi‑Fi printing is disabled in settings",
    errPwMismatch: "Passwords do not match",
    errNeedEmailPhone: "Enter email or phone.",
    customers: "Customers",
    notifications: "Notifications",
    notificationsTitle: "Notifications",
    notifTitleLabel: "Title",
    notifMsgLabel: "Message",
    notifImgLabel: "Image (optional)",
    sendNotif: "Send notification",
    sentNotifs: "Sent notifications",
    closeNotif: "Close",
    restaurantPortal: "Restaurant Portal",
    restaurantLogin: "Restaurant Login",
    restaurantLoginHint: "Set restaurant email/phone and password.",
    acceptOrder: "Accept",
    ordersTitle: "Orders",
    ordersFound: "{n} orders found",
    ordTabProcessing: "In progress",
    ordTabDone: "Completed",
    ordTabCanceled: "Canceled",
    ordShowing: "Showing {a}–{b} of {n}",
    ordPrev: "Previous",
    ordNext: "Next",
    ordEmpty: "No orders found.",
    custSearchPh: "Search by name, email or phone",
    custRangeAll: "All time",
    custRangeToday: "Today",
    custRange7: "Last 7 days",
    custRange30: "Last 30 days",
    custClear: "Clear filters",
    custCount: "{n} customers",
    custResults: "{n} of {t} results",
    custActChat: "Chat",
    custActOrders: "Customer orders",
    custEmpty: "No customers found.",
    drvTabAll: "All",
    drvTabPending: "Pending",
    drvTabApproved: "Approved",
    drvTabRejected: "Rejected",
    drvTabSuspended: "Suspended",
    drvCount: "{n} drivers",
    drvSearchPh: "Search by name, email, phone or card",
    drvEmpty: "No drivers found.",
    drvPortal: "Driver Portal",
    sendToDrivers: "Send to drivers",
    auth: "Auth",
    clearPassword: "Clear Password",
    statusMap: {
      new: "Pending admin",
      admin_accepted: "Sent to restaurant",
      restaurant_ready: "Sent to drivers",
      accepted: "Accepted by driver",
      picked_up: "Picked up",
      on_the_way: "On the way",
      delivered: "Delivered",
      done: "Done",
      canceled: "Canceled",
    },
  },
  fr: {
    dir: "ltr",
    brand: "Panneau Admin",
    subtitle: "Commandes & Impression",
    logout: "Déconnexion",
    refresh: "Actualiser",
    settings: "Paramètres",
    menuManage: "Restaurants & Menu",
    connectBt: "Connexion BT",
    btConnected: "BT connecté",
    all: "Tout",
    new: "Nouveau",
    filterDay: "Filtrer par jour",
    today: "Aujourd’hui",
    allBtn: "Tout",
    searchPh: "Rechercher par nom/téléphone/adresse/ID",
    thId: "ID",
    thTime: "Heure",
    thCustomer: "Client",
    thTotal: "Total",
    thStatus: "Statut",
    thActions: "Actions",
    detailsTitle: "Détails de la commande",
    detailsEmpty: "Sélectionnez une commande pour voir les détails.",
    acceptedDriverTitle: "Chauffeur (accepté)",
    driverPhoneLabel: "Téléphone",
    driverAcceptedAtLabel: "Accepté le",
    driverNotAccepted: "Pas encore accepté",

    soundOn: "Son ON",
    soundOff: "Son OFF",

    authTitle: "Accès admin",
    tabLogin: "Connexion",
    tabSignup: "Créer un compte",
    email: "Email",
    phone: "Téléphone",
    password: "Mot de passe",
    login: "Connexion",
    signup: "Créer",
    signupHint:
      "Si c’est le premier admin, l’inscription est ouverte. Sinon, une connexion admin est requise.",

    wifiPrinting: "Impression Wi‑Fi",
    enabled: "Activée",
    disabled: "Désactivée",
    printerIp: "IP imprimante",
    printerPort: "Port imprimante",
    couriers: "Livreurs (numéros WhatsApp, un par ligne)",
    drivers: "Chauffeurs",
    topups: "Recharges",
    bankAccountName: "Nom du compte",
    bankAccount: "Compte bancaire (RIB/IBAN)",
    driverWalletEnabled: "Portefeuille chauffeur",
    driverCommission: "Commission par commande",
    policyRequireLabel:
      "Exiger l’acceptation de la politique lors de l’inscription",
    required: "Obligatoire",
    optional: "Optionnel",
    policyAr: "Politique de l’entreprise (AR)",
    policyFr: "Politique de l’entreprise (FR)",
    policyEn: "Politique de l’entreprise (EN)",
    bannersLabel: "Bannière des offres (images)",
    bannersEmpty: "Aucune image",
    bannerUploading: "Téléversement...",
    bannerUploadOk: "Image téléversée ✅",
    bannerUploadFail: "Échec du téléversement",
    supportTitle: "Support (chat client)",
    supportConvosTitle: "Conversations",
    send: "Envoyer",
    typeMsg: "Écrivez un message...",
    profile: "Profil",
    nameLabel: "Nom",
    cardLabel: "Carte",
    statusLabel: "Statut",
    createdLabel: "Créé",
    faceBikeCard: "Visage + carte vélo",
    idFront: "ID Recto",
    idBack: "ID Verso",
    noImage: "Aucune image",
    save: "Enregistrer",
    close: "Fermer",

    menuTitle: "Restaurants & Plats",
    tabRestaurants: "Restaurants",
    tabMeals: "Plats",
    addRestaurant: "Ajouter un restaurant",
    addMeal: "Ajouter un plat",
    listRestaurants: "Restaurants",
    listMeals: "Plats",
    nameAr: "Nom (AR)",
    nameEn: "Nom (EN)",
    nameFr: "Nom (FR)",
    descAr: "Description (AR)",
    descEn: "Description (EN)",
    descFr: "Description (FR)",
    address: "Adresse",
    active: "Actif",
    available: "Disponible",
    categoryKey: "Clé catégorie",
    categoryAr: "Catégorie (AR)",
    categoryEn: "Catégorie (EN)",
    categoryFr: "Catégorie (FR)",
    imageUrl: "Image du plat",
    uploadHint: "Choisir une image du plat (téléversement)",
    uploading: "Téléversement...",
    uploadOk: "Image téléversée ✅",
    uploadFail: "Échec du téléversement",
    price: "Prix",
    restaurant: "Restaurant",
    actions: "Actions",
    status: "Statut",
    add: "Ajouter",
    delete: "Supprimer",
    edit: "Modifier",
    editRestaurant: "Modifier le restaurant",
    editMeal: "Modifier le plat",

    view: "Voir",
    whatsapp: "WhatsApp",
    done: "Terminé",
    sent: "Envoyé",
    wifiPrint: "Impr. Wi‑Fi",
    btPrint: "Impr. BT",

    toastNew: "Nouvelle commande",
    toastOrders: "commandes",
    errNoCourier: "Ajoutez un numéro de livreur dans Paramètres",
    errBtUnsupported: "Bluetooth n’est pas pris en charge",
    errBtConnect: "Échec de connexion Bluetooth",
    errBtChar: "Aucune caractéristique d’écriture trouvée",
    errWifiDisabled: "Impression Wi‑Fi désactivée",
    customers: "Clients",
    notifications: "Notifications",
    notificationsTitle: "Notifications",
    notifTitleLabel: "Titre",
    notifMsgLabel: "Message",
    notifImgLabel: "Image (optionnel)",
    sendNotif: "Envoyer la notification",
    sentNotifs: "Notifications envoyées",
    closeNotif: "Fermer",
    restaurantPortal: "Portail restaurant",
    restaurantLogin: "Accès restaurant",
    restaurantLoginHint:
      "Définissez l’email/téléphone et le mot de passe du restaurant.",
    acceptOrder: "Accepter",
    ordersTitle: "Commandes",
    ordersFound: "{n} commandes trouvées",
    ordTabProcessing: "En cours",
    ordTabDone: "Terminées",
    ordTabCanceled: "Annulées",
    ordShowing: "Affichage {a}–{b} sur {n}",
    ordPrev: "Précédent",
    ordNext: "Suivant",
    ordEmpty: "Aucune commande.",
    custSearchPh: "Rechercher par nom, e-mail ou téléphone",
    custRangeAll: "Toutes les dates",
    custRangeToday: "Aujourd'hui",
    custRange7: "7 derniers jours",
    custRange30: "30 derniers jours",
    custClear: "Effacer les filtres",
    custCount: "{n} clients",
    custResults: "{n} sur {t} résultats",
    custActChat: "Discussion",
    custActOrders: "Commandes du client",
    custEmpty: "Aucun client.",
    drvTabAll: "Tous",
    drvTabPending: "En attente",
    drvTabApproved: "Validés",
    drvTabRejected: "Rejetés",
    drvTabSuspended: "Suspendus",
    drvCount: "{n} chauffeurs",
    drvSearchPh: "Rechercher par nom, e-mail, téléphone ou carte",
    drvEmpty: "Aucun chauffeur.",
    drvPortal: "Portail chauffeur",
    sendToDrivers: "Envoyer aux chauffeurs",
    auth: "Accès",
    clearPassword: "Effacer le mot de passe",
    statusMap: {
      new: "En attente admin",
      admin_accepted: "Envoyée au restaurant",
      restaurant_ready: "Envoyée aux chauffeurs",
      accepted: "Acceptée par le chauffeur",
      picked_up: "Récupérée",
      on_the_way: "En route",
      delivered: "Livrée",
      done: "Terminée",
      canceled: "Annulée",
    },
  },
};

const LANG_KEY = "siymon_admin_lang_v1";
const THEME_KEY = "siymon_theme_v3";
const TOKEN_KEY = "siymon_admin_token_v2";
const SOUND_KEY = "siymon_admin_sound_v1";

let lang = localStorage.getItem(LANG_KEY) || "ar";
let token = localStorage.getItem(TOKEN_KEY) || null;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "0";

let CONFIG = null;
let orders = [];
let adminRestaurants = [];
let adminItems = [];
let menuTab = "restaurants";
let selectedOrderId = null;
let lastSeenIds = new Set();
let firstLoad = true;

let pollTimer = null;
let NOTIF_TICK = 0;

// Receipt editor state (prevent auto-refresh from collapsing the editor)
let EDIT_TICKET_OPEN = false;
let EDIT_TICKET_ORDER_ID = null;

// Drivers cache (dispatch)
let DRIVERS_CACHE = [];
let APPROVED_DRIVERS = [];
let DRIVERS_TAB = "pending"; // pending | approved

// Customers list
let CUSTOMERS_CACHE = [];

// Restaurant auth editor
let REST_AUTH_EDIT_ID = null;

// Restaurant edit editor
let REST_EDIT_ID = null;

// Meal edit editor
let ITEM_EDIT_ID = null;

// Notification last-seen
const LAST_SEEN_CUSTOMERS_KEY = "siymon_admin_last_seen_customers_v1";
const LAST_SEEN_ORDERS_KEY = "siymon_admin_last_seen_orders_v1";

/***********************
 * Theme
 ***********************/
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    el("themeToggle").innerHTML = ICONS.sun;
  } else {
    document.documentElement.removeAttribute("data-theme");
    el("themeToggle").innerHTML = ICONS.moon;
  }
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
    return;
  }
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme("dark"); /* SIYMON: dark is the default brand theme */
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/***********************
 * Toast
 ***********************/
let toastTimer = null;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/***********************
 * Sound (new orders)
 ***********************/
const ORDER_SOUND_URL = "/sounds/order.mp3";
let orderAudio = null;
let audioCtx = null; // fallback

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

function unlockAudio() {
  if (!soundEnabled) return;
  try {
    if (!orderAudio) {
      orderAudio = new Audio(ORDER_SOUND_URL);
      orderAudio.preload = "auto";
    }

    // Try to resume WebAudio (helps on some mobile/PWA cases)
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === "suspended")
        audioCtx.resume().catch(() => {});
    } catch (_e) {}

    // Prime audio on user gesture (keep volume extremely low)
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

function beep() {
  if (!soundEnabled) return;
  unlockAudio();

  if (!orderAudio) {
    orderAudio = new Audio(ORDER_SOUND_URL);
  }

  // إعادة تشغيل الصوت بأقصى قوة
  orderAudio.currentTime = 0;
  orderAudio.volume = 1.0;

  const playPromise = orderAudio.play();

  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      // لو المتصفح عمل بلوك للصوت، نشغل الذبذبة البديلة
      try {
        if (!audioCtx)
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.1; // رفعنا صوت الذبذبة شوية
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        setTimeout(() => {
          try {
            o.stop();
          } catch (_e) {}
        }, 250); // طولنا المدة شوية
      } catch (_e) {}
    });
  }

  // اهتزاز للموبايل
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (_e) {}
}

/***********************
 * Helpers
 ***********************/
function nextLangLabel() {
  return lang === "ar" ? "EN" : lang === "en" ? "FR" : "AR";
}
function cycleLang() {
  lang = lang === "ar" ? "en" : lang === "en" ? "fr" : "ar";
  localStorage.setItem(LANG_KEY, lang);
  applyI18n();
  render();
}
window.addEventListener("storage", (e) => {
  if (e.key === LANG_KEY && e.newValue && I18N[e.newValue] && e.newValue !== lang) {
    lang = e.newValue;
    applyI18n();
    render();
  }
});
function setSound(on) {
  soundEnabled = !!on;
  localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
  updateSoundBtn();
  if (soundEnabled) unlockAudio();
}
function updateSoundBtn() {
  el("soundToggle").textContent = soundEnabled
    ? I18N[lang].soundOn
    : I18N[lang].soundOff;
  el("soundToggle").classList.toggle("is-off", !soundEnabled);
}
function dateKey(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch (e) {
    return "";
  }
}
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return iso;
  }
}
function money(v) {
  const num = Number(v || 0);
  const cur = CONFIG?.currency || "MAD";
  return num.toFixed(2) + " " + cur;
}

function isoMs(iso) {
  try {
    return iso ? new Date(iso).getTime() : 0;
  } catch (_e) {
    return 0;
  }
}
function maxIsoMs(list, field) {
  let m = 0;
  (Array.isArray(list) ? list : []).forEach((x) => {
    m = Math.max(m, isoMs(x && x[field]));
  });
  return m;
}
function getSeen(key) {
  const v = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(v) ? v : 0;
}
function setSeen(key, ms) {
  const v = Number(ms || 0);
  localStorage.setItem(key, String(Number.isFinite(v) ? v : 0));
}
function setNotify(id, on) {
  const node = el(id);
  if (node) node.classList.toggle("notify", !!on);
}

/***********************
 * API
 ***********************/
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

async function uploadMealImage(file) {
  const hint = el("itemImgHint");
  const prev = el("itemImgPrev");
  const hidden = el("itemImg");
  const t = I18N[lang] || I18N.en;
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
    const res = await api("/api/admin/upload/menu-image", {
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
  const requestToken = token;
  const headers = Object.assign({}, opts.headers || {}, {
    "Content-Type": "application/json",
  });
  if (requestToken) headers["X-Admin-Token"] = requestToken;
  // a request that never answers must not freeze a loader (and the refresh loop behind it) forever
  let ctl = null, tm = null;
  if (!opts.signal && typeof AbortController !== "undefined") {
    ctl = new AbortController();
    tm = setTimeout(() => ctl.abort(), opts.timeoutMs || 25000);
  }
  let res;
  try {
    res = await fetch(url, { ...opts, headers, ...(ctl ? { signal: ctl.signal } : {}) });
  } catch (err) {
    if (ctl && ctl.signal.aborted) { const te = new Error("Request timed out"); te.status = 0; te.timeout = true; throw te; }
    throw err;
  } finally {
    if (tm) clearTimeout(tm);
  }
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  // An in-flight response belongs to the account that made the request. Do not
  // let it populate a page after logout or a switch to a less privileged user.
  let storedToken = requestToken;
  try { storedToken = localStorage.getItem(TOKEN_KEY); } catch (_e) {}
  if (requestToken && (requestToken !== token || requestToken !== storedToken)) {
    const e = new Error("Session changed"); e.status = 0; e.staleSession = true; throw e;
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

/***********************
 * i18n apply
 ***********************/
function applyI18n() {
  const t = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir;

  el("adminBrand").textContent = `siymon ${t.brand}`;
  el("adminSubtitle").textContent = t.subtitle;

  el("logoutBtn").textContent = t.logout;
  el("refreshText").textContent = t.refresh;
  el("settingsText").textContent = t.settings;
  el("menuManageText").textContent = t.menuManage || "Menu";
  el("driversText") &&
    (el("driversText").textContent =
      t.drivers || (lang === "ar" ? "السائقون" : "Drivers"));
  el("customersText") &&
    (el("customersText").textContent =
      t.customers || (lang === "ar" ? "الزبائن" : "Customers"));
  el("supportText") &&
    (el("supportText").textContent =
      t.support ||
      (lang === "ar" ? "الدعم" : lang === "fr" ? "Support" : "Support"));
  el("notificationsText") &&
    (el("notificationsText").textContent =
      t.notifications ||
      (lang === "ar"
        ? "الإشعارات"
        : lang === "fr"
          ? "Notifications"
          : "Notifications"));
  el("topupsText") &&
    (el("topupsText").textContent =
      t.topups ||
      (lang === "ar" ? "الشحن" : lang === "fr" ? "Recharges" : "Topups"));
  el("restaurantPortalText") &&
    (el("restaurantPortalText").textContent =
      t.restaurantPortal || (lang === "ar" ? "واجهة المطعم" : "Restaurant"));

  // Notifications modal
  el("notificationsTitle") &&
    (el("notificationsTitle").textContent =
      t.notificationsTitle || t.notifications || "Notifications");
  el("notifTitleLabel") &&
    (el("notifTitleLabel").textContent = t.notifTitleLabel || "Title");
  el("notifMsgLabel") &&
    (el("notifMsgLabel").textContent = t.notifMsgLabel || "Message");
  el("notifImgLabel") &&
    (el("notifImgLabel").textContent = t.notifImgLabel || "Image");
  el("sendNotifText") &&
    (el("sendNotifText").textContent =
      t.sendNotif || (lang === "ar" ? "إرسال" : "Send"));
  el("closeNotifText") &&
    (el("closeNotifText").textContent =
      t.closeNotif || (lang === "ar" ? "إغلاق" : "Close"));
  el("notifListTitle") &&
    (el("notifListTitle").textContent =
      t.sentNotifs ||
      (lang === "ar" ? "الإشعارات المرسلة" : "Sent notifications"));
  if (window.NotifEditor) window.NotifEditor.applyLang();

  // KPIs
  el("kpiAllText").textContent = t.all;
  el("kpiNewText").textContent = t.new;

  // Filters
  el("filterDayLabel").textContent = t.filterDay;
  el("todayBtn").textContent = t.today;
  el("allBtn").textContent = t.allBtn;
  el("searchInput").placeholder = t.searchPh;

  // Table headers
  el("thId").textContent = t.thId;
  el("thTime").textContent = t.thTime;
  el("thCustomer").textContent = t.thCustomer;
  el("thAddr") && (el("thAddr").textContent = t.address || "Address");
  el("ordersTitle") && (el("ordersTitle").textContent = t.ordersTitle);
  el("thTotal").textContent = t.thTotal;
  el("thStatus").textContent = t.thStatus;
  el("thActions").textContent = t.thActions;

  el("detailsTitle").textContent = t.detailsTitle;
  if (!selectedOrderId) el("detailsBox").textContent = t.detailsEmpty;

  // Auth
  el("authTitle").textContent = t.authTitle;
  el("tabLogin").textContent = t.tabLogin;
  el("tabSignup").textContent = t.tabSignup;
  el("loginIdLabel").textContent =
    t.loginId || t.errNeedEmailPhone || "Email or phone";
  el("loginPassLabel").textContent = t.password;
  el("loginText").textContent = t.login;
  el("signupEmailLabel").textContent = t.email;
  el("signupPhoneLabel").textContent = t.phone;
  el("signupPassLabel").textContent = t.password;
  el("signupPass2Label").textContent = t.confirmPassword;
  el("signupText").textContent = t.signup;
  el("signupHint").textContent = t.signupHint;

  // Settings
  el("settingsTitle").textContent = t.settings;
  el("wifiEnabledLabel").textContent = t.wifiPrinting;
  el("wifiEnabled").querySelector('option[value="on"]').textContent = t.enabled;
  el("wifiEnabled").querySelector('option[value="off"]').textContent =
    t.disabled;
  el("printerIpLabel").textContent = t.printerIp;
  el("printerPortLabel").textContent = t.printerPort;
  el("couriersLabel").textContent = t.couriers;
  el("bankAccountNameLabel") &&
    (el("bankAccountNameLabel").textContent =
      t.bankAccountName || (lang === "ar" ? "اسم الحساب" : "Account name"));
  el("bankAccountLabel") &&
    (el("bankAccountLabel").textContent =
      t.bankAccount ||
      (lang === "ar"
        ? "رقم الحساب البنكي (RIB/IBAN)"
        : "Bank account (RIB/IBAN)"));
  el("driverWalletEnabledLabel") &&
    (el("driverWalletEnabledLabel").textContent =
      t.driverWalletEnabled ||
      (lang === "ar" ? "محفظة السائق" : "Driver wallet"));
  el("driverCommissionLabel") &&
    (el("driverCommissionLabel").textContent =
      t.driverCommission ||
      (lang === "ar" ? "خصم/عمولة لكل طلب" : "Commission per order"));
  // Company policy labels
  el("policyRequireLabel") &&
    (el("policyRequireLabel").textContent =
      t.policyRequireLabel ||
      (lang === "ar"
        ? "إلزام الموافقة على سياسة الشركة عند إنشاء الحساب"
        : "Require policy acceptance at signup"));
  const prSel = el("policyRequire");
  if (prSel) {
    prSel.querySelector('option[value="on"]').textContent =
      t.required || (lang === "ar" ? "إلزامي" : "Required");
    prSel.querySelector('option[value="off"]').textContent =
      t.optional || (lang === "ar" ? "اختياري" : "Optional");
  }
  el("policyArLabel") &&
    (el("policyArLabel").textContent =
      t.policyAr ||
      (lang === "ar" ? "سياسة الشركة (عربي)" : "Company policy (AR)"));
  el("policyFrLabel") &&
    (el("policyFrLabel").textContent =
      t.policyFr ||
      (lang === "ar" ? "سياسة الشركة (فرنسي)" : "Company policy (FR)"));
  el("policyEnLabel") &&
    (el("policyEnLabel").textContent =
      t.policyEn ||
      (lang === "ar" ? "سياسة الشركة (إنجليزي)" : "Company policy (EN)"));

  el("bannersLabel") &&
    (el("bannersLabel").textContent =
      t.bannersLabel ||
      (lang === "ar" ? "بانر العروض (صور)" : "Offers banner images"));

  const dwSel = el("driverWalletEnabled");
  if (dwSel) {
    dwSel.querySelector('option[value="on"]').textContent =
      t.enabled || (lang === "ar" ? "مفعّل" : "Enabled");
    dwSel.querySelector('option[value="off"]').textContent =
      t.disabled || (lang === "ar" ? "معطّل" : "Disabled");
  }

  el("saveCfgText").textContent = t.save;
  el("closeCfgText").textContent = t.close;

  // Support + Topups
  el("supportTitle") &&
    (el("supportTitle").textContent =
      t.supportTitle ||
      (lang === "ar" ? "الدعم (دردشة الزبون)" : "Support (Customer chat)"));
  el("supportConvosTitle") &&
    (el("supportConvosTitle").textContent =
      t.supportConvosTitle || (lang === "ar" ? "المحادثات" : "Conversations"));
  // (support refresh/send are icon buttons now: labels are set by admin-support.js)

  el("topupsTitle") &&
    (el("topupsTitle").textContent =
      t.topupsTitle ||
      (lang === "ar" ? "طلبات الشحن (Topup)" : "Topup requests"));
  el("topupsListTitle") &&
    (el("topupsListTitle").textContent =
      t.topupsListTitle || (lang === "ar" ? "قائمة الشحن" : "Topups list"));
  el("refreshTopupsBtn") &&
    (el("refreshTopupsBtn").textContent = t.refresh || "Refresh");
  el("tThTime") && (el("tThTime").textContent = t.thTime || "Time");
  el("tThDriver") &&
    (el("tThDriver").textContent =
      t.driver || (lang === "ar" ? "السائق" : "Driver"));
  el("tThAmount") &&
    (el("tThAmount").textContent =
      t.thTotal || (lang === "ar" ? "المبلغ" : "Amount"));
  el("tThStatus") && (el("tThStatus").textContent = t.thStatus || "Status");
  el("tThReceipt") &&
    (el("tThReceipt").textContent =
      t.receipt || (lang === "ar" ? "الوصل" : "Receipt"));
  el("tThActions") && (el("tThActions").textContent = t.thActions || "Actions");

  // Menu management
  el("menuTitle").textContent = t.menuTitle || t.menuManage || "Menu";
  el("menuTabRestaurants").textContent = t.tabRestaurants || "Restaurants";
  el("menuTabItems").textContent = t.tabMeals || "Meals";
  el("restAddTitle").textContent = t.addRestaurant || "Add restaurant";
  el("restListTitle").textContent = t.listRestaurants || "Restaurants";
  el("restNameArLabel").textContent = t.nameAr || "Name (AR)";
  el("restNameEnLabel").textContent = t.nameEn || "Name (EN)";
  el("restNameFrLabel").textContent = t.nameFr || "Name (FR)";
  el("restPhoneLabel").textContent = t.phone || "Phone";
  el("restAddressLabel").textContent = t.address || "Address";
  el("restActiveLabel").textContent = t.active || "Active";
  el("addRestText").textContent = t.add || "Add";
  el("restThName").textContent =
    lang === "ar" ? "المطعم" : lang === "fr" ? "Restaurant" : "Restaurant";
  el("restThPhone").textContent = t.phone || "Phone";
  el("restThLogin").textContent =
    t.loginId || (lang === "ar" ? "تسجيل الدخول" : "Login");
  el("restThPass").textContent = t.password || "Password";
  el("restThStatus").textContent = t.status || "Status";
  el("restThAct").textContent = t.actions || "Actions";

  // Customers modal
  el("customersTitle") &&
    (el("customersTitle").textContent = t.customers || "Customers");
  el("cThName") &&
    (el("cThName").textContent =
      lang === "ar"
        ? "الاسم الكامل"
        : lang === "fr"
          ? "Nom complet"
          : "Full name");
  el("cThEmail") && (el("cThEmail").textContent = t.email || "Email");
  el("cThPhone") && (el("cThPhone").textContent = t.phone || "Phone");
  el("cThCreated") &&
    (el("cThCreated").textContent =
      lang === "ar" ? "تاريخ التسجيل" : lang === "fr" ? "Créé le" : "Created");
  el("cThActions") && (el("cThActions").textContent = t.actions || "Actions");

  // Drivers modal
  el("driversTitle") && (el("driversTitle").textContent = t.drivers || "Drivers");
  el("openDriverPortalLink") &&
    (el("openDriverPortalLink").textContent = t.drvPortal || "Driver Portal");
  el("dThName") && (el("dThName").textContent = t.nameLabel || "Name");
  el("dThEmail") && (el("dThEmail").textContent = t.email || "Email");
  el("dThPhone") && (el("dThPhone").textContent = t.phone || "Phone");
  el("dThCard") && (el("dThCard").textContent = t.cardLabel || "Card");
  el("dThStatus") && (el("dThStatus").textContent = t.statusLabel || "Status");
  el("dThCreated") &&
    (el("dThCreated").textContent = t.createdLabel || "Created");
  el("dThActions") && (el("dThActions").textContent = t.actions || "Actions");
  el("drvSearch") && (el("drvSearch").placeholder = t.drvSearchPh);
  if (el("drvRange")) {
    const o = el("drvRange").options;
    o[0].textContent = t.custRangeAll;
    o[1].textContent = t.custRangeToday;
    o[2].textContent = t.custRange7;
    o[3].textContent = t.custRange30;
  }
  el("drvClear") && (el("drvClear").textContent = t.custClear);
  el("custSearch") && (el("custSearch").placeholder = t.custSearchPh);
  if (el("custRange")) {
    const o = el("custRange").options;
    o[0].textContent = t.custRangeAll;
    o[1].textContent = t.custRangeToday;
    o[2].textContent = t.custRange7;
    o[3].textContent = t.custRange30;
  }
  el("custClear") && (el("custClear").textContent = t.custClear);
  el("closeCustomersText") &&
    (el("closeCustomersText").textContent = t.close || "Close");

  // Restaurant auth modal
  el("restLoginEmailLabel") &&
    (el("restLoginEmailLabel").textContent = t.email || "Email");
  el("restLoginPhoneLabel") &&
    (el("restLoginPhoneLabel").textContent = t.phone || "Phone");
  el("restLoginPassLabel") &&
    (el("restLoginPassLabel").textContent = t.password || "Password");
  el("restLoginPass2Label") &&
    (el("restLoginPass2Label").textContent =
      t.confirmPassword || "Confirm password");
  el("saveRestAuthText") &&
    (el("saveRestAuthText").textContent = t.save || "Save");
  el("clearRestPassText") &&
    (el("clearRestPassText").textContent =
      lang === "ar" ? "مسح كلمة السر" : lang === "fr" ? "Effacer" : "Clear");
  el("closeRestAuthText") &&
    (el("closeRestAuthText").textContent = t.close || "Close");

  el("itemAddTitle").textContent = t.addMeal || "Add meal";
  el("itemListTitle").textContent = t.listMeals || "Meals";
  el("itemRestaurantLabel").textContent = t.restaurant || "Restaurant";
  el("itemPriceLabel").textContent = t.price || "Price";
  el("itemCatLabel").textContent = t.categoryKey || "Category key";
  el("itemImgLabel").textContent = t.imageUrl || "Meal image";
  el("itemImgHint") && (el("itemImgHint").textContent = t.uploadHint || "");
  el("itemCatArLabel").textContent = t.categoryAr || "Category (AR)";
  el("itemCatEnLabel").textContent = t.categoryEn || "Category (EN)";
  el("itemCatFrLabel").textContent = t.categoryFr || "Category (FR)";
  el("itemNameArLabel").textContent = t.nameAr || "Name (AR)";
  el("itemNameEnLabel").textContent = t.nameEn || "Name (EN)";
  el("itemNameFrLabel").textContent = t.nameFr || "Name (FR)";
  el("itemDescArLabel").textContent = t.descAr || "Desc (AR)";
  el("itemDescEnLabel").textContent = t.descEn || "Desc (EN)";
  el("itemDescFrLabel").textContent = t.descFr || "Desc (FR)";
  el("itemAvailLabel").textContent = t.available || "Available";
  el("addItemText").textContent = t.add || "Add";
  el("itemThName").textContent = t.thCustomer || "Name";
  el("itemThRestaurant").textContent = t.restaurant || "Restaurant";
  el("itemThPrice").textContent = t.price || "Price";
  el("itemThStatus").textContent = t.status || "Status";
  el("itemThAct").textContent = t.actions || "Actions";

  // Restaurant edit modal
  el("restEditTitle") &&
    (el("restEditTitle").textContent =
      t.editRestaurant ||
      (lang === "ar"
        ? "تعديل المطعم"
        : lang === "fr"
          ? "Modifier le restaurant"
          : "Edit restaurant"));
  el("restEditNameArLabel") &&
    (el("restEditNameArLabel").textContent = t.nameAr || "Name (AR)");
  el("restEditNameEnLabel") &&
    (el("restEditNameEnLabel").textContent = t.nameEn || "Name (EN)");
  el("restEditNameFrLabel") &&
    (el("restEditNameFrLabel").textContent = t.nameFr || "Name (FR)");
  el("restEditPhoneLabel") &&
    (el("restEditPhoneLabel").textContent = t.phone || "Phone");
  el("restEditAddressLabel") &&
    (el("restEditAddressLabel").textContent = t.address || "Address");
  el("restEditActiveLabel") &&
    (el("restEditActiveLabel").textContent = t.active || "Active");
  const rea = el("restEditActive");
  if (rea) {
    rea.querySelector('option[value="1"]').textContent =
      lang === "ar" ? "نعم" : lang === "fr" ? "Oui" : "Yes";
    rea.querySelector('option[value="0"]').textContent =
      lang === "ar" ? "لا" : lang === "fr" ? "Non" : "No";
  }
  el("saveRestEditText") &&
    (el("saveRestEditText").textContent = t.save || "Save");

  // Meal edit modal
  el("itemEditTitle") &&
    (el("itemEditTitle").textContent =
      t.editMeal ||
      (lang === "ar"
        ? "تعديل الوجبة"
        : lang === "fr"
          ? "Modifier le plat"
          : "Edit meal"));
  el("itemEditRestaurantLabel") &&
    (el("itemEditRestaurantLabel").textContent = t.restaurant || "Restaurant");
  el("itemEditPriceLabel") &&
    (el("itemEditPriceLabel").textContent = t.price || "Price");
  el("itemEditCatLabel") &&
    (el("itemEditCatLabel").textContent = t.categoryKey || "Category key");
  el("itemEditImgLabel") &&
    (el("itemEditImgLabel").textContent = t.imageUrl || "Meal image");
  el("itemEditImgHint") &&
    (el("itemEditImgHint").textContent = t.uploadHint || "");
  el("itemEditCatArLabel") &&
    (el("itemEditCatArLabel").textContent = t.categoryAr || "Category (AR)");
  el("itemEditCatEnLabel") &&
    (el("itemEditCatEnLabel").textContent = t.categoryEn || "Category (EN)");
  el("itemEditCatFrLabel") &&
    (el("itemEditCatFrLabel").textContent = t.categoryFr || "Category (FR)");
  el("itemEditNameArLabel") &&
    (el("itemEditNameArLabel").textContent = t.nameAr || "Name (AR)");
  el("itemEditNameEnLabel") &&
    (el("itemEditNameEnLabel").textContent = t.nameEn || "Name (EN)");
  el("itemEditNameFrLabel") &&
    (el("itemEditNameFrLabel").textContent = t.nameFr || "Name (FR)");
  el("itemEditDescArLabel") &&
    (el("itemEditDescArLabel").textContent = t.descAr || "Desc (AR)");
  el("itemEditDescEnLabel") &&
    (el("itemEditDescEnLabel").textContent = t.descEn || "Desc (EN)");
  el("itemEditDescFrLabel") &&
    (el("itemEditDescFrLabel").textContent = t.descFr || "Desc (FR)");
  el("itemEditAvailLabel") &&
    (el("itemEditAvailLabel").textContent = t.available || "Available");
  const iea = el("itemEditAvail");
  if (iea) {
    iea.querySelector('option[value="1"]').textContent =
      lang === "ar" ? "نعم" : lang === "fr" ? "Oui" : "Yes";
    iea.querySelector('option[value="0"]').textContent =
      lang === "ar" ? "لا" : lang === "fr" ? "Non" : "No";
  }
  el("saveItemEditText") &&
    (el("saveItemEditText").textContent = t.save || "Save");

  // Top toggles
  el("adminLangToggle").textContent = nextLangLabel();
  updateSoundBtn();
  updateBtBtn();
  updateRestaurantBtn();
}

/***********************
 * Auth modal
 ***********************/
function showAuth(show) {
  el("authModal").classList.toggle("show", !!show);
}
function showSettings(show) {
  el("settingsModal").classList.toggle("show", !!show);
}

function showMenu(show) {
  el("menuModal").classList.toggle("show", !!show);
  if (show) {
    // lazy load
    refreshMenuData().catch(() => {});
  }
}

function showRestEdit(show) {
  el("restEditModal")?.classList.toggle("show", !!show);
  if (!show) {
    REST_EDIT_ID = null;
    el("restEditHint") && (el("restEditHint").textContent = "");
  }
}

function showItemEdit(show) {
  el("itemEditModal")?.classList.toggle("show", !!show);
  if (!show) {
    ITEM_EDIT_ID = null;
    el("itemEditHint") && (el("itemEditHint").textContent = "");
  }
}

/***********************
 * Drivers (Admin dispatch)
 ***********************/
function showDrivers(show) {
  el("driversModal")?.classList.toggle("show", !!show);
}
function showDriverView(show) {
  el("driverViewModal")?.classList.toggle("show", !!show);
}

/***********************
 * Image zoom (Admin)
 ***********************/
let IMG_ZOOM_SCALE = 1;
let IMG_ZOOM_SRC = "";

function showImgZoom(show) {
  const m = el("imgZoomModal");
  if (!m) return;
  m.classList.toggle("show", !!show);
  if (!show) {
    IMG_ZOOM_SCALE = 1;
    IMG_ZOOM_SRC = "";
    const img = el("imgZoomImg");
    if (img) img.src = "";
    const pct = el("zoomPct");
    if (pct) pct.textContent = "100%";
    const link = el("zoomOpenBtn");
    if (link) link.href = "#";
  }
}

function applyImgZoom() {
  const img = el("imgZoomImg");
  if (img) img.style.transform = `scale(${IMG_ZOOM_SCALE})`;
  const pct = el("zoomPct");
  if (pct) pct.textContent = `${Math.round(IMG_ZOOM_SCALE * 100)}%`;
}

function openImgZoom(src) {
  IMG_ZOOM_SRC = String(src || "");
  IMG_ZOOM_SCALE = 1;
  const img = el("imgZoomImg");
  if (img) img.src = IMG_ZOOM_SRC;
  const link = el("zoomOpenBtn");
  if (link) {
    link.href = IMG_ZOOM_SRC || "#";
    link.style.display = IMG_ZOOM_SRC ? "" : "none";
  }
  applyImgZoom();
  showImgZoom(true);
}

function zoomStep(delta) {
  const next = Number(IMG_ZOOM_SCALE) + Number(delta);
  IMG_ZOOM_SCALE = Math.max(0.25, Math.min(6, next));
  applyImgZoom();
}

// Customers modal
function showCustomers(show) {
  el("customersModal")?.classList.toggle("show", !!show);
}

// Notifications modal
let ADMIN_NOTIFS = [];
function showNotificationsModal(show) {
  el("notificationsModal")?.classList.toggle("show", !!show);
}

function fmtDateTime(iso) {
  try {
    const d = new Date(String(iso || ""));
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

async function loadNotificationsAdmin() {
  // The editor (admin-notifications.js) owns rendering, sending and drafts.
  if (window.NotifEditor) return window.NotifEditor.refresh();
}

// Support + Topups modals
let SUPPORT_CONVOS = [];
let SUPPORT_ACTIVE_ID = null;
let SUPPORT_POLL = null;
let TOPUPS_CACHE = [];

function showOrderChatModal(show) {
  const m = el("orderChatModal");
  if (!m) return;
  m.classList.toggle("show", !!show);
  if (!show) {
    ORDER_CHAT_ORDER_ID = null;
    if (ORDER_CHAT_POLL) {
      try {
        clearInterval(ORDER_CHAT_POLL);
      } catch (_e) {}
    }
    ORDER_CHAT_POLL = null;
  }
}

let ORDER_CHAT_ORDER_ID = null;
let ORDER_CHAT_POLL = null;

function renderOrderChatModal(messages) {
  const box = el("orderChatModalBox");
  if (!box) return;
  const list = Array.isArray(messages) ? messages : [];
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="muted">${lang === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}</div>`;
    return;
  }
  for (const m of list) {
    const from = String(m.from || "");
    const div = document.createElement("div");
    div.className = "chat-msg " + (from === "driver" || from === "store" ? "me" : "");
    const who =
      from === "store"
        ? lang === "ar"
          ? "المتجر"
          : "Store"
        : from === "driver"
        ? lang === "ar"
          ? "السائق"
          : "Driver"
        : lang === "ar"
          ? "الزبون"
          : "Customer";
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(m.text || "")}</div><div class="chat-meta">${escapeHtml(who)} • ${escapeHtml(fmtTime(m.createdAt || m.at))}</div>`;
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight + 9999;
}

let ORDER_CHAT_KIND = "driver";
async function loadOrderChatModal() {
  if (!ORDER_CHAT_ORDER_ID) return;
  const hint = el("orderChatModalHint");
  if (hint) hint.textContent = "";
  const isStore = ORDER_CHAT_KIND === "store";
  const res = await api(
    `/api/admin/orders/${encodeURIComponent(ORDER_CHAT_ORDER_ID)}/${isStore ? "store-chat" : "chat"}`,
  );
  const title = el("orderChatModalTitle");
  if (title) {
    title.textContent = isStore
      ? lang === "ar"
        ? `محادثة المتجر والزبون #${ORDER_CHAT_ORDER_ID}`
        : `Store ↔ customer chat #${ORDER_CHAT_ORDER_ID}`
      : lang === "ar"
        ? `دردشة الطلب #${ORDER_CHAT_ORDER_ID}`
        : `Order chat #${ORDER_CHAT_ORDER_ID}`;
  }
  const parties = el("orderChatParties");
  if (parties && isStore) {
    parties.innerHTML = `${lang === "ar" ? "الزبون" : "Customer"}: ${escapeHtml(res.customerName || "")}<br/>${lang === "ar" ? "المتجر" : "Store"}: ${escapeHtml((res.store && res.store.name) || "")}`;
  } else if (parties) {
    const c = res.customer || {};
    const d = res.driver || null;
    const cTxt = `${lang === "ar" ? "الزبون" : "Customer"}: ${escapeHtml(c.name || "")} ${c.phone ? " • " + escapeHtml(c.phone) : ""}`;
    const dTxt = d
      ? `${lang === "ar" ? "السائق" : "Driver"}: ${escapeHtml(d.name || d.id || "")} ${d.phone ? " • " + escapeHtml(d.phone) : ""}`
      : `${lang === "ar" ? "السائق" : "Driver"}: -`;
    parties.innerHTML = `${cTxt}<br/>${dTxt}`;
  }
  renderOrderChatModal(res.messages || []);
}

function openOrderChatModal(orderId, kind) {
  ORDER_CHAT_KIND = kind === "store" ? "store" : "driver";
  ORDER_CHAT_ORDER_ID = String(orderId || "");
  showOrderChatModal(true);
  loadOrderChatModal().catch((e) => {
    const hint = el("orderChatModalHint");
    if (hint) hint.textContent = "❌ " + (e.message || e);
  });
  if (ORDER_CHAT_POLL) {
    try {
      clearInterval(ORDER_CHAT_POLL);
    } catch (_e) {}
  }
  ORDER_CHAT_POLL = setInterval(() => {
    if (ORDER_CHAT_ORDER_ID) loadOrderChatModal().catch(() => {});
  }, 3500);
}

function showSupport(show) {
  el("supportModal")?.classList.toggle("show", !!show);
  if (!show) {
    SUPPORT_ACTIVE_ID = null;
    if (typeof scResetUi === "function") scResetUi();
    if (SUPPORT_POLL) {
      try {
        clearInterval(SUPPORT_POLL);
      } catch (_e) {}
    }
    SUPPORT_POLL = null;
  }
}
function showTopups(show) {
  el("topupsModal")?.classList.toggle("show", !!show);
}

function fmtTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function renderSupportConvos() {
  const body = el("supportConvosBody");
  const list = Array.isArray(SUPPORT_CONVOS) ? SUPPORT_CONVOS : [];
  const totalUnread = list.reduce(
    (a, c) => a + Number(c.unreadForAdmin || 0),
    0,
  );
  // sidebar / header badge (unchanged behaviour)
  if (el("supportText")) {
    const base =
      lang === "ar" ? "الدعم" : lang === "fr" ? "Support" : "Support";
    el("supportText").textContent = totalUnread
      ? `${base} (${totalUnread})`
      : base;
  }
  setNotify("supportBtn", totalUnread > 0);
  if (!body) return;
  scRenderConvoList(body, list);
}

function renderSupportChat(messages) {
  const box = el("supportChatBox");
  if (!box) return;
  scRenderMessages(box, Array.isArray(messages) ? messages : []);
}

async function loadSupportConvos() {
  if (!token) return;
  const res = await api("/api/admin/support/conversations");
  SUPPORT_CONVOS = Array.isArray(res.conversations) ? res.conversations : [];
  renderSupportConvos();
}

async function openSupportChat(customerId) {
  const id = String(customerId || "");
  const changed = SUPPORT_ACTIVE_ID !== id;
  SUPPORT_ACTIVE_ID = id;
  const conv =
    (Array.isArray(SUPPORT_CONVOS) ? SUPPORT_CONVOS : []).find(
      (x) => String(x.customerId) === id,
    ) ||
    SC_EXTRA[id] ||
    null;
  scApplyChatHeader(conv, id);
  el("supportModal")?.classList.add("sc-chat-open");
  if (changed) {
    scChatLoading();
    renderSupportConvos(); // highlight the selected conversation
  }
  try {
    const res = await api(`/api/admin/support/${encodeURIComponent(id)}`);
    if (SUPPORT_ACTIVE_ID !== id) return; // user switched chat meanwhile
    renderSupportChat(res.messages || []);
  } catch (e) {
    if (changed && SUPPORT_ACTIVE_ID === id) scChatError(e);
    throw e;
  }
}

async function sendSupportMessage() {
  const input = el("supportMsgInput");
  const btn = el("supportSendBtn");
  if (!input || !SUPPORT_ACTIVE_ID || btn?.disabled) return;
  const text = (input.value || "").trim();
  if (!text) return;
  const id = SUPPORT_ACTIVE_ID;
  input.value = "";
  if (btn) btn.disabled = true;
  try {
    await api(`/api/admin/support/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    await openSupportChat(id);
    await loadSupportConvos().catch(() => {});
  } catch (e) {
    input.value = text; // keep the text so nothing is lost on failure
    throw e;
  } finally {
    if (btn) btn.disabled = false;
    input.focus();
  }
}

function renderTopups() {
  const body = el("topupsBody");
  if (!body) return;
  body.innerHTML = "";
  const filter = el("topupsFilter")?.value || "all";
  let list = Array.isArray(TOPUPS_CACHE) ? TOPUPS_CACHE : [];
  if (filter !== "all") list = list.filter((t) => String(t.status) === filter);

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="muted">${lang === "ar" ? "لا توجد طلبات شحن" : "No topups"}</td></tr>`;
    return;
  }
  for (const t of list) {
    const tr = document.createElement("tr");
    const receiptBtn = t.receiptUrl
      ? `<button class="btn small" data-action="view" data-id="${escapeHtml(t.id)}">${lang === "ar" ? "عرض" : "View"}</button>`
      : "";
    let actions = "";
    if (String(t.status) === "pending") {
      actions = `<button class="btn small primary" data-action="approve" data-id="${escapeHtml(t.id)}">${lang === "ar" ? "موافقة" : "Approve"}</button>
                 <button class="btn small danger" data-action="reject" data-id="${escapeHtml(t.id)}">${lang === "ar" ? "رفض" : "Reject"}</button>`;
    } else {
      actions = `<span class="muted">${escapeHtml(String(t.status || ""))}</span>`;
    }
    const wtLabel = t.walletType === "customer" ? (lang === "ar" ? "محفظة زبون" : "Customer wallet") : lang === "ar" ? "محفظة سائق" : "Driver wallet";
    const who = t.ownerName || t.driverName || t.customerId || t.driverId || "";
    const extra = t.status && t.status !== "pending" && t.decisionNote ? `<div class="muted" style="font-size:12px">${escapeHtml(t.decisionNote)}</div>` : "";
    tr.innerHTML = `<td>${escapeHtml(fmtTime(t.createdAt))}</td>
      <td><b>${escapeHtml(who)}</b><div class="muted" style="font-size:12px">${escapeHtml(wtLabel)} · ${escapeHtml(t.driverPhone || "")}</div></td>
      <td>${escapeHtml(String(t.amount || ""))}<div class="muted" style="font-size:12px">${escapeHtml(t.methodName || "")}</div><div class="muted" style="font-size:12px;direction:ltr">${escapeHtml(t.reference || "")}</div></td>
      <td>${escapeHtml(String(t.status || ""))}${extra}</td>
      <td>${receiptBtn}</td>
      <td>${actions}</td>`;
    body.appendChild(tr);
  }
}

async function loadTopups() {
  if (!token) return;
  const res = await api("/api/admin/topups");
  TOPUPS_CACHE = Array.isArray(res.topups) ? res.topups : [];
  // update badge on button
  const pending = TOPUPS_CACHE.filter(
    (t) => String(t.status) === "pending",
  ).length;
  if (el("topupsText")) {
    const base = lang === "ar" ? "الشحن" : "Topups";
    el("topupsText").textContent = pending ? `${base} (${pending})` : base;
  }
  setNotify("topupsBtn", pending > 0);
  renderTopups();
}

async function viewTopupReceipt(url) {
  // The receipt is private: fetch it with the admin token and show it from a blob URL.
  const res = await fetch(url, { headers: { "X-Admin-Token": token || "" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const u = URL.createObjectURL(blob);
  window.open(u, "_blank");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

let TOPUP_DECIDING = false;
async function decideTopup(id, status) {
  if (TOPUP_DECIDING) return; // no double submissions
  let reason = "";
  let confirmedReference = "";
  if (status === "rejected" || status === "failed") {
    reason = (prompt(lang === "ar" ? "سبب الرفض (إجباري)" : "Reason (required)") || "").trim();
    if (!reason) return;
  } else {
    if (!confirm(lang === "ar" ? "هل تحققت من وصول المبلغ فعليا في الحساب؟ سيُضاف الرصيد فورا." : "Have you verified the funds actually arrived? The wallet will be credited now.")) return;
    confirmedReference = (prompt(lang === "ar" ? "مرجع العملية المؤكد من البنك (اختياري)" : "Bank-confirmed reference (optional)") || "").trim();
  }
  TOPUP_DECIDING = true;
  try {
    await api(`/api/admin/topups/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason, confirmedReference }),
    });
  } finally {
    TOPUP_DECIDING = false;
  }
  await loadTopups();
}

async function pollAdminNotifs(init = false) {
  if (!token) return;

  // Support unread
  if (permOk("support.use")) try {
    const res = await api("/api/admin/support/conversations");
    SUPPORT_CONVOS = Array.isArray(res.conversations) ? res.conversations : [];
    if (el("supportModal")?.classList.contains("show")) {
      renderSupportConvos();
    } else {
      const list = Array.isArray(SUPPORT_CONVOS) ? SUPPORT_CONVOS : [];
      const totalUnread = list.reduce(
        (a, c) => a + Number(c.unreadForAdmin || 0),
        0,
      );
      if (el("supportText")) {
        const base =
          lang === "ar" ? "الدعم" : lang === "fr" ? "Support" : "Support";
        el("supportText").textContent = totalUnread
          ? `${base} (${totalUnread})`
          : base;
      }
      setNotify("supportBtn", totalUnread > 0);
    }
  } catch (_e) {}

  // Topups pending
  if (permOk("finance.read")) try {
    const res = await api("/api/admin/topups");
    TOPUPS_CACHE = Array.isArray(res.topups) ? res.topups : [];
    const pending = TOPUPS_CACHE.filter(
      (t) => String(t.status) === "pending",
    ).length;
    if (el("topupsText")) {
      const base =
        lang === "ar" ? "الشحن" : lang === "fr" ? "Recharges" : "Topups";
      el("topupsText").textContent = pending ? `${base} (${pending})` : base;
    }
    setNotify("topupsBtn", pending > 0);
    if (el("topupsModal")?.classList.contains("show")) renderTopups();
  } catch (_e) {}

  // Drivers pending
  if (permOk("drivers.read")) try {
    const res = await api("/api/admin/drivers");
    DRIVERS_CACHE = Array.isArray(res.drivers) ? res.drivers : [];
    APPROVED_DRIVERS = DRIVERS_CACHE.filter(
      (d) => String(d.status || "pending") === "approved",
    );
    const pending = DRIVERS_CACHE.filter(
      (d) => String(d.status || "pending") === "pending",
    ).length;
    if (el("driversText")) {
      const base =
        lang === "ar" ? "السائقون" : lang === "fr" ? "Chauffeurs" : "Drivers";
      el("driversText").textContent = pending ? `${base} (${pending})` : base;
    }
    setNotify("driversBtn", pending > 0);
    if (el("driversModal")?.classList.contains("show")) renderDriversAdmin();
  } catch (_e) {}

  // Customers new since last seen
  if (permOk("customers.read")) try {
    const res = await api("/api/admin/customers", { method: "GET" });
    const list = Array.isArray(res.customers) ? res.customers : [];
    CUSTOMERS_CACHE = list;
    const maxTs = maxIsoMs(list, "createdAt");
    const seen = getSeen(LAST_SEEN_CUSTOMERS_KEY);
    if ((init || !seen) && maxTs) {
      // baseline: don't show dot immediately on first load
      if (!seen) setSeen(LAST_SEEN_CUSTOMERS_KEY, maxTs);
      setNotify("customersBtn", false);
    } else {
      setNotify("customersBtn", maxTs > seen && maxTs > 0);
    }
    if (el("customersModal")?.classList.contains("show"))
      renderCustomersAdmin();
  } catch (_e) {}

  // Menu/auth missing (green dot on menu button)
  if (permOk("stores.read")) try {
    const res = await api("/api/admin/restaurants", { method: "GET" });
    const list = Array.isArray(res.restaurants) ? res.restaurants : [];
    adminRestaurants = list;
    const needsAuth = list.some(
      (x) => x && (!(x.loginEmail || x.loginPhone) || !x.hasPassword),
    );
    setNotify("menuManageBtn", needsAuth);
  } catch (_e) {}
}

// Restaurant auth modal
function showRestAuth(show) {
  el("restAuthModal")?.classList.toggle("show", !!show);
}

function driverImageUrl(driver, kind) {
  const s = String(driver?.images?.[kind] || "");
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  // migrated private file → fetch via authenticated endpoint
  if (/\.(jpg|jpeg|png|webp)$/i.test(s)) {
    return `/api/admin/drivers/${encodeURIComponent(String(driver.id || ""))}/image/${encodeURIComponent(kind)}`;
  }
  // legacy base64-only
  return `data:image/jpeg;base64,${s}`;
}

async function refreshDriversCache() {
  if (!token) return;
  const res = await api("/api/admin/drivers");
  DRIVERS_CACHE = Array.isArray(res.drivers) ? res.drivers : [];
  APPROVED_DRIVERS = DRIVERS_CACHE.filter(
    (d) => String(d.status || "pending") === "approved",
  );

  // badge + green dot on drivers button
  const pending = DRIVERS_CACHE.filter(
    (d) => String(d.status || "pending") === "pending",
  ).length;
  if (el("driversText")) {
    const base =
      lang === "ar" ? "السائقون" : lang === "fr" ? "Chauffeurs" : "Drivers";
    el("driversText").textContent = pending ? `${base} (${pending})` : base;
  }
  setNotify("driversBtn", pending > 0);
}

async function loadDriversAdmin() {
  await refreshDriversCache();
  renderDriversAdmin();
}

/* Drivers list: status tabs + search + registration-date filter + pagination (client-side) */
let drvQuery = "";
let drvRange = "all";
let drvPage = 1;
let drvSig = "";
const DRV_PAGE_SIZE = 10;
const DRV_STATUSES = ["pending", "approved", "rejected", "suspended"];

function drvStatusOf(d) {
  const st = String(d?.status || "pending");
  return DRV_STATUSES.includes(st) ? st : "pending";
}
function drvBaseFiltered() {
  let list = Array.isArray(DRIVERS_CACHE) ? DRIVERS_CACHE : [];
  const q = drvQuery.trim().toLowerCase();
  if (q) {
    const qd = q.replace(/\D/g, "");
    list = list.filter((d) => {
      const phoneDigits = String(d.phone || "").replace(/\D/g, "");
      return (
        String(d.name || "").toLowerCase().includes(q) ||
        String(d.email || "").toLowerCase().includes(q) ||
        String(d.phone || "").toLowerCase().includes(q) ||
        String(d.cardNumber || "").toLowerCase().includes(q) ||
        (qd.length >= 3 && phoneDigits.includes(qd))
      );
    });
  }
  if (drvRange !== "all") {
    const now = Date.now();
    const todayKey = dateKey(new Date().toISOString());
    list = list.filter((d) => {
      const ms = isoMs(d.createdAt);
      if (!ms) return false;
      if (drvRange === "today") return dateKey(d.createdAt) === todayKey;
      return now - ms <= (drvRange === "7d" ? 7 : 30) * 86400000;
    });
  }
  return list;
}

function renderPagerInto(boxId, t, total, page, pages, size) {
  const box = el(boxId);
  if (!box) return;
  if (!total) {
    box.innerHTML = "";
    return;
  }
  const a = (page - 1) * size + 1;
  const b = Math.min(total, page * size);
  const info = (t.ordShowing || "{a}-{b} / {n}")
    .replace("{a}", a)
    .replace("{b}", b)
    .replace("{n}", total);
  let nav = "";
  if (pages > 1) {
    nav = `<button type="button" class="ord-pg ord-pg-arrow" data-page="${page - 1}" aria-label="${escapeHtml(t.ordPrev || "Previous")}" ${page <= 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>`;
    pageList(page, pages).forEach((p) => {
      nav +=
        p === "…"
          ? `<span class="ord-pg-gap" aria-hidden="true">…</span>`
          : `<button type="button" class="ord-pg${p === page ? " on" : ""}" data-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`;
    });
    nav += `<button type="button" class="ord-pg ord-pg-arrow" data-page="${page + 1}" aria-label="${escapeHtml(t.ordNext || "Next")}" ${page >= pages ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
  }
  box.innerHTML = `<span class="ord-info">${escapeHtml(info)}</span><div class="ord-pages">${nav}</div>`;
}

function renderDriversAdmin() {
  const t = I18N[lang] || I18N.en;
  const body = el("driversBody");
  if (!body) return;

  const all = Array.isArray(DRIVERS_CACHE) ? DRIVERS_CACHE : [];
  const base = drvBaseFiltered();
  const list =
    DRIVERS_TAB === "all"
      ? base
      : base.filter((d) => drvStatusOf(d) === DRIVERS_TAB);
  const filtered = !!drvQuery.trim() || drvRange !== "all";

  // tabs: labels + counters (of the date/search-filtered list) + active state
  const counts = { all: base.length, pending: 0, approved: 0, rejected: 0, suspended: 0 };
  base.forEach((d) => counts[drvStatusOf(d)]++);
  const tabLabels = {
    all: t.drvTabAll,
    pending: t.drvTabPending,
    approved: t.drvTabApproved,
    rejected: t.drvTabRejected,
    suspended: t.drvTabSuspended || "Suspended",
  };
  document.querySelectorAll("#driversTabs [data-dtab]").forEach((b) => {
    const k = b.getAttribute("data-dtab");
    b.innerHTML = `${escapeHtml(tabLabels[k] || k)} <span class="ord-count">${counts[k] || 0}</span>`;
    b.classList.toggle("active", k === DRIVERS_TAB);
    b.setAttribute("aria-selected", k === DRIVERS_TAB ? "true" : "false");
  });

  const sig = [DRIVERS_TAB, drvQuery, drvRange].join("|");
  if (sig !== drvSig) {
    drvSig = sig;
    drvPage = 1;
  }
  const pages = Math.max(1, Math.ceil(list.length / DRV_PAGE_SIZE));
  if (drvPage > pages) drvPage = pages;
  if (drvPage < 1) drvPage = 1;
  const items = list.slice(
    (drvPage - 1) * DRV_PAGE_SIZE,
    drvPage * DRV_PAGE_SIZE,
  );

  if (el("driversCount"))
    el("driversCount").textContent = (t.drvCount || "{n}").replace(
      "{n}",
      String(all.length),
    );
  if (el("driversHint"))
    el("driversHint").textContent = filtered
      ? (t.custResults || "{n} / {t}")
          .replace("{n}", String(base.length))
          .replace("{t}", String(all.length))
      : "";
  if (el("drvClear")) el("drvClear").hidden = !filtered;

  const approveLabel =
    lang === "ar" ? "قبول" : lang === "fr" ? "Valider" : "Approve";
  const rejectLabel =
    lang === "ar" ? "رفض" : lang === "fr" ? "Rejeter" : "Reject";
  const stLabel = {
    pending: t.drvTabPending,
    approved: t.drvTabApproved,
    rejected: t.drvTabRejected,
    suspended: t.drvTabSuspended || "Suspended",
  };
  const suspendLabel =
    lang === "ar" ? "إيقاف" : lang === "fr" ? "Suspendre" : "Suspend";

  body.innerHTML =
    items
      .map((d) => {
        const st = drvStatusOf(d);
        const id = escapeHtml(d.id);
        const name = String(d.name || "");
        const email = String(d.email || "");
        const phone = String(d.phone || "");
        const pic = d.profilePhotoUrl
          ? `<img src="${escapeHtml(d.profilePhotoUrl)}" alt="" referrerpolicy="no-referrer" loading="lazy" />`
          : "";
        const viewBtn = `<button type="button" class="ord-ico" data-action="view-driver" data-id="${id}" title="${escapeHtml(t.view || "View")}" aria-label="${escapeHtml(t.view || "View")}">${ORD_ICONS.view}</button>`;
        const approveBtn = `<button type="button" class="ord-btn ord-btn--accept" data-action="approve-driver" data-id="${id}">${approveLabel}</button>`;
        const rejectBtn = `<button type="button" class="ord-btn ord-btn--reject" data-action="reject-driver" data-id="${id}">${rejectLabel}</button>`;
        // pending: approve / reject (as before) · rejected: can be approved again
        const suspendBtn = `<button type="button" class="ord-btn ord-btn--reject" data-action="suspend-driver" data-id="${id}">${suspendLabel}</button>`;
        const decide =
          st === "pending"
            ? approveBtn + rejectBtn
            : st === "rejected"
              ? approveBtn
              : st === "approved"
                ? suspendBtn
                : st === "suspended"
                  ? approveBtn + rejectBtn
                  : "";
        return `
    <tr>
      <td class="cu-name"><div class="cu-who">
        <span class="cu-avatar" aria-hidden="true">${escapeHtml(custInitials(name || email))}${pic}</span>
        <div class="cu-name-col"><b>${escapeHtml(name || "—")}</b>${typeof window.drvRatingHtml === "function" ? window.drvRatingHtml(d) : ""}</div>
      </div></td>
      <td>${email ? `<a class="cu-link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '<span class="muted">—</span>'}</td>
      <td>${phone ? `<a class="cu-tel" href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" dir="ltr">${escapeHtml(phone)}</a>` : '<span class="muted">—</span>'}</td>
      <td class="dr-card" dir="ltr">${escapeHtml(d.cardNumber || "") || '<span class="muted">—</span>'}</td>
      <td><span class="pill ord-status dr-${st}">${escapeHtml(stLabel[st] || st)}</span></td>
      <td class="ord-time">${ordDateCell(d.createdAt)}</td>
      <td class="cu-actions">${viewBtn}${decide}</td>
    </tr>`;
      })
      .join("") ||
    `<tr class="cu-empty-row"><td colspan="7" class="cu-empty">${escapeHtml(t.drvEmpty || "—")}</td></tr>`;

  renderPagerInto("drvPager", t, list.length, drvPage, pages, DRV_PAGE_SIZE);
}

function openDriverView(driver) {
  const box = el("driverViewBox");
  if (!box) return;

  const t = I18N[lang] || I18N.en;
  const zoomLabel =
    lang === "ar" ? "تكبير" : lang === "fr" ? "Agrandir" : "Zoom";

  const avatar = String(driver?.profilePhotoUrl || "");
  const hasFace = !!driver?.images?.faceWithBikeCard;
  const hasFront = !!driver?.images?.idFront;
  const hasBack = !!driver?.images?.idBack;
  const hasLicense = !!driver?.images?.license;
  const veh = driver?.vehicle && driver.vehicle.type ? driver.vehicle : null;

  box.innerHTML = `
    <div class="panel-like">
      ${avatar ? `<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px"><img src="${escapeHtml(avatar)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,0,0,.1)"/><div class="muted" style="font-size:12px">${escapeHtml(t.profile || "Profile")}</div></div>` : ``}
      <div><b>${escapeHtml(t.nameLabel || "Name")}:</b> ${escapeHtml(driver.name || "")}</div>
      <div><b>${escapeHtml(t.email || "Email")}:</b> ${escapeHtml(driver.email || "")}</div>
      <div><b>${escapeHtml(t.phone || "Phone")}:</b> ${escapeHtml(driver.phone || "")}</div>
      <div><b>${escapeHtml(t.cardLabel || "Card")}:</b> ${escapeHtml(driver.cardNumber || "")}</div>
      <div><b>${escapeHtml(t.statusLabel || "Status")}:</b> ${escapeHtml(driver.status || "pending")}</div>
      <div><b>${escapeHtml(t.createdLabel || "Created")}:</b> ${escapeHtml(fmtTime(driver.createdAt || ""))}</div>
    </div>

    <div class="split" style="margin-top:12px">
      <div class="panel-like">
        <h4 style="margin:0 0 10px 0">${escapeHtml(t.faceBikeCard || "Face + Bike card")}</h4>
        ${hasFace ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost small" type="button" data-action="zoom-driver-img" data-img="drvFaceImg">${escapeHtml(zoomLabel)}</button></div><img id="drvFaceImg" alt="face" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.1)"/>` : `<div class="muted">${escapeHtml(t.noImage || "No image")}</div>`}
      </div>
      <div class="panel-like">
        <h4 style="margin:0 0 10px 0">${escapeHtml(t.idFront || "ID Front")}</h4>
        ${hasFront ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost small" type="button" data-action="zoom-driver-img" data-img="drvFrontImg">${escapeHtml(zoomLabel)}</button></div><img id="drvFrontImg" alt="id-front" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.1)"/>` : `<div class="muted">${escapeHtml(t.noImage || "No image")}</div>`}
        <div style="height:10px"></div>
        <h4 style="margin:0 0 10px 0">${escapeHtml(t.idBack || "ID Back")}</h4>
        ${hasBack ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost small" type="button" data-action="zoom-driver-img" data-img="drvBackImg">${escapeHtml(zoomLabel)}</button></div><img id="drvBackImg" alt="id-back" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.1)"/>` : `<div class="muted">${escapeHtml(t.noImage || "No image")}</div>`}
      </div>
    </div>
    <div class="panel-like" style="margin-top:12px">
      <h4 style="margin:0 0 10px 0">${escapeHtml(lang === "ar" ? "رخصة السياقة والمركبة" : lang === "fr" ? "Permis et véhicule" : "Driving licence & vehicle")}</h4>
      <div class="muted" style="margin-bottom:8px">${veh ? escapeHtml([veh.type, veh.plate, veh.model].filter(Boolean).join(" · ")) : escapeHtml(lang === "ar" ? "لا توجد بيانات مركبة" : lang === "fr" ? "Aucun véhicule" : "No vehicle data")}</div>
      ${hasLicense ? `<img id="drvLicenseImg" alt="licence" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.1)"/>` : `<div class="muted">${escapeHtml(lang === "ar" ? "لا توجد رخصة" : lang === "fr" ? "Pas de permis" : "No licence uploaded")}</div>`}
      ${driver.review && driver.review.at ? `<div class="muted" style="margin-top:8px">${escapeHtml(driver.review.status)} · ${escapeHtml(fmtTime(driver.review.at))}${driver.review.reason ? " · " + escapeHtml(driver.review.reason) : ""}</div>` : ""}
    </div>
  `;

  showDriverView(true);

  // Load private images via authenticated fetch (Bearer token)
  (async () => {
    try {
      const load = async (kind, imgId) => {
        const img = document.getElementById(imgId);
        if (!img) return;
        const v = String(driver?.images?.[kind] || "");
        if (!v) return;
        if (v.startsWith("data:")) {
          img.src = v;
          return;
        }
        // migrated → fetch from admin-protected endpoint
        const url = `/api/admin/drivers/${encodeURIComponent(String(driver.id || ""))}/image/${encodeURIComponent(kind)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        img.src = URL.createObjectURL(blob);
      };
      await load("faceWithBikeCard", "drvFaceImg");
      await load("idFront", "drvFrontImg");
      await load("idBack", "drvBackImg");
      await load("license", "drvLicenseImg");
    } catch (_e) {}
  })();
}

/***********************
 * Customers (Admin)
 ***********************/
async function loadCustomersAdmin() {
  if (!token) return;
  const res = await api("/api/admin/customers", { method: "GET" });
  CUSTOMERS_CACHE = Array.isArray(res.customers) ? res.customers : [];
  renderCustomersAdmin();
}

/* Customers list: search + registration-date filter + pagination (client-side; API untouched) */
let custQuery = "";
let custRange = "all";
let custPage = 1;
let custSig = "";
const CUST_PAGE_SIZE = 10;

function custFullName(c) {
  return (
    String(c?.fullName || "").trim() ||
    [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
    String(c?.name || "").trim()
  );
}
function custInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
function custFiltered() {
  let list = Array.isArray(CUSTOMERS_CACHE) ? CUSTOMERS_CACHE : [];
  const q = custQuery.trim().toLowerCase();
  if (q) {
    const qd = q.replace(/\D/g, "");
    list = list.filter((c) => {
      const phoneDigits = String(c.phone || "").replace(/\D/g, "");
      return (
        custFullName(c).toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q) ||
        (qd.length >= 3 && phoneDigits.includes(qd))
      );
    });
  }
  if (custRange !== "all") {
    const now = Date.now();
    const todayKey = dateKey(new Date().toISOString());
    list = list.filter((c) => {
      const ms = isoMs(c.createdAt);
      if (!ms) return false;
      if (custRange === "today") return dateKey(c.createdAt) === todayKey;
      const days = custRange === "7d" ? 7 : 30;
      return now - ms <= days * 86400000;
    });
  }
  return list;
}

function renderCustomersAdmin() {
  const body = el("customersBody");
  if (!body) return;
  const t = I18N[lang] || I18N.en;
  const all = Array.isArray(CUSTOMERS_CACHE) ? CUSTOMERS_CACHE : [];
  const list = custFiltered();
  const filtered = !!custQuery.trim() || custRange !== "all";

  const sig = custQuery + "|" + custRange;
  if (sig !== custSig) {
    custSig = sig;
    custPage = 1;
  }
  const pages = Math.max(1, Math.ceil(list.length / CUST_PAGE_SIZE));
  if (custPage > pages) custPage = pages;
  if (custPage < 1) custPage = 1;
  const items = list.slice(
    (custPage - 1) * CUST_PAGE_SIZE,
    custPage * CUST_PAGE_SIZE,
  );

  if (el("customersCount"))
    el("customersCount").textContent = (t.custCount || "{n}").replace(
      "{n}",
      String(all.length),
    );
  if (el("customersHint"))
    el("customersHint").textContent = filtered
      ? (t.custResults || "{n} / {t}")
          .replace("{n}", String(list.length))
          .replace("{t}", String(all.length))
      : "";
  if (el("custClear")) el("custClear").hidden = !filtered;

  const actionsLabel = { chat: t.custActChat, orders: t.custActOrders };
  body.innerHTML =
    items
      .map((c) => {
        const name = custFullName(c);
        const email = String(c.email || "");
        const phone = String(c.phone || "");
        const id = escapeHtml(c.id);
        const pic = c.googlePicture
          ? `<img src="${escapeHtml(c.googlePicture)}" alt="" referrerpolicy="no-referrer" loading="lazy" />`
          : "";
        return `
      <tr>
        <td class="cu-name"><div class="cu-who">
          <span class="cu-avatar" aria-hidden="true">${escapeHtml(custInitials(name || email))}${pic}</span>
          <b>${escapeHtml(name || "—")}</b>
        </div></td>
        <td>${email ? `<a class="cu-link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '<span class="muted">—</span>'}</td>
        <td>${phone ? `<a class="cu-tel" href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" dir="ltr">${escapeHtml(phone)}</a>` : '<span class="muted">—</span>'}</td>
        <td class="ord-time">${ordDateCell(c.createdAt)}</td>
        <td class="cu-actions">
          <button type="button" class="ord-ico" data-cu-action="chat" data-id="${id}" title="${escapeHtml(actionsLabel.chat)}" aria-label="${escapeHtml(actionsLabel.chat)}">${ORD_ICONS.wa}</button>
          <button type="button" class="ord-ico" data-cu-action="orders" data-id="${id}" title="${escapeHtml(actionsLabel.orders)}" aria-label="${escapeHtml(actionsLabel.orders)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></button>
        </td>
      </tr>
    `;
      })
      .join("") ||
    `<tr class="cu-empty-row"><td colspan="5" class="cu-empty">${escapeHtml(t.custEmpty || "—")}</td></tr>`;

  // pagination (reuses the orders pager look)
  const box = el("custPager");
  if (box) {
    if (!list.length) {
      box.innerHTML = "";
    } else {
      const a = (custPage - 1) * CUST_PAGE_SIZE + 1;
      const b = Math.min(list.length, custPage * CUST_PAGE_SIZE);
      const info = (t.ordShowing || "{a}-{b} / {n}")
        .replace("{a}", a)
        .replace("{b}", b)
        .replace("{n}", list.length);
      let nav = "";
      if (pages > 1) {
        nav = `<button type="button" class="ord-pg ord-pg-arrow" data-page="${custPage - 1}" aria-label="${escapeHtml(t.ordPrev || "Previous")}" ${custPage <= 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>`;
        pageList(custPage, pages).forEach((p) => {
          nav +=
            p === "…"
              ? `<span class="ord-pg-gap" aria-hidden="true">…</span>`
              : `<button type="button" class="ord-pg${p === custPage ? " on" : ""}" data-page="${p}" ${p === custPage ? 'aria-current="page"' : ""}>${p}</button>`;
        });
        nav += `<button type="button" class="ord-pg ord-pg-arrow" data-page="${custPage + 1}" aria-label="${escapeHtml(t.ordNext || "Next")}" ${custPage >= pages ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
      }
      box.innerHTML = `<span class="ord-info">${escapeHtml(info)}</span><div class="ord-pages">${nav}</div>`;
    }
  }
}

function bindCustomersUi() {
  el("custSearch")?.addEventListener("input", (e) => {
    custQuery = e.target.value || "";
    renderCustomersAdmin();
  });
  el("custRange")?.addEventListener("change", (e) => {
    custRange = e.target.value || "all";
    renderCustomersAdmin();
  });
  el("custClear")?.addEventListener("click", () => {
    custQuery = "";
    custRange = "all";
    if (el("custSearch")) el("custSearch").value = "";
    if (el("custRange")) el("custRange").value = "all";
    renderCustomersAdmin();
  });
  el("custPager")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    const p = parseInt(b.getAttribute("data-page"), 10);
    if (!p) return;
    custPage = p;
    renderCustomersAdmin();
  });
  // broken avatar images fall back to the initials underneath
  el("customersBody")?.addEventListener(
    "error",
    (e) => {
      if (e.target && e.target.tagName === "IMG") e.target.remove();
    },
    true,
  );
  el("customersBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cu-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const c = (CUSTOMERS_CACHE || []).find((x) => String(x.id) === String(id));
    if (!c) return;
    const action = btn.getAttribute("data-cu-action");
    if (action === "chat") {
      // reuse the existing support chat
      showCustomers(false);
      // go through the router so the URL / sidebar follow (falls back to the original button)
      if (window.adminNav && typeof window.adminNav.go === "function") window.adminNav.go("support");
      else el("supportBtn")?.click();
      openSupportChat(c.id).catch((err) => toast(err.message));
    } else if (action === "orders") {
      // reuse the orders search (matches name / phone)
      showCustomers(false);
      ordersTab = "all";
      const si = el("searchInput");
      if (si) si.value = c.phone || custFullName(c);
      if (el("filterDate")) el("filterDate").value = "";
      render();
      si?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

/***********************
 * Restaurant auth editor
 ***********************/
function openRestAuth(restaurantId) {
  REST_AUTH_EDIT_ID = String(restaurantId || "");
  const r = (adminRestaurants || []).find(
    (x) => String(x.id) === REST_AUTH_EDIT_ID,
  );
  const t = I18N[lang] || I18N.en;
  const title = el("restAuthTitle");
  if (title) {
    const rn = r ? asText(r.name) || r.id : REST_AUTH_EDIT_ID;
    title.textContent =
      lang === "ar" ? `دخول المطعم: ${rn}` : `Restaurant auth: ${rn}`;
  }
  // NOTE: IDs must match public/admin/index.html (restAuthEmail/restAuthPhone/...)
  el("restAuthEmail").value = r?.loginEmail || "";
  el("restAuthPhone").value = r?.loginPhone || "";
  el("restAuthPass").value = "";
  el("restAuthPass2").value = "";
  el("restAuthHint").textContent = "";
  showRestAuth(true);
}

async function saveRestAuth() {
  const t = I18N[lang] || I18N.en;
  if (!REST_AUTH_EDIT_ID) {
    return;
  }
  const loginEmail = el("restAuthEmail").value.trim();
  const loginPhone = el("restAuthPhone").value.trim();
  const password = el("restAuthPass").value;
  const pass2 = el("restAuthPass2").value;
  el("restAuthHint").textContent = "";

  if (!loginEmail && !loginPhone) {
    el("restAuthHint").textContent =
      lang === "ar"
        ? "أدخل جمايل أو هاتف"
        : lang === "fr"
          ? "Entrez email ou téléphone"
          : "Enter email or phone";
    return;
  }

  const payload = { loginEmail, loginPhone };
  if (password || pass2) {
    if (password.length < 6) {
      el("restAuthHint").textContent =
        lang === "ar" ? "كلمة السر قصيرة" : "Password too short";
      return;
    }
    if (password !== pass2) {
      el("restAuthHint").textContent =
        lang === "ar"
          ? "كلمتا السر غير متطابقتين"
          : lang === "fr"
            ? "Mots de passe non identiques"
            : "Passwords do not match";
      return;
    }
    payload.password = password;
  }

  try {
    await api(
      `/api/admin/restaurants/${encodeURIComponent(REST_AUTH_EDIT_ID)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    await refreshMenuData();
    toast("✅");
    showRestAuth(false);
  } catch (e) {
    el("restAuthHint").textContent = e.message;
  }
}

async function clearRestPassword() {
  if (!REST_AUTH_EDIT_ID) return;
  if (!confirm(lang === "ar" ? "مسح كلمة السر؟" : "Clear password?")) return;
  try {
    await api(
      `/api/admin/restaurants/${encodeURIComponent(REST_AUTH_EDIT_ID)}`,
      { method: "PUT", body: JSON.stringify({ clearPassword: true }) },
    );
    await refreshMenuData();
    toast("✅");
  } catch (e) {
    toast(e.message);
  }
}

function openRestEdit(restaurantId) {
  REST_EDIT_ID = String(restaurantId || "");
  const r = (adminRestaurants || []).find((x) => String(x.id) === REST_EDIT_ID);
  const t = I18N[lang] || I18N.en;

  const rn = r ? asText(r.name) || r.id : REST_EDIT_ID;
  if (el("restEditTitle")) {
    el("restEditTitle").textContent =
      `${t.editRestaurant || "Edit restaurant"}: ${rn}`;
  }
  el("restEditNameAr").value = r?.name?.ar || "";
  el("restEditNameEn").value = r?.name?.en || "";
  el("restEditNameFr").value = r?.name?.fr || "";
  el("restEditPhone").value = r?.phone || "";
  el("restEditAddress").value = r?.address || "";
  el("restEditActive").value = r?.isActive !== false ? "1" : "0";
  el("restEditHint").textContent = "";
  if (window.storesFillRest) window.storesFillRest(r);
  REST_LOGO = r?.logo || "";
  REST_COVER = r?.cover || "";
  if (el("restLogoFile")) el("restLogoFile").value = "";
  if (el("restCoverFile")) el("restCoverFile").value = "";
  setRestPrev();
  showRestEdit(true);
}

let REST_LOGO = "";
let REST_COVER = "";
function setRestPrev() {
  [["restLogoPrev", REST_LOGO], ["restCoverPrev", REST_COVER]].forEach(([id, u]) => {
    const im = el(id);
    if (!im) return;
    im.src = u || "";
    im.style.display = u ? "block" : "none";
  });
}
async function uploadRestImage(file, which) {
  if (!file) return;
  try {
    el("restEditHint").textContent = "...";
    const dataUrl = await fileToDataUrl(file);
    const res = await api("/api/admin/upload/restaurant-image", {
      method: "POST",
      body: JSON.stringify({ image: dataUrl }),
    });
    if (res && res.url) {
      if (which === "logo") REST_LOGO = res.url;
      else REST_COVER = res.url;
      setRestPrev();
    }
    el("restEditHint").textContent = "";
  } catch (e) {
    el("restEditHint").textContent = "Upload failed";
  }
}
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "restLogoFile") uploadRestImage(e.target.files[0], "logo");
  if (e.target && e.target.id === "restCoverFile") uploadRestImage(e.target.files[0], "cover");
});

async function saveRestEdit() {
  if (!REST_EDIT_ID) return;
  const t = I18N[lang] || I18N.en;

  const name = {
    ar: el("restEditNameAr").value.trim(),
    en: el("restEditNameEn").value.trim(),
    fr: el("restEditNameFr").value.trim(),
  };
  if (!name.ar && !name.en && !name.fr) {
    el("restEditHint").textContent =
      lang === "ar"
        ? "أدخل اسم المطعم"
        : lang === "fr"
          ? "Entrez le nom"
          : "Enter a restaurant name";
    return;
  }

  const payload = {
    name,
    phone: el("restEditPhone").value.trim(),
    address: el("restEditAddress").value.trim(),
    isActive: el("restEditActive").value === "1",
    logo: REST_LOGO,
    cover: REST_COVER,
    ...(window.storesReadRest ? window.storesReadRest() : {}),
  };

  el("restEditHint").textContent = "";
  try {
    const out = await api(`/api/admin/restaurants/${encodeURIComponent(REST_EDIT_ID)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const saved = out && out.restaurant;
    if ((payload.logo && !(saved && saved.logo)) || (payload.cover && !(saved && saved.cover))) {
      el("restEditHint").textContent =
        "الخادم لم يحفظ الصورة — تأكد من رفع server.js الجديد وإعادة تشغيل pm2";
      return;
    }
    toast("✅ " + (t.save || "Save"));
    await refreshMenuData();
    showRestEdit(false);
  } catch (e) {
    el("restEditHint").textContent = e.message;
  }
}

function fillRestaurantSelectEdit() {
  const sel = el("itemEditRestaurant");
  if (!sel) return;
  sel.innerHTML = "";
  adminRestaurants
    .filter((r) => r && r.isActive !== false)
    .forEach((r) => {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = asText(r.name) || String(r.id);
      sel.appendChild(opt);
    });
}

function openItemEdit(itemId) {
  ITEM_EDIT_ID = String(itemId || "");
  const it = (adminItems || []).find((x) => String(x.id) === ITEM_EDIT_ID);
  const t = I18N[lang] || I18N.en;

  fillRestaurantSelectEdit();

  const rn = it ? asText(it.name) || it.id : ITEM_EDIT_ID;
  if (el("itemEditTitle")) {
    el("itemEditTitle").textContent = `${t.editMeal || "Edit meal"}: ${rn}`;
  }

  el("itemEditRestaurant").value = String(it?.restaurantId || "");
  el("itemEditPrice").value = it?.price ?? "";
  el("itemEditCat").value = it?.cat || "general";

  el("itemEditCatAr").value = it?.catLabel?.ar || "";
  el("itemEditCatEn").value = it?.catLabel?.en || "";
  el("itemEditCatFr").value = it?.catLabel?.fr || "";

  el("itemEditNameAr").value = it?.name?.ar || "";
  el("itemEditNameEn").value = it?.name?.en || "";
  el("itemEditNameFr").value = it?.name?.fr || "";

  el("itemEditDescAr").value = it?.desc?.ar || "";
  el("itemEditDescEn").value = it?.desc?.en || "";
  el("itemEditDescFr").value = it?.desc?.fr || "";

  el("itemEditAvail").value = it?.isAvailable !== false ? "1" : "0";

  // image
  el("itemEditImg").value = it?.img || "";
  const prev = el("itemEditImgPrev");
  if (prev) {
    if (it?.img) {
      prev.src = it.img;
      prev.style.display = "block";
    } else {
      prev.style.display = "none";
      prev.removeAttribute("src");
    }
  }
  const fileInput = el("itemEditImgFile");
  if (fileInput) fileInput.value = "";
  el("itemEditHint").textContent = "";
  if (window.storesFillItem) window.storesFillItem(it);
  showItemEdit(true);
}

async function uploadMealImageEdit(file) {
  const hint = el("itemEditImgHint");
  if (!file) {
    if (hint) hint.textContent = "";
    return;
  }
  try {
    if (hint)
      hint.textContent =
        lang === "ar"
          ? "...جاري رفع الصورة"
          : lang === "fr"
            ? "Téléchargement..."
            : "Uploading...";
    const dataUrl = await fileToDataUrl(file);
    const res = await api("/api/admin/upload/menu-image", {
      method: "POST",
      body: JSON.stringify({ dataUrl, filename: file.name || "meal.png" }),
    });
    const url = res?.url || "";
    if (!url) throw new Error("Upload failed");
    el("itemEditImg").value = url;
    const prev = el("itemEditImgPrev");
    if (prev) {
      prev.src = url;
      prev.style.display = "block";
    }
    if (hint)
      hint.textContent =
        lang === "ar"
          ? "✅ تم رفع الصورة"
          : lang === "fr"
            ? "✅ Image envoyée"
            : "✅ Uploaded";
  } catch (e) {
    if (hint) hint.textContent = e.message || "Upload failed";
  }
}

async function saveItemEdit() {
  if (!ITEM_EDIT_ID) return;
  const t = I18N[lang] || I18N.en;

  const restaurantId = el("itemEditRestaurant").value;
  const cat = el("itemEditCat").value.trim() || "general";
  const catLabel = {
    ar: el("itemEditCatAr").value.trim(),
    en: el("itemEditCatEn").value.trim(),
    fr: el("itemEditCatFr").value.trim(),
  };
  const name = {
    ar: el("itemEditNameAr").value.trim(),
    en: el("itemEditNameEn").value.trim(),
    fr: el("itemEditNameFr").value.trim(),
  };
  if (!name.ar && !name.en && !name.fr) {
    el("itemEditHint").textContent =
      lang === "ar"
        ? "أدخل اسم الوجبة"
        : lang === "fr"
          ? "Entrez le nom"
          : "Enter a meal name";
    return;
  }
  const desc = {
    ar: el("itemEditDescAr").value.trim(),
    en: el("itemEditDescEn").value.trim(),
    fr: el("itemEditDescFr").value.trim(),
  };
  const payload = {
    restaurantId,
    cat,
    catLabel,
    name,
    desc,
    price: Number(el("itemEditPrice").value || 0),
    img: el("itemEditImg").value.trim(),
    isAvailable: el("itemEditAvail").value === "1",
    ...(window.storesReadItem ? window.storesReadItem() : {}),
  };

  el("itemEditHint").textContent = "";
  try {
    await api(`/api/admin/menu/${encodeURIComponent(ITEM_EDIT_ID)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    toast("✅ " + (t.save || "Save"));
    await refreshMenuData();
    showItemEdit(false);
  } catch (e) {
    el("itemEditHint").textContent = e.message;
  }
}

function setMenuTab(tab) {
  menuTab = tab === "items" ? "items" : tab === "home" ? "home" : "restaurants";
  el("menuTabRestaurants").classList.toggle(
    "active",
    menuTab === "restaurants",
  );
  el("menuTabItems").classList.toggle("active", menuTab === "items");
  if (el("menuTabHome"))
    el("menuTabHome").classList.toggle("active", menuTab === "home");
  el("menuPanelRestaurants").style.display =
    menuTab === "restaurants" ? "block" : "none";
  el("menuPanelItems").style.display = menuTab === "items" ? "block" : "none";
  if (el("menuPanelHome")) {
    el("menuPanelHome").style.display = menuTab === "home" ? "block" : "none";
    if (menuTab === "home" && window.storesRenderHome) window.storesRenderHome();
  }
}

function asText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object")
    return String(v[lang] || v.en || v.ar || v.fr || "");
  return String(v);
}

function fillRestaurantSelect() {
  const sel = el("itemRestaurant");
  if (!sel) return;
  sel.innerHTML = "";
  adminRestaurants
    .filter((r) => r && r.isActive !== false)
    .forEach((r) => {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = asText(r.name) || String(r.id);
      sel.appendChild(opt);
    });
}

function renderRestaurantsAdmin() {
  const tbody = el("restaurantsBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const list = window.storesVisible
    ? window.storesVisible(adminRestaurants)
    : adminRestaurants;
  list.forEach((r) => {
    const tr = document.createElement("tr");
    const name = escapeHtml(asText(r.name) || String(r.id));
    const phone = escapeHtml(r.phone || "");
    const login = r.loginEmail || r.loginPhone || "—";
    const pass = r.hasPassword ? "✅" : "—";
    const st = window.storesStatusBadge
      ? window.storesStatusBadge(r)
      : r.isActive !== false
        ? "✅"
        : "⛔";
    const count = window.storesItemCount ? window.storesItemCount(r) : "";
    const archived = r.status === "archived";
    const L3 = (ar, en) => (lang === "ar" ? ar : en);
    const rv = (r.review && r.review.status) || "approved";
    const rvLabel = {
      pending: L3("قيد المراجعة", "Pending review"),
      rejected: L3("مرفوض", "Rejected"),
      suspended: L3("موقوف", "Suspended"),
      approved: "",
    }[rv];
    const rvBtn = (to, ar, en) =>
      `<button class="btn ghost small" data-action="review-store" data-to="${to}" data-id="${escapeHtml(r.id)}">${L3(ar, en)}</button>`;
    const reviewBtns =
      rv === "pending"
        ? rvBtn("approved", "قبول", "Approve") + rvBtn("rejected", "رفض", "Reject")
        : rv === "approved"
          ? rvBtn("suspended", "إيقاف", "Suspend")
          : rv === "suspended"
            ? rvBtn("approved", "إعادة تفعيل", "Reinstate") + rvBtn("rejected", "رفض", "Reject")
            : rvBtn("approved", "قبول", "Approve") + rvBtn("pending", "إعادة للمراجعة", "Re-queue");
    const rvTip = r.review && r.review.reason ? ` title="${escapeHtml(r.review.reason)}"` : "";
    tr.innerHTML = `
      <td>${name}${count}${rvLabel ? ` <span class="muted"${rvTip}>⚑ ${escapeHtml(rvLabel)}</span>` : ""}</td>
      <td>${phone}</td>
      <td>${escapeHtml(login)}</td>
      <td>${pass}</td>
      <td>${st}</td>
      <td>
        <div class="row-actions">
          <button class="btn ghost small" data-action="edit-rest" data-id="${escapeHtml(r.id)}">${(I18N[lang] || I18N.en).edit || "Edit"}</button>
          <button class="btn ghost small" data-action="store-profile" data-id="${escapeHtml(r.id)}">${lang === "ar" ? "ملف المتجر" : lang === "fr" ? "Profil" : "Profile"}</button>
          <button class="btn ghost small" data-action="auth-rest" data-id="${escapeHtml(r.id)}">${lang === "ar" ? "دخول" : "Auth"}</button>
          ${reviewBtns}
          ${archived || rv !== "approved" ? "" : `<button class="btn ghost small" data-action="toggle-rest" data-id="${escapeHtml(r.id)}">${r.status === "unpublished" || r.isActive === false ? L3("نشر", "Publish") : L3("إخفاء", "Hide")}</button>`}
          <button class="btn ghost small" data-action="${archived ? "restore-rest" : "archive-rest"}" data-id="${escapeHtml(r.id)}">${archived ? L3("استعادة", "Restore") : L3("أرشفة", "Archive")}</button>
          <button class="btn ghost small" data-action="del-rest" data-id="${escapeHtml(r.id)}">${(I18N[lang] || I18N.en).delete || "Delete"}</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderItemsAdmin() {
  const tbody = el("itemsBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const restMap = new Map(
    adminRestaurants.map((r) => [String(r.id), asText(r.name) || String(r.id)]),
  );
  adminItems.forEach((it) => {
    const tr = document.createElement("tr");
    const name = asText(it.name) || String(it.id);
    const restName =
      restMap.get(String(it.restaurantId || "")) ||
      String(it.restaurantId || "");
    const price = Number(it.price || 0).toFixed(2);
    const st = it.archived ? "🗄" : it.isAvailable !== false ? "✅" : "⛔";
    const sale =
      it.salePrice != null && Number(it.salePrice) < Number(it.price)
        ? ` → <b>${Number(it.salePrice).toFixed(2)}</b>`
        : "";
    tr.innerHTML = `
      <td>${name}</td>
      <td>${restName}</td>
      <td>${price}${sale}</td>
      <td>${st}</td>
      <td><div class="row-actions"><button class="btn ghost small" data-action="edit-item" data-id="${it.id}">${(I18N[lang] || I18N.en).edit || "Edit"}</button><button class="btn ghost small" data-action="del-item" data-id="${it.id}">${(I18N[lang] || I18N.en).delete || "Delete"}</button></div></td>
    `;
    tbody.appendChild(tr);
  });
}

async function refreshMenuData() {
  if (!token) return;
  const r = await api("/api/admin/restaurants", { method: "GET" });
  const m = await api("/api/admin/menu", { method: "GET" });
  adminRestaurants = Array.isArray(r?.restaurants) ? r.restaurants : [];
  adminItems = Array.isArray(m?.items) ? m.items : [];

  const needsAuth = (
    Array.isArray(adminRestaurants) ? adminRestaurants : []
  ).some((x) => x && (!(x.loginEmail || x.loginPhone) || !x.hasPassword));
  setNotify("menuManageBtn", needsAuth);
  fillRestaurantSelect();
  renderRestaurantsAdmin();
  renderItemsAdmin();
}

async function addRestaurant() {
  const t = I18N[lang] || I18N.en;
  const name = {
    ar: el("restNameAr").value.trim(),
    en: el("restNameEn").value.trim(),
    fr: el("restNameFr").value.trim(),
  };
  if (!name.ar && !name.en && !name.fr) {
    el("restHint").textContent =
      lang === "ar" ? "أدخل اسم المطعم" : "Enter a restaurant name";
    return;
  }
  const payload = {
    name,
    phone: el("restPhone").value.trim(),
    address: el("restAddress").value.trim(),
    isActive: el("restActive").value === "1",
  };
  el("restHint").textContent = "";
  try {
    const created = await api("/api/admin/restaurants", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast("✅ " + (t.add || "Add"));
    // clear
    [
      "restNameAr",
      "restNameEn",
      "restNameFr",
      "restPhone",
      "restAddress",
    ].forEach((id) => {
      const x = el(id);
      if (x) x.value = "";
    });
    el("restActive").value = "1";
    await refreshMenuData();
    // open the full edit form so the admin can complete hours/fees/images
    if (created && created.restaurant && created.restaurant.id)
      openRestEdit(created.restaurant.id);
  } catch (e) {
    el("restHint").textContent = e.message;
  }
}

async function addItem() {
  const t = I18N[lang] || I18N.en;
  const restaurantId = el("itemRestaurant").value;
  const cat = el("itemCat").value.trim() || "general";
  const catLabel = {
    ar: el("itemCatAr").value.trim(),
    en: el("itemCatEn").value.trim(),
    fr: el("itemCatFr").value.trim(),
  };
  const name = {
    ar: el("itemNameAr").value.trim(),
    en: el("itemNameEn").value.trim(),
    fr: el("itemNameFr").value.trim(),
  };
  if (!name.ar && !name.en && !name.fr) {
    el("itemHint").textContent =
      lang === "ar" ? "أدخل اسم الوجبة" : "Enter a meal name";
    return;
  }
  const desc = {
    ar: el("itemDescAr").value.trim(),
    en: el("itemDescEn").value.trim(),
    fr: el("itemDescFr").value.trim(),
  };
  const price = Number(el("itemPrice").value || 0);
  const payload = {
    restaurantId,
    cat,
    catLabel,
    name,
    desc,
    price: Number.isFinite(price) ? price : 0,
    img: el("itemImg").value.trim(),
    isAvailable: el("itemAvail").value === "1",
  };
  el("itemHint").textContent = "";
  try {
    await api("/api/admin/menu", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast("✅ " + (t.add || "Add"));
    // clear minimal fields
    [
      "itemPrice",
      "itemCat",
      "itemImg",
      "itemCatAr",
      "itemCatEn",
      "itemCatFr",
      "itemNameAr",
      "itemNameEn",
      "itemNameFr",
      "itemDescAr",
      "itemDescEn",
      "itemDescFr",
    ].forEach((id) => {
      const x = el(id);
      if (x) x.value = "";
    });
    const f = el("itemImgFile");
    if (f) f.value = "";
    const prev = el("itemImgPrev");
    if (prev) {
      prev.src = "";
      prev.style.display = "none";
    }
    const hint = el("itemImgHint");
    if (hint) {
      const tt = I18N[lang] || I18N.en;
      hint.textContent = tt.uploadHint || "";
    }
    el("itemAvail").value = "1";
    await refreshMenuData();
  } catch (e) {
    el("itemHint").textContent = e.message;
  }
}

function setActiveAuthTab(tab) {
  const isLogin = tab === "login";
  el("tabLogin").classList.toggle("active", isLogin);
  el("tabSignup").classList.toggle("active", !isLogin);
  el("loginForm").style.display = isLogin ? "grid" : "none";
  el("signupForm").style.display = isLogin ? "none" : "grid";
  el("authHint").textContent = "";
  try {
    document.dispatchEvent(new CustomEvent("auth-tab", { detail: { tab } }));
  } catch (_e) {}
}

let authBusy = false;
function setAuthBusy(busy) {
  authBusy = !!busy;
  const card = el("authModal")?.querySelector(".ga-card");
  if (card) card.classList.toggle("is-busy", authBusy);
  ["loginBtn", "signupBtn"].forEach((id) => {
    const b = el(id);
    if (b) {
      b.disabled = authBusy;
      b.setAttribute("aria-busy", authBusy ? "true" : "false");
    }
  });
}

async function doLogin() {
  if (authBusy) return;
  const identifier = (el("loginId")?.value || "").trim();
  const password = String(el("loginPassword")?.value || "");

  const tr = I18N[lang] || I18N.en;
  if (!identifier) {
    el("authHint").textContent = tr.errNeedEmailPhone || "Enter email or phone";
    return;
  }
  if (!password) {
    el("authHint").textContent = tr.errNeedPass || "Enter password";
    return;
  }

  // unlock audio on user gesture (helps mobile/PWA)
  try {
    unlockAudio();
  } catch (_e) {}

  setAuthBusy(true);
  try {
    const res = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    token = res.token;
    localStorage.setItem(TOKEN_KEY, token);
    showAuth(false);
    toast("✅ OK");
    await bootstrapAfterAuth();
  } catch (e) {
    el("authHint").textContent = e.message;
  } finally {
    setAuthBusy(false);
  }
}

async function doSignup() {
  if (authBusy) return;
  const email = el("signupEmail").value.trim();
  const phone = el("signupPhone").value.trim();
  const password = el("signupPassword").value;
  const password2 = el("signupPassword2").value;
  const t = I18N[lang] || I18N.en;

  if (password2 !== password) {
    el("authHint").textContent = t.errPwMismatch || "Passwords do not match";
    return;
  }

  setAuthBusy(true);
  try {
    const res = await api("/api/admin/signup", {
      method: "POST",
      body: JSON.stringify({ email, phone, password, password2 }),
    });
    token = res.token;
    localStorage.setItem(TOKEN_KEY, token);
    showAuth(false);
    toast("✅ OK");
    await bootstrapAfterAuth();
  } catch (e) {
    el("authHint").textContent = e.message;
  } finally {
    setAuthBusy(false);
  }
}

function restaurantLabel() {
  const t = I18N[lang] || I18N.en;
  const mode = CONFIG?.restaurantMode || "auto";
  if (mode === "open") return t.restOpenBtn || "Restaurant: Open";
  if (mode === "closed") return t.restClosedBtn || "Restaurant: Closed";
  return t.restAutoBtn || "Restaurant: Auto";
}
function updateRestaurantBtn() {
  const btn = el("restToggleBtn");
  if (!btn) return;
  btn.textContent = restaurantLabel();
  const mode = CONFIG?.restaurantMode || "auto";
  btn.classList.toggle("good", mode === "open");
  btn.classList.toggle("bad", mode === "closed");
}

async function setRestaurantMode(mode) {
  try {
    const res = await api("/api/config", {
      method: "PUT",
      body: JSON.stringify({ restaurantMode: mode }),
    });
    CONFIG.restaurantMode = res.restaurantMode || mode;
    el("restaurantMode").value = CONFIG.restaurantMode;
    updateRestaurantBtn();
    toast("✅ OK");
  } catch (e) {
    toast("❌ " + e.message);
  }
}

/***********************
 * Config modal
 ***********************/
async function loadConfig() {
  CONFIG = await api("/api/config");
  // normalize
  CONFIG.wifiPrinter = CONFIG.wifiPrinter || { ip: "", port: 9100 };
  CONFIG.couriers = Array.isArray(CONFIG.couriers) ? CONFIG.couriers : [];
  CONFIG.wifiPrintEnabled = CONFIG.wifiPrintEnabled !== false;
  CONFIG.restaurantMode = CONFIG.restaurantMode || "auto";

  el("restaurantMode").value = CONFIG.restaurantMode;
  el("printerIp").value = CONFIG.wifiPrinter.ip || "";
  el("printerPort").value = String(CONFIG.wifiPrinter.port || 9100);
  el("couriersInput").value = (CONFIG.couriers || []).join("\n");
  el("wifiEnabled").value = CONFIG.wifiPrintEnabled ? "on" : "off";

  CONFIG.bankAccountName = CONFIG.bankAccountName || "";
  CONFIG.bankAccount = CONFIG.bankAccount || "";
  CONFIG.driverWalletEnabled = CONFIG.driverWalletEnabled !== false;
  CONFIG.driverWalletChargeMode = String(
    CONFIG.driverWalletChargeMode || "subtotal",
  );
  CONFIG.driverCommissionPerOrder = Number(
    CONFIG.driverCommissionPerOrder || 0,
  );

  el("bankAccountName") &&
    (el("bankAccountName").value = CONFIG.bankAccountName);
  el("bankAccount") && (el("bankAccount").value = CONFIG.bankAccount);
  el("driverWalletEnabled") &&
    (el("driverWalletEnabled").value = CONFIG.driverWalletEnabled
      ? "on"
      : "off");
  el("driverWalletChargeMode") &&
    (el("driverWalletChargeMode").value =
      CONFIG.driverWalletChargeMode || "subtotal");
  el("driverCommissionPerOrder") &&
    (el("driverCommissionPerOrder").value = String(
      CONFIG.driverCommissionPerOrder || 0,
    ));
  {
    const dp = CONFIG.deliveryPricing || {};
    el("deliveryPricingMode") && (el("deliveryPricingMode").value = dp.mode || "flat");
    el("deliveryPricePerKm") && (el("deliveryPricePerKm").value = String(dp.pricePerKm ?? 0));
    el("deliveryBaseFee") && (el("deliveryBaseFee").value = String(dp.baseFee ?? 0));
    el("deliveryMaxKm") && (el("deliveryMaxKm").value = String(dp.maxKm ?? 15));
    const de = CONFIG.driverEarnings || {};
    el("driverEarningsMode") && (el("driverEarningsMode").value = de.mode || "delivery_fee");
    el("driverEarningBase") && (el("driverEarningBase").value = String(de.base ?? 0));
    el("driverEarningPerKm") && (el("driverEarningPerKm").value = String(de.perKm ?? 0));
  }

  // Company policy
  CONFIG.companyPolicy =
    CONFIG.companyPolicy && typeof CONFIG.companyPolicy === "object"
      ? CONFIG.companyPolicy
      : { ar: "", en: "", fr: "" };
  CONFIG.companyPolicyRequireAccept =
    CONFIG.companyPolicyRequireAccept !== false;
  el("policyRequire") &&
    (el("policyRequire").value = CONFIG.companyPolicyRequireAccept
      ? "on"
      : "off");
  el("policyAr") &&
    (el("policyAr").value = String(CONFIG.companyPolicy.ar || ""));
  el("policyFr") &&
    (el("policyFr").value = String(CONFIG.companyPolicy.fr || ""));
  el("policyEn") &&
    (el("policyEn").value = String(CONFIG.companyPolicy.en || ""));

  // Offers banners
  CONFIG.offersBanners = Array.isArray(CONFIG.offersBanners)
    ? CONFIG.offersBanners
    : [];
  renderBanners();

  updateRestaurantBtn();
}

function renderBanners() {
  const box = el("bannerList");
  const hint = el("bannerHint");
  const t = I18N[lang] || I18N.en;
  const list = Array.isArray(CONFIG?.offersBanners)
    ? CONFIG.offersBanners.filter(Boolean)
    : [];
  if (hint)
    hint.textContent = list.length ? `(${list.length})` : t.bannersEmpty || "";
  if (!box) return;
  box.innerHTML = list
    .map(
      (u, i) => `
    <div class="banner-item">
      <img src="${escapeHtml(u)}" alt="banner" />
      <div class="banner-actions">
        <button class="btn ghost small" data-action="del-banner" data-i="${i}" type="button">✕</button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function persistBanners() {
  if (!token) return;
  CONFIG.offersBanners = Array.isArray(CONFIG.offersBanners)
    ? CONFIG.offersBanners.filter(Boolean).slice(0, 20)
    : [];
  await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ offersBanners: CONFIG.offersBanners }),
  });
}

async function uploadBannerImages(files) {
  const t = I18N[lang] || I18N.en;
  const hint = el("bannerHint");
  const list = Array.from(files || []).filter(Boolean);
  if (list.length === 0) return;
  try {
    for (const f of list) {
      if (hint) hint.textContent = t.bannerUploading || "Uploading...";
      const dataUrl = await fileToDataUrl(f);
      const res = await api("/api/admin/upload/banner-image", {
        method: "POST",
        body: JSON.stringify({ image: dataUrl }),
      });
      if (res && res.url) {
        CONFIG.offersBanners = Array.isArray(CONFIG.offersBanners)
          ? CONFIG.offersBanners
          : [];
        CONFIG.offersBanners.push(res.url);
      }
    }
    await persistBanners();
    renderBanners();
    if (hint) hint.textContent = t.bannerUploadOk || "Uploaded";
  } catch (e) {
    if (hint)
      hint.textContent =
        (t.bannerUploadFail || "Upload failed") +
        (e && e.message ? " — " + e.message : "");
  }
}

async function saveConfig() {
  const ip = el("printerIp").value.trim();
  const port = Number(el("printerPort").value || 9100);
  const couriers = el("couriersInput")
    .value.split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const wifiPrintEnabled = el("wifiEnabled").value === "on";
  const restaurantMode = el("restaurantMode").value || "auto";

  try {
    const res = await api("/api/config", {
      method: "PUT",
      body: JSON.stringify({
        wifiPrinter: { ip, port },
        couriers,
        wifiPrintEnabled,
        restaurantMode,
        bankAccountName: (el("bankAccountName")?.value || "").trim(),
        bankAccount: (el("bankAccount")?.value || "").trim(),
        driverWalletEnabled: el("driverWalletEnabled")?.value === "on",
        driverWalletChargeMode: String(
          el("driverWalletChargeMode")?.value || "subtotal",
        ),
        driverCommissionPerOrder: Number(
          el("driverCommissionPerOrder")?.value || 0,
        ),
        ...(el("driverEarningsMode")
          ? {
              driverEarningsMode: el("driverEarningsMode").value,
              driverEarningBase: el("driverEarningBase")?.value || "0",
              driverEarningPerKm: el("driverEarningPerKm")?.value || "0",
            }
          : {}),
        ...(el("deliveryPricingMode")
          ? {
              deliveryPricingMode: el("deliveryPricingMode").value,
              deliveryPricePerKm: el("deliveryPricePerKm")?.value || "0",
              deliveryBaseFee: el("deliveryBaseFee")?.value || "0",
              deliveryMaxKm: el("deliveryMaxKm")?.value || "15",
            }
          : {}),
        companyPolicyRequireAccept: el("policyRequire")?.value !== "off",
        companyPolicy: {
          ar: (el("policyAr")?.value || "").trim(),
          fr: (el("policyFr")?.value || "").trim(),
          en: (el("policyEn")?.value || "").trim(),
        },
        offersBanners: Array.isArray(CONFIG.offersBanners)
          ? CONFIG.offersBanners
          : [],
      }),
    });
    CONFIG.couriers = res.couriers;
    CONFIG.wifiPrinter = res.wifiPrinter;
    CONFIG.wifiPrintEnabled = res.wifiPrintEnabled !== false;
    CONFIG.restaurantMode =
      res.restaurantMode || CONFIG.restaurantMode || "auto";
    CONFIG.bankAccountName =
      res.bankAccountName || CONFIG.bankAccountName || "";
    CONFIG.bankAccount = res.bankAccount || CONFIG.bankAccount || "";
    CONFIG.driverWalletEnabled = res.driverWalletEnabled !== false;
    CONFIG.driverWalletChargeMode = String(
      res.driverWalletChargeMode || CONFIG.driverWalletChargeMode || "subtotal",
    );
    CONFIG.driverCommissionPerOrder = Number(res.driverCommissionPerOrder || 0);
    if (res.deliveryPricing) CONFIG.deliveryPricing = res.deliveryPricing;
    if (res.driverEarnings) CONFIG.driverEarnings = res.driverEarnings;
    CONFIG.companyPolicy =
      res.companyPolicy && typeof res.companyPolicy === "object"
        ? res.companyPolicy
        : CONFIG.companyPolicy || { ar: "", en: "", fr: "" };
    CONFIG.companyPolicyRequireAccept =
      res.companyPolicyRequireAccept !== false;
    CONFIG.companyPolicyUpdatedAt =
      res.companyPolicyUpdatedAt || CONFIG.companyPolicyUpdatedAt || null;
    CONFIG.offersBanners = Array.isArray(res.offersBanners)
      ? res.offersBanners
      : CONFIG.offersBanners || [];
    renderBanners();

    el("policyRequire") &&
      (el("policyRequire").value = CONFIG.companyPolicyRequireAccept
        ? "on"
        : "off");
    el("policyAr") &&
      (el("policyAr").value = String(CONFIG.companyPolicy.ar || ""));
    el("policyFr") &&
      (el("policyFr").value = String(CONFIG.companyPolicy.fr || ""));
    el("policyEn") &&
      (el("policyEn").value = String(CONFIG.companyPolicy.en || ""));

    el("restaurantMode").value = CONFIG.restaurantMode;
    updateRestaurantBtn();
    el("cfgHint").textContent = "✅ Saved";
    setTimeout(() => (el("cfgHint").textContent = ""), 1500);
    render();
  } catch (e) {
    el("cfgHint").textContent = e.message;
  }
}

/***********************
 * Orders + rendering
 ***********************/
function getFilterDate() {
  return el("filterDate").value || "";
}
function getSearch() {
  return (el("searchInput").value || "").trim().toLowerCase();
}

/* Orders list: status tabs + client-side pagination (display only; data/API untouched) */
let ordersTab = "all";
let ordersPage = 1;
let ordersSig = "";
const ORDERS_PAGE_SIZE = 10;
const ORDER_TAB_STATUSES = {
  done: ["delivered", "done"],
  canceled: ["canceled"],
};
function orderTabOf(o) {
  const st = String(o?.status || "new");
  if (st === "new") return "new";
  if (ORDER_TAB_STATUSES.done.includes(st)) return "done";
  if (ORDER_TAB_STATUSES.canceled.includes(st)) return "canceled";
  return "processing";
}

// date + search filters only (used for KPIs and tab counters)
function baseFilteredOrders() {
  let list = [...orders];
  const fd = getFilterDate();
  if (fd) {
    list = list.filter((o) => dateKey(o.createdAt) === fd);
  }
  const q = getSearch();
  if (q) {
    list = list.filter((o) => {
      const c = o.customer || {};
      return (
        String(o.id || "")
          .toLowerCase()
          .includes(q) ||
        String(c.name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.phone || "")
          .toLowerCase()
          .includes(q) ||
        String(c.addr || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }
  return list;
}

function filteredOrders() {
  const base = baseFilteredOrders();
  if (ordersTab === "all") return base;
  return base.filter((o) => orderTabOf(o) === ordersTab);
}

const ORD_ICONS = {
  view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  bt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>',
};

function ordDateCell(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hm = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<span class="ord-d">${escapeHtml(day)}</span><small>${escapeHtml(hm)}</small>`;
}

function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, cur - 1);
  const to = Math.min(total - 1, cur + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

function renderOrdersChrome(t, base, listLen) {
  // title + found counter
  if (el("ordersTitle")) el("ordersTitle").textContent = t.ordersTitle;
  if (el("ordersFound"))
    el("ordersFound").textContent = (t.ordersFound || "{n}").replace(
      "{n}",
      String(listLen),
    );
  // tabs (labels + counters + active state)
  const counts = { all: base.length, new: 0, processing: 0, done: 0, canceled: 0 };
  base.forEach((o) => counts[orderTabOf(o)]++);
  const labels = {
    all: t.all,
    new: t.new,
    processing: t.ordTabProcessing,
    done: t.ordTabDone,
    canceled: t.ordTabCanceled,
  };
  document.querySelectorAll("#ordersTabs [data-tab]").forEach((b) => {
    const k = b.getAttribute("data-tab");
    b.innerHTML = `${escapeHtml(labels[k] || k)} <span class="ord-count">${counts[k] || 0}</span>`;
    b.classList.toggle("active", k === ordersTab);
    b.setAttribute("aria-selected", k === ordersTab ? "true" : "false");
  });
}

function renderOrdersPager(t, total, pages) {
  const box = el("ordersPager");
  if (!box) return;
  if (!total) {
    box.innerHTML = "";
    return;
  }
  const a = (ordersPage - 1) * ORDERS_PAGE_SIZE + 1;
  const b = Math.min(total, ordersPage * ORDERS_PAGE_SIZE);
  const info = (t.ordShowing || "{a}-{b} / {n}")
    .replace("{a}", a)
    .replace("{b}", b)
    .replace("{n}", total);
  let nav = "";
  if (pages > 1) {
    nav = `<button type="button" class="ord-pg ord-pg-arrow" data-page="${ordersPage - 1}" aria-label="${escapeHtml(t.ordPrev || "Previous")}" ${ordersPage <= 1 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>`;
    pageList(ordersPage, pages).forEach((p) => {
      nav +=
        p === "…"
          ? `<span class="ord-pg-gap" aria-hidden="true">…</span>`
          : `<button type="button" class="ord-pg${p === ordersPage ? " on" : ""}" data-page="${p}" ${p === ordersPage ? 'aria-current="page"' : ""}>${p}</button>`;
    });
    nav += `<button type="button" class="ord-pg ord-pg-arrow" data-page="${ordersPage + 1}" aria-label="${escapeHtml(t.ordNext || "Next")}" ${ordersPage >= pages ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
  }
  box.innerHTML = `<span class="ord-info">${escapeHtml(info)}</span><div class="ord-pages">${nav}</div>`;
}

function render() {
  const t = I18N[lang] || I18N.en;
  const base = baseFilteredOrders();

  // KPIs (date + search only, as before)
  el("allCount").textContent = String(base.length);
  el("newCount").textContent = String(
    base.filter((o) => o.status === "new").length,
  );

  const list =
    ordersTab === "all" ? base : base.filter((o) => orderTabOf(o) === ordersTab);

  // reset to page 1 only when the filters change (not on polling refresh)
  const sig = [ordersTab, getFilterDate(), getSearch()].join("|");
  if (sig !== ordersSig) {
    ordersSig = sig;
    ordersPage = 1;
  }
  const pages = Math.max(1, Math.ceil(list.length / ORDERS_PAGE_SIZE));
  if (ordersPage > pages) ordersPage = pages;
  if (ordersPage < 1) ordersPage = 1;
  const pageItems = list.slice(
    (ordersPage - 1) * ORDERS_PAGE_SIZE,
    ordersPage * ORDERS_PAGE_SIZE,
  );

  renderOrdersChrome(t, base, list.length);
  renderOrdersPager(t, list.length, pages);

  const body = el("ordersBody");
  body.innerHTML = "";

  if (!pageItems.length) {
    const tr = document.createElement("tr");
    tr.className = "ord-empty-row";
    tr.innerHTML = `<td colspan="7" class="ord-empty">${escapeHtml(t.ordEmpty || "No orders")}</td>`;
    body.appendChild(tr);
  }

  pageItems.forEach((o) => {
    const tr = document.createElement("tr");
    if (o.id === selectedOrderId) tr.classList.add("selected");

    const st = String(o.status || "new");
    const statusClass = statusClassAdmin(st);
    const statusLabel = statusLabelAdmin(st);
    const id = escapeHtml(o.id);

    // ✅ Admin controls: accept + send to drivers
    const canAccept = st === "new";
    const btnAccept = `<button class="ord-btn ord-btn--accept" data-action="accept" data-id="${id}" ${canAccept ? "" : "disabled"}>${escapeHtml(t.acceptOrder || "Accept")}</button>`;
    const btnSend = "";

    const ico = (action, svg, label) =>
      `<button class="ord-ico" data-action="${action}" data-id="${id}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${svg}</button>`;
    const wifiBtn =
      CONFIG?.wifiPrintEnabled !== false
        ? ico("wifi", ORD_ICONS.wifi, t.wifiPrint)
        : "";

    tr.innerHTML = `
      <td class="ord-id"><b>${id}</b></td>
      <td class="ord-time">${ordDateCell(o.createdAt)}</td>
      <td class="ord-cust">
        <b>${escapeHtml(o.customer?.name || "")}</b>
        <small>${escapeHtml(o.customer?.phone || "")}</small>
      </td>
      <td class="ord-addr" title="${escapeHtml(o.customer?.addr || "")}"><span>${escapeHtml(o.customer?.addr || "")}</span></td>
      <td class="ord-total"><b>${escapeHtml(money(o.total))}</b></td>
      <td><span class="pill ord-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
      <td class="ord-actions">
        <div class="row-actions">
          ${btnAccept}
          ${btnSend}
          ${ico("view", ORD_ICONS.view, t.view)}
          ${ico("wa", ORD_ICONS.wa, t.whatsapp)}
          ${wifiBtn}
          ${ico("bt", ORD_ICONS.bt, t.btPrint)}
          <button class="ord-btn ord-btn--done" data-action="done" data-id="${id}">${escapeHtml(t.done)}</button>
        </div>
      </td>
    `;

    tr.addEventListener("click", (e) => {
      if (e.target && e.target.closest("button")) return;
      selectedOrderId = o.id;
      showDetails(o);
      render();
    });

    body.appendChild(tr);
  });

  // no selection
  if (selectedOrderId && !orders.some((o) => o.id === selectedOrderId)) {
    selectedOrderId = null;
    el("detailsBox").textContent = t.detailsEmpty;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showDetails(order) {
  const t = I18N[lang] || I18N.en;
  if (!order) {
    el("detailsBox").textContent = t.detailsEmpty;
    return;
  }

  const detailsOrderId = String(order.id);

  const receiptText = buildReceiptTextBlock(order);

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items
    .map((it) => {
      const lineTotal = Number(it.price || 0) * Number(it.qty || 0);
      return `<div style="display:flex; justify-content:space-between; gap:10px; margin:6px 0">
      <div><b>${escapeHtml(it.name || it.id)}</b> <small class="muted">x${it.qty}</small></div>
      <div><b>${money(lineTotal)}</b></div>
    </div>`;
    })
    .join("");

  const wifiEnabled = CONFIG?.wifiPrintEnabled !== false;
  const actions = `
    <div class="row-actions" style="margin-top:10px">
      <button class="btn ghost small" id="detailWaBtn" type="button">${t.whatsapp}</button>
      <button class="btn ghost small" id="detailHtmlBtn" type="button">${t.htmlPrint}</button>
      ${wifiEnabled ? `<button class="btn ghost small" id="detailWifiBtn" type="button">${t.wifiPrint}</button>` : ``}
      <button class="btn ghost small" id="detailBtBtn" type="button">${t.btPrint}</button>
      <button class="btn small" id="detailDoneBtn" type="button">${t.done}</button>
    </div>`;

  // Driver dispatch (admin -> driver)
  const assignTitle =
    lang === "ar"
      ? "إرسال للسائق"
      : lang === "fr"
        ? "Envoyer au chauffeur"
        : "Send to driver";
  const sendLabel =
    lang === "ar" ? "إرسال" : lang === "fr" ? "Envoyer" : "Send";
  const unassignLabel =
    lang === "ar" ? "إلغاء التعيين" : lang === "fr" ? "Retirer" : "Unassign";

  // Build options from approved drivers cache
  const currentDriverId = order.driverId ? String(order.driverId) : "";
  const approved = Array.isArray(APPROVED_DRIVERS) ? APPROVED_DRIVERS : [];
  const approvedIds = new Set(approved.map((d) => String(d.id)));
  let options = approved
    .map((d) => {
      const label = String(d.phone || d.email || d.cardNumber || d.id || "");
      return `<option value="${escapeHtml(d.id)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  // If order already assigned but driver not in list (rare), add it so it stays selectable
  if (currentDriverId && !approvedIds.has(currentDriverId)) {
    options =
      `<option value="${escapeHtml(currentDriverId)}">${escapeHtml(currentDriverId)}</option>` +
      options;
  }

  const assignBox = `
    <div class="panel-like" data-perm="orders.manage" style="margin-top:10px">
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <b>${assignTitle}</b>
        <a class="btn ghost small" href="/driver/" target="_blank" rel="noopener">${lang === "ar" ? "بوابة السائق" : "Driver Portal"}</a>
      </div>
      <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
        <select id="assignDriverSelect" style="min-width:240px">
          <option value="">-- ${lang === "ar" ? "اختر سائق" : "Select driver"} --</option>
          ${options}
        </select>
        <button class="btn good small" id="assignDriverBtn" type="button">${sendLabel}</button>
        <button class="btn ghost small" id="unassignDriverBtn" type="button">${unassignLabel}</button>
      </div>
      <div class="hint muted" id="assignHint"></div>
    </div>
  `;

  // Accepted driver info (who accepted + phone + time)
  const acceptedAtText = order.acceptedAt ? fmtTime(order.acceptedAt) : "";
  const acceptedDriver = currentDriverId
    ? (DRIVERS_CACHE || []).find(
        (d) => String(d.id) === String(currentDriverId),
      )
    : null;
  const acceptedDriverLabel = currentDriverId
    ? acceptedDriver
      ? (acceptedDriver.name || acceptedDriver.email || acceptedDriver.id) +
        (acceptedDriver.phone ? " • " + acceptedDriver.phone : "")
      : currentDriverId
    : "";
  const acceptedDriverPhone = acceptedDriver ? acceptedDriver.phone || "" : "";
  const driverInfoBox = `
  <div class="panel-like" style="margin-top:10px">
    <b>${t.acceptedDriverTitle || "Accepted driver"}</b>
    ${
      currentDriverId
        ? `
      <div style="margin-top:8px; display:grid; gap:6px">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap">
          <div><span class="muted">${lang === "ar" ? "السائق" : lang === "fr" ? "Chauffeur" : "Driver"}:</span> <b>${escapeHtml(acceptedDriverLabel)}</b></div>
          <div><span class="muted">${t.driverPhoneLabel || "Phone"}:</span> <b>${escapeHtml(acceptedDriverPhone || "-")}</b></div>
        </div>
        <div><span class="muted">${t.driverAcceptedAtLabel || "Accepted at"}:</span> <b>${escapeHtml(acceptedAtText || "-")}</b></div>
      </div>
    `
        : `
      <div class="muted" style="margin-top:8px">${t.driverNotAccepted || "Not accepted yet"}</div>
    `
    }
  </div>
`;

  const storeChatBox = order.restaurantId && order.customerId
    ? `<div class="panel-like" data-perm="support.use" style="margin-top:10px">
    <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <b>${lang === "ar" ? "محادثة المتجر ↔ الزبون" : lang === "fr" ? "Chat magasin ↔ client" : "Store ↔ Customer chat"}</b>
      <button class="btn ghost small" id="openStoreChatBtn" type="button">${lang === "ar" ? "عرض" : lang === "fr" ? "Voir" : "View"}</button>
    </div></div>`
    : "";
  const orderChatBox = `
  <div class="panel-like" data-perm="support.use" style="margin-top:10px">
    <div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <b>${lang === "ar" ? "دردشة السائق ↔ الزبون" : lang === "fr" ? "Chat chauffeur ↔ client" : "Driver ↔ Customer chat"}</b>
      <button class="btn ghost small" id="openOrderChatBtn" type="button" ${currentDriverId ? "" : "disabled"}>${lang === "ar" ? "فتح" : lang === "fr" ? "Ouvrir" : "Open"}</button>
    </div>
    <div class="muted" style="margin-top:6px; font-size:12px">
      ${currentDriverId ? (lang === "ar" ? "عرض محادثة الطلب مع السائق والزبون" : "View order chat between driver and customer") : lang === "ar" ? "لا يوجد سائق لهذا الطلب بعد" : "No driver assigned yet"}
    </div>
  </div>
`;

  el("detailsBox").innerHTML = `
    <div style="display:grid; gap:12px">
      <div class="ticket-preview">
        <img class="ticket-logo" src="/icons/icon-192.png" alt="siymon"/>
        <pre class="ticket-pre" dir="ltr">${escapeHtml(receiptText)}</pre>
        <div class="ticket-help">80mm / ESC-POS</div>
      </div>

      ${driverInfoBox}

      ${orderChatBox}
      ${storeChatBox}

      <details class="edit-details" id="editTicketDetails" data-perm="orders.manage">
        <summary>${t.editTicket}</summary>
        <div style="margin-top:12px; display:grid; gap:10px">
          <div class="input-row">
            <label for="editDeliveryFee">${t.deliveryFee}</label>
            <input id="editDeliveryFee" type="number" min="0" step="0.01" />
          </div>

          <div class="muted" style="font-size:12px">
            ${t.itemName} | ${t.qty} | ${t.unitPrice}
          </div>

          <div class="edit-items" id="editItems"></div>

          <div class="row-actions">
            <button class="btn ghost small" id="addLineBtn" type="button">${t.addLine}</button>
            <button class="btn good small" id="saveEditBtn" type="button">${t.saveChanges}</button>
          </div>

          <div style="display:flex; justify-content:space-between"><span class="muted">${t.subtotal}</span><b id="editSubtotal">0</b></div>
          <div style="display:flex; justify-content:space-between"><span class="muted">${t.deliveryFee}</span><b id="editDeliveryFeeView">0</b></div>
          <div style="display:flex; justify-content:space-between; font-weight:1000"><span>${t.total}</span><b id="editTotal">0</b></div>

          <div class="hint" id="editHint"></div>
        </div>
      </details>

      ${actions}
    </div>
  `;

  // Restore/track receipt editor open state so it doesn't collapse during updates.
  try {
    const det = el("editTicketDetails");
    if (det) {
      det.open = !!(
        EDIT_TICKET_OPEN && String(EDIT_TICKET_ORDER_ID) === detailsOrderId
      );
      det.addEventListener("toggle", () => {
        EDIT_TICKET_OPEN = !!det.open;
        EDIT_TICKET_ORDER_ID = detailsOrderId;
      });
    }
  } catch (_e) {
    /* ignore */
  }

  // bind buttons
  el("detailWaBtn")?.addEventListener("click", () => sendToCourier(order));
  el("detailHtmlBtn")?.addEventListener("click", () => printHtmlTicket(order));
  el("detailWifiBtn")?.addEventListener("click", () => printWifi(order));
  el("detailBtBtn")?.addEventListener("click", () => printBluetooth(order));
  el("detailDoneBtn")?.addEventListener("click", () => markDone(order.id));

  // order chat
  el("openStoreChatBtn")?.addEventListener("click", () => openOrderChatModal(String(order.id), "store"));
  el("openOrderChatBtn")?.addEventListener("click", () =>
    openOrderChatModal(String(order.id)),
  );

  // verification exception (supervisor, audited): only for orders with active codes
  try {
    const chatBtn = el("openOrderChatBtn");
    const v = order && order.verify;
    const active = ["accepted", "picked_up", "on_the_way"].includes(String(order.status || ""));
    if (chatBtn && v && active && !el("verifyExceptionBtn")) {
      const stages = ["pickup", "delivery"].filter((k) => v[k] && !v[k].verifiedAt && !v[k].exception);
      if (stages.length) {
        const b = document.createElement("button");
        b.id = "verifyExceptionBtn";
        b.type = "button";
        b.className = chatBtn.className;
        b.textContent = lang === "ar" ? "استثناء التحقق" : lang === "fr" ? "Exception de vérification" : "Verification exception";
        b.addEventListener("click", async () => {
          const stage = stages.length === 1 ? stages[0] : (prompt("pickup / delivery ?", stages[0]) || "").trim();
          if (!stages.includes(stage)) return;
          const reason = (prompt(lang === "ar" ? "سبب الاستثناء (إلزامي)" : lang === "fr" ? "Motif (obligatoire)" : "Reason (required)") || "").trim();
          if (reason.length < 3) return;
          try {
            await api(`/api/admin/orders/${encodeURIComponent(order.id)}/verify-exception`, {
              method: "POST",
              body: JSON.stringify({ stage, reason }),
            });
            toast("✅");
            b.remove();
            await loadOrders();
          } catch (e) {
            toast(e.message);
          }
        });
        chatBtn.parentNode.appendChild(b);
      }
    }
  } catch (_e) {
    /* ignore */
  }

  // driver dispatch bindings
  try {
    const sel = el("assignDriverSelect");
    const hint = el("assignHint");
    if (sel) sel.value = currentDriverId || "";

    if (hint) {
      if (currentDriverId) {
        const d = (Array.isArray(DRIVERS_CACHE) ? DRIVERS_CACHE : []).find(
          (x) => String(x.id) === currentDriverId,
        );
        const label = d
          ? d.phone || d.email || d.cardNumber || d.id
          : currentDriverId;
        hint.textContent =
          (lang === "ar"
            ? "السائق الحالي: "
            : lang === "fr"
              ? "Chauffeur actuel: "
              : "Current driver: ") + String(label);
      } else {
        hint.textContent =
          lang === "ar"
            ? "بدون سائق"
            : lang === "fr"
              ? "Aucun chauffeur"
              : "No driver assigned";
      }
    }

    el("assignDriverBtn")?.addEventListener("click", async () => {
      const driverId = sel?.value || "";
      if (!driverId) {
        if (hint)
          hint.textContent =
            lang === "ar"
              ? "اختر سائقاً أولاً"
              : lang === "fr"
                ? "Choisissez un chauffeur"
                : "Select a driver first";
        return;
      }
      try {
        const updated = await api(
          `/api/orders/${encodeURIComponent(order.id)}`,
          { method: "PATCH", body: JSON.stringify({ driverId }) },
        );
        const idx = orders.findIndex((o) => o.id === updated.id);
        if (idx >= 0) orders[idx] = updated;
        selectedOrderId = updated.id;
        showDetails(updated);
        render();
        if (hint)
          hint.textContent =
            lang === "ar"
              ? "✅ تم الإرسال"
              : lang === "fr"
                ? "✅ Envoyé"
                : "✅ Sent";
      } catch (e) {
        if (hint) hint.textContent = "❌ " + e.message;
      }
    });

    el("unassignDriverBtn")?.addEventListener("click", async () => {
      try {
        const updated = await api(
          `/api/orders/${encodeURIComponent(order.id)}`,
          { method: "PATCH", body: JSON.stringify({ driverId: "" }) },
        );
        const idx = orders.findIndex((o) => o.id === updated.id);
        if (idx >= 0) orders[idx] = updated;
        selectedOrderId = updated.id;
        showDetails(updated);
        render();
        if (hint)
          hint.textContent =
            lang === "ar"
              ? "✅ تم الإلغاء"
              : lang === "fr"
                ? "✅ Retiré"
                : "✅ Unassigned";
      } catch (e) {
        if (hint) hint.textContent = "❌ " + e.message;
      }
    });
  } catch (_e) {
    /* ignore */
  }

  initReceiptEditor(order);
}

// Build + manage receipt editor UI
function initReceiptEditor(order) {
  const t = I18N[lang] || I18N.en;
  const itemsWrap = el("editItems");
  const feeInput = el("editDeliveryFee");
  const hint = el("editHint");
  if (!itemsWrap || !feeInput) return;

  hint.textContent = "";
  feeInput.value = String(Number(order.deliveryFee || 0).toFixed(2));

  itemsWrap.innerHTML = "";

  function addLine(it) {
    const row = document.createElement("div");
    row.className = "edit-line";

    row.innerHTML = `
      <input class="edit-name" type="text" placeholder="${escapeHtml(t.itemName)}" value="${escapeHtml(it?.name || it?.id || "")}" />
      <input class="edit-qty" type="number" min="1" step="1" value="${Number(it?.qty || 1)}" />
      <input class="edit-price" type="number" min="0" step="0.01" value="${Number(it?.price || 0).toFixed(2)}" />
      <button class="edit-remove" type="button" title="Remove">✕</button>
    `;

    const onAnyChange = () => updateTotals();
    row.querySelector(".edit-name").addEventListener("input", onAnyChange);
    row.querySelector(".edit-qty").addEventListener("input", onAnyChange);
    row.querySelector(".edit-price").addEventListener("input", onAnyChange);

    row.querySelector(".edit-remove").addEventListener("click", () => {
      row.remove();
      updateTotals();
    });

    itemsWrap.appendChild(row);
  }

  // Seed lines
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length) {
    items.forEach((it) => addLine(it));
  } else {
    addLine({ name: "", qty: 1, price: 0 });
  }

  feeInput.addEventListener("input", () => updateTotals());
  el("addLineBtn")?.addEventListener("click", () =>
    addLine({ name: "", qty: 1, price: 0 }),
  );
  el("saveEditBtn")?.addEventListener("click", () =>
    saveReceiptEdits(order.id),
  );

  updateTotals();
}

function readReceiptEdits() {
  const fee = Number(el("editDeliveryFee")?.value || 0);
  const feeOk = Number.isFinite(fee) && fee >= 0 ? fee : 0;

  const lines = Array.from(document.querySelectorAll("#editItems .edit-line"));
  const items = [];
  for (const row of lines) {
    const name = (row.querySelector(".edit-name")?.value || "").trim();
    const qty = Number(row.querySelector(".edit-qty")?.value || 0);
    const price = Number(row.querySelector(".edit-price")?.value || 0);
    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    items.push({ id: name, name, qty, price });
  }
  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty) * Number(it.price),
    0,
  );
  const total = subtotal + feeOk;
  return { items, deliveryFee: feeOk, subtotal, total };
}

function updateTotals() {
  const t = readReceiptEdits();
  const s = el("editSubtotal");
  const f = el("editDeliveryFeeView");
  const tot = el("editTotal");
  if (s) s.textContent = money(t.subtotal);
  if (f) f.textContent = money(t.deliveryFee);
  if (tot) tot.textContent = money(t.total);
}

async function saveReceiptEdits(orderId) {
  const t = I18N[lang] || I18N.en;
  const hint = el("editHint");
  if (!hint) return;

  const edits = readReceiptEdits();
  if (!edits.items.length) {
    hint.textContent = "❌ Empty items";
    return;
  }

  try {
    const updated = await api(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        items: edits.items,
        deliveryFee: edits.deliveryFee,
        subtotal: edits.subtotal,
      }),
    });

    // update local state
    const idx = orders.findIndex((o) => o.id === updated.id);
    if (idx >= 0) orders[idx] = updated;
    if (selectedOrderId === updated.id) showDetails(updated);
    render();
    hint.textContent = "✅ " + (t.save || "Saved");
    setTimeout(() => {
      if (hint) hint.textContent = "";
    }, 1600);
  } catch (e) {
    hint.textContent = "❌ " + e.message;
  }
}

function ticketTexts(langCode) {
  const l = String(langCode || "ar");
  if (l === "fr")
    return {
      dir: "ltr",
      name: "Nom",
      phone: "Téléphone",
      address: "Adresse",
      notes: "Notes",
      subtotal: "Sous-total",
      delivery: "Livraison",
      total: "Total",
      order: "Commande",
    };
  if (l === "en")
    return {
      dir: "ltr",
      name: "Name",
      phone: "Phone",
      address: "Address",
      notes: "Notes",
      subtotal: "Subtotal",
      delivery: "Delivery",
      total: "Total",
      order: "Order",
    };
  return {
    dir: "rtl",
    name: "الاسم",
    phone: "الهاتف",
    address: "العنوان",
    notes: "ملاحظات",
    subtotal: "المجموع الفرعي",
    delivery: "رسوم التوصيل",
    total: "المجموع",
    order: "طلب",
  };
}

function getOrderRestaurantName(order) {
  try {
    const rid = String(order?.restaurantId || "").trim();
    if (rid && Array.isArray(adminRestaurants)) {
      const r = adminRestaurants.find((x) => String(x.id) === rid);
      const name =
        r && r.name
          ? r.name[lang] || r.name.ar || r.name.en || r.name.fr || r.name
          : "";
      if (name) return String(name);
    }
  } catch (_e) {
    /* ignore */
  }
  return String(CONFIG?.restaurantName || "siymon");
}

function receiptTexts() {
  // Keep ASCII labels for ESC/POS compatibility.
  return {
    order: "ORDER",
    name: "Name",
    phone: "Phone",
    address: "Addr",
    notes: "Notes",
    subtotal: "Subtotal",
    delivery: "Delivery",
    total: "TOTAL",
    qtyItem: "QTY ITEM",
    amount: "TOTAL",
    thanks: "Thank you",
  };
}

function buildReceiptTextBlock(order) {
  const tx = receiptTexts();
  const restName = getOrderRestaurantName(order);
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
    return l + " ".repeat(spaces) + r;
  }

  const out = [];
  out.push(String(restName));
  out.push(`${tx.order} #${order.id}`);
  out.push(String(fmtTime(order.createdAt)));
  out.push(sep);
  out.push(`${tx.name}:  ${order.customer?.name || "-"}`);
  out.push(`${tx.phone}: ${order.customer?.phone || "-"}`);
  out.push(`${tx.address}:  ${order.customer?.addr || "-"}`);
  if (order.customer?.notes) {
    const n = String(order.customer.notes || "").trim();
    if (n) out.push(`${tx.notes}: ${n}`);
  }
  out.push(sep);
  out.push(line(tx.qtyItem, tx.amount));
  out.push(sep);

  for (const it of order.items || []) {
    const lt = Number(it.price || 0) * Number(it.qty || 0);
    const left = `${it.qty || 0}x ${it.name || it.id || ""}`;
    out.push(line(left, moneyStr(lt)));
  }

  out.push(sep);
  out.push(line(tx.subtotal, moneyStr(order.subtotal)));
  out.push(line(tx.delivery, moneyStr(order.deliveryFee)));
  out.push(line(tx.total, moneyStr(order.total)));
  out.push(sep);
  out.push(tx.thanks);

  return out.join("\n") + "\n";
}
// Professional HTML ticket (with logo)
function printHtmlTicket(order) {
  const t = I18N[lang] || I18N.en;
  const tx = ticketTexts(order.lang || lang);
  const items = Array.isArray(order.items) ? order.items : [];

  // شلنا عمود "سعر الوحدة" عشان الورقة الـ 58 ضيقة، وهنعرض (الاسم، الكمية، المجموع) بس
  const rows = items
    .map((it) => {
      const lt = Number(it.price || 0) * Number(it.qty || 0);
      return `<tr>
      <td class="col-name">${escapeHtml(it.name || it.id)}</td>
      <td class="col-qty">${Number(it.qty || 0)}</td>
      <td class="col-total"><b>${Number(lt || 0).toFixed(2)}</b></td>
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

async function loadOrders(isPoll = false) {
  try {
    const res = await api("/api/orders");
    orders = Array.isArray(res.orders) ? res.orders : [];

    // detect new orders
    const newly = [];
    for (const o of orders) {
      if (!lastSeenIds.has(o.id)) {
        if (!firstLoad && o.status === "new") newly.push(o);
        lastSeenIds.add(o.id);
      }
    }

    if (newly.length) {
      beep();
      const t = I18N[lang] || I18N.en;
      toast(`${t.toastNew}: ${newly.length} ${t.toastOrders}`);
    }

    // green dot on refresh / New KPI when fresh orders arrived since last seen
    const maxTs = maxIsoMs(orders, "createdAt");
    const seenOrders = getSeen(LAST_SEEN_ORDERS_KEY);
    if (firstLoad || !seenOrders) {
      // baseline on first load
      setSeen(LAST_SEEN_ORDERS_KEY, maxTs);
      setNotify("refreshBtn", false);
      setNotify("kpiNew", false);
    } else {
      const hasNewSince = (Array.isArray(orders) ? orders : []).some(
        (o) => isoMs(o?.createdAt) > seenOrders,
      );
      setNotify("refreshBtn", hasNewSince);
      setNotify("kpiNew", hasNewSince);
    }

    firstLoad = false;
    render();

    // keep details in sync
    if (selectedOrderId) {
      const found = orders.find((o) => o.id === selectedOrderId);
      if (found) {
        // IMPORTANT: while editing the receipt, polling updates were rebuilding the
        // details panel which caused the <details> editor to close by itself.
        // If the receipt editor is open or focused, don't rebuild the details UI.
        const det = document.querySelector("#editTicketDetails");
        const editorOpen = !!(
          det &&
          det.open &&
          String(EDIT_TICKET_ORDER_ID) === String(found.id)
        );
        const activeInEditor = !!(
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest("#editTicketDetails")
        );
        if (!editorOpen && !activeInEditor) {
          showDetails(found);
        }
      }
    }
  } catch (e) {
    if (e.status === 401) {
      // session expired / account disabled: sign out (also from a background poll, so it never keeps failing silently)
      handleSessionExpired();
      return;
    }
    if (e.status === 403) {
      // permission, not authentication: keep the session, refresh what this role may see
      try { window.adminPerms && window.adminPerms.reload(); } catch (_e) {}
      if (!isPoll) toast(e.message);
      return;
    }
    if (!isPoll) toast(e.message);
  }
}

function handleSessionExpired() {
  if (!token) return;
  stopAutoRefresh();
  token = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch (_e) {}
  try { window.adminPerms && window.adminPerms.reset(); } catch (_e) {}
  firstLoad = true;
  lastSeenIds = new Set();
  orders = [];
  selectedOrderId = null;
  try { render(); } catch (_e) {}
  showAuth(true);
}

async function markAccepted(id) {
  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "admin_accepted" }),
    });
    toast("✅");
    await loadOrders();
  } catch (e) {
    toast(e.message);
  }
}

async function sendToDrivers(id) {
  try {
    // Directly expose the order to approved drivers (status: restaurant_ready)
    await api(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "restaurant_ready" }),
    });
    toast("✅");
    await loadOrders();
  } catch (e) {
    toast(e.message);
  }
}

async function markDone(id) {
  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    await loadOrders();
  } catch (e) {
    toast(e.message);
  }
}

/***********************
 * WhatsApp / courier
 ***********************/
function buildCourierMessage(order) {
  const tx = ticketTexts(lang);
  const lines = [];
  lines.push(`${tx.order} ${order.id}`);
  lines.push(`${tx.name}: ${order.name || ""}`);
  lines.push(`${tx.phone}: ${order.phone || ""}`);
  lines.push(`${tx.address}: ${order.address || ""}`);
  if (order.notes) lines.push(`${tx.notes}: ${order.notes}`);
  lines.push(`${tx.total}: ${fmtMoney(order.total || 0)}`);
  return lines.join("\n");
}

function sendToCourier(order) {
  const t = I18N[lang] || I18N.en;
  const courier = CONFIG?.couriers?.[0] || null;
  if (!courier) {
    toast(t.errNoCourier);
    return;
  }
  const msg = encodeURIComponent(buildCourierMessage(order));
  const url = `https://wa.me/${courier}?text=${msg}`;
  window.open(url, "_blank");
}

/***********************
 * Wi-Fi printing (server ESC/POS TCP)
 ***********************/
async function printWifi(order) {
  const t = I18N[lang] || I18N.en;
  if (CONFIG?.wifiPrintEnabled === false) {
    toast(t.errWifiDisabled);
    return;
  }
  try {
    await api("/api/print/wifi", {
      method: "POST",
      body: JSON.stringify({
        orderId: order.id,
        printerIp: CONFIG?.wifiPrinter?.ip,
        printerPort: CONFIG?.wifiPrinter?.port,
      }),
    });
    toast("✅ Printed");
  } catch (e) {
    toast(e.message);
  }
}

/***********************
 * Bluetooth printing (Web Bluetooth)
 ***********************/
const BT = {
  device: null,
  server: null,
  characteristic: null,
};

const BT_SERVICE_UUIDS = [
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
];

function updateBtBtn() {
  const t = I18N[lang] || I18N.en;
  const btn = el("btConnectBtn");
  if (BT.device && BT.characteristic) {
    btn.querySelector("span")?.remove();
    btn.textContent = `${t.btConnected}: ${BT.device.name || "Printer"}`;
  } else {
    btn.querySelector("span")?.remove();
    btn.textContent = t.connectBt;
  }
}

async function connectBluetooth() {
  const t = I18N[lang] || I18N.en;
  if (!navigator.bluetooth) {
    toast(t.errBtUnsupported);
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BT_SERVICE_UUIDS,
    });

    device.addEventListener("gattserverdisconnected", () => {
      BT.device = null;
      BT.server = null;
      BT.characteristic = null;
      updateBtBtn();
      updateRestaurantBtn();
    });

    const server = await device.gatt.connect();
    const characteristic = await findWritableCharacteristic(server);
    if (!characteristic) throw new Error(t.errBtChar);

    BT.device = device;
    BT.server = server;
    BT.characteristic = characteristic;
    updateBtBtn();
    updateRestaurantBtn();
    toast("✅ BT");
  } catch (e) {
    toast(e.message || t.errBtConnect);
  }
}

async function findWritableCharacteristic(server) {
  for (const uuid of BT_SERVICE_UUIDS) {
    try {
      const svc = await server.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.writeWithoutResponse || ch.properties.write) {
          return ch;
        }
      }
    } catch (_e) {
      /* try next */
    }
  }
  // fallback: try all services (some browsers allow getPrimaryServices)
  try {
    const svcs = await server.getPrimaryServices();
    for (const svc of svcs) {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.writeWithoutResponse || ch.properties.write) {
          return ch;
        }
      }
    }
  } catch (_e) {
    /* ignore */
  }

  return null;
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

  // logo (optional)
  const logo = logoRasterCmd();
  if (logo) {
    push(logo);
    text("\n");
  }

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
  // items header
  text(line("QTY ITEM", "TOTAL"));
  text(sep + "\n");

  for (const it of order.items || []) {
    const lt = Number(it.price || 0) * Number(it.qty || 0);
    const left = `${it.qty || 0}x ${it.name || it.id || ""}`;
    text(line(left, moneyStr(lt)));
  }

  text(sep + "\n");

  // totals
  push([0x1b, 0x45, 0x01]);
  text(line("Subtotal", moneyStr(order.subtotal)));
  text(line("Delivery", moneyStr(order.deliveryFee)));
  push([0x1b, 0x45, 0x00]);

  // total big center
  push([0x1b, 0x61, 0x01]);
  push([0x1d, 0x21, 0x11]);
  text(`TOTAL ${moneyStr(order.total)}\n`);
  push([0x1d, 0x21, 0x00]);

  text("\n\n");
  // cut
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

async function writeInChunks(characteristic, data) {
  const chunkSize = 180;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function printBluetooth(order) {
  const t = I18N[lang] || I18N.en;
  if (!navigator.bluetooth) {
    toast(t.errBtUnsupported);
    return;
  }
  try {
    if (!BT.device || !BT.characteristic) {
      await connectBluetooth();
      if (!BT.device || !BT.characteristic) return;
    }
    const payload = escposReceipt(order);
    await writeInChunks(BT.characteristic, payload);
    toast("✅ Printed");
  } catch (e) {
    toast(e.message || t.errBtConnect);
  }
}

/***********************
 * Events
 ***********************/
function bindEvents() {
  el("themeToggle").addEventListener("click", toggleTheme);
  el("adminLangToggle").addEventListener("click", cycleLang);

  el("soundToggle").addEventListener("click", () => setSound(!soundEnabled));
  el("soundGateBtn")?.addEventListener("click", () => {
    try {
      setSound(true);
      beep();
      hideSoundGate();
    } catch (_e) {}
  });

  el("restToggleBtn").addEventListener("click", async () => {
    const mode = CONFIG?.restaurantMode || "auto";
    const next = mode === "closed" ? "open" : "closed";
    await setRestaurantMode(next);
  });

  el("logoutBtn").addEventListener("click", () => {
    stopAutoRefresh();
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    try { window.adminPerms && window.adminPerms.reset(); } catch (_e) {}
    firstLoad = true;
    lastSeenIds = new Set();
    orders = [];
    selectedOrderId = null;
    render();
    showAuth(true);
  });

  el("refreshBtn").addEventListener("click", async () => {
    const btn = el("refreshBtn");
    if (btn.classList.contains("busy")) return;
    btn.classList.add("busy");
    btn.setAttribute("aria-busy", "true");
    try {
      // full refresh (orders + drivers + support + topups + notifications) through the same scheduler as the
      // automatic one, so the two never race and the automatic loop is guaranteed to be running afterwards
      if (!token) return showAuth(true);
      if (!refresher || !refresher.isRunning()) startAutoRefresh();
      await refresher.refreshNow({ manual: true, full: true });
      const maxTs = maxIsoMs(orders, "createdAt");
      if (maxTs) setSeen(LAST_SEEN_ORDERS_KEY, maxTs);
      setNotify("refreshBtn", false);
      setNotify("kpiNew", false);
    } finally {
      btn.classList.remove("busy");
      btn.removeAttribute("aria-busy");
    }
  });
  el("settingsBtn").addEventListener("click", async () => {
    try {
      await loadConfig();
      el("cfgHint").textContent = "";
      showSettings(true);
    } catch (e) {
      toast(e.message);
    }
  });

  // Offers banner
  el("bannerUpload")?.addEventListener("change", async (e) => {
    const files = e.target && e.target.files ? e.target.files : [];
    await uploadBannerImages(files);
    try {
      e.target.value = "";
    } catch (_e) {}
  });
  el("bannerList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action !== "del-banner") return;
    const i = Number(btn.getAttribute("data-i"));
    if (!Number.isFinite(i)) return;
    CONFIG.offersBanners = Array.isArray(CONFIG.offersBanners)
      ? CONFIG.offersBanners
      : [];
    CONFIG.offersBanners.splice(i, 1);
    renderBanners();
    try {
      await persistBanners();
    } catch (_e) {}
  });

  el("menuManageBtn").addEventListener("click", async () => {
    if (!token) return showAuth(true);
    setMenuTab(menuTab);
    showMenu(true);
  });
  el("closeMenuBtn").addEventListener("click", () => showMenu(false));
  el("menuTabRestaurants").addEventListener("click", () =>
    setMenuTab("restaurants"),
  );
  el("menuTabItems").addEventListener("click", () => setMenuTab("items"));
  el("addRestBtn").addEventListener("click", addRestaurant);
  el("addItemBtn").addEventListener("click", addItem);
  el("itemImgFile")?.addEventListener("change", (e) => {
    const f = e.target && e.target.files && e.target.files[0];
    uploadMealImage(f);
  });

  el("restaurantsBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "auth-rest") {
      openRestAuth(id);
      return;
    }
    if (action === "edit-rest") {
      openRestEdit(id);
      return;
    }
    if (action === "review-store") {
      const to = btn.getAttribute("data-to");
      let reason = "";
      if (to === "rejected" || to === "suspended") {
        reason = (
          prompt(
            lang === "ar"
              ? "سبب القرار (إلزامي)"
              : lang === "fr"
                ? "Motif de la décision (obligatoire)"
                : "Reason for this decision (required)",
          ) || ""
        ).trim();
        if (reason.length < 3) return;
      }
      try {
        const out = await api(`/api/admin/stores/${encodeURIComponent(id)}/review`, {
          method: "PATCH",
          body: JSON.stringify({ status: to, reason }),
        });
        await refreshMenuData();
        toast("✅");
        const c = (out.cancelled || []).length;
        const p = (out.inProgress || []).length;
        if (c || p)
          toast(
            lang === "ar"
              ? `طلبات أُلغيت: ${c} — طلبات جارية تحتاج متابعة: ${p}`
              : lang === "fr"
                ? `Commandes annulées : ${c} — en cours à suivre : ${p}`
                : `Orders cancelled: ${c} — in progress, need follow-up: ${p}`,
          );
      } catch (err) {
        const miss = err && err.body && err.body.missing;
        toast(miss ? `${err.message}: ${miss.join(", ")}` : err.message);
      }
      return;
    }
    if (action === "toggle-rest") {
      const cur = (adminRestaurants || []).find((x) => String(x.id) === id);
      const hidden = cur && (cur.status === "unpublished" || cur.isActive === false);
      await window.storesSetStatus(id, hidden ? "active" : "unpublished");
      return;
    }
    if (action === "archive-rest") {
      if (!confirm(lang === "ar" ? "أرشفة المطعم؟ سيختفي من واجهة الزبون." : "Archive restaurant? It will be hidden from customers.")) return;
      await window.storesSetStatus(id, "archived");
      return;
    }
    if (action === "restore-rest") {
      await window.storesSetStatus(id, "unpublished");
      return;
    }

    if (action === "del-rest") {
      if (!confirm(lang === "ar" ? "حذف المطعم؟" : "Delete restaurant?"))
        return;
      try {
        await api(`/api/admin/restaurants/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await refreshMenuData();
        toast("✅");
      } catch (err) {
        toast(err.message);
      }
    }
  });

  el("itemsBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "edit-item") {
      openItemEdit(id);
      return;
    }

    if (action === "del-item") {
      if (!confirm(lang === "ar" ? "حذف الوجبة؟" : "Delete meal?")) return;
      try {
        await api(`/api/admin/menu/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await refreshMenuData();
        toast("✅");
      } catch (err) {
        toast(err.message);
      }
    }
  });
  el("closeCfgBtn").addEventListener("click", () => showSettings(false));
  el("saveCfgBtn").addEventListener("click", saveConfig);

  el("btConnectBtn").addEventListener("click", connectBluetooth);

  // Drivers modal + review
  el("driversBtn")?.addEventListener("click", async () => {
    if (!token) return showAuth(true);
    try {
      DRIVERS_TAB = "pending";
      el("driversTabPending")?.classList.add("active");
      el("driversTabApproved")?.classList.remove("active");
      await loadDriversAdmin();
      showDrivers(true);
    } catch (e) {
      toast(e.message);
    }
  });
  el("closeDriversBtn")?.addEventListener("click", () => showDrivers(false));
  el("closeDriverViewBtn")?.addEventListener("click", () =>
    showDriverView(false),
  );

  // Image zoom modal events
  el("closeImgZoomBtn")?.addEventListener("click", () => showImgZoom(false));
  el("zoomInBtn")?.addEventListener("click", () => zoomStep(0.25));
  el("zoomOutBtn")?.addEventListener("click", () => zoomStep(-0.25));
  el("zoomResetBtn")?.addEventListener("click", () => {
    IMG_ZOOM_SCALE = 1;
    applyImgZoom();
  });
  el("imgZoomModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "imgZoomModal") showImgZoom(false);
  });

  // Zoom buttons inside driver details
  el("driverViewBox")?.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("button");
    if (btn && btn.getAttribute("data-action") === "zoom-driver-img") {
      const imgId = btn.getAttribute("data-img");
      const img = imgId ? document.getElementById(imgId) : null;
      if (img && img.src) openImgZoom(img.src);
      return;
    }
    const img = e.target && e.target.tagName === "IMG" ? e.target : null;
    if (
      img &&
      /^drv(Face|Front|Back)Img$/.test(String(img.id || "")) &&
      img.src
    ) {
      openImgZoom(img.src);
    }
  });

  el("driversTabs")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dtab]");
    if (!b) return;
    DRIVERS_TAB = b.getAttribute("data-dtab") || "pending";
    renderDriversAdmin();
  });
  el("drvSearch")?.addEventListener("input", (e) => {
    drvQuery = e.target.value || "";
    renderDriversAdmin();
  });
  el("drvRange")?.addEventListener("change", (e) => {
    drvRange = e.target.value || "all";
    renderDriversAdmin();
  });
  el("drvClear")?.addEventListener("click", () => {
    drvQuery = "";
    drvRange = "all";
    if (el("drvSearch")) el("drvSearch").value = "";
    if (el("drvRange")) el("drvRange").value = "all";
    renderDriversAdmin();
  });
  el("drvPager")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    const p = parseInt(b.getAttribute("data-page"), 10);
    if (!p) return;
    drvPage = p;
    renderDriversAdmin();
  });
  // broken avatar images fall back to the initials underneath
  el("driversBody")?.addEventListener(
    "error",
    (e) => {
      if (e.target && e.target.tagName === "IMG") e.target.remove();
    },
    true,
  );

  el("driversBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    const driver = (Array.isArray(DRIVERS_CACHE) ? DRIVERS_CACHE : []).find(
      (d) => String(d.id) === String(id),
    );
    if (action === "view-driver" && driver) {
      openDriverView(driver);
      return;
    }

    if (
      action === "approve-driver" ||
      action === "reject-driver" ||
      action === "suspend-driver"
    ) {
      const status =
        action === "approve-driver"
          ? "approved"
          : action === "reject-driver"
            ? "rejected"
            : "suspended";
      let reason = "";
      if (status !== "approved") {
        // the server requires a reason and records who decided and when
        reason = (
          prompt(
            lang === "ar"
              ? "سبب القرار (إلزامي)"
              : lang === "fr"
                ? "Motif de la décision (obligatoire)"
                : "Reason for this decision (required)",
          ) || ""
        ).trim();
        if (reason.length < 3) return;
      }
      try {
        const out = await api(`/api/admin/drivers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, reason }),
        });
        await loadDriversAdmin();
        toast("✅");
        const w = Array.isArray(out.warnings) ? out.warnings : [];
        if (w.length)
          toast(
            (lang === "ar"
              ? "تنبيه: لا توجد "
              : lang === "fr"
                ? "Attention : manque "
                : "Note: missing ") +
              w
                .map((x) => (x === "license_missing" ? (lang === "ar" ? "رخصة السياقة" : lang === "fr" ? "permis" : "licence") : lang === "ar" ? "بيانات المركبة" : lang === "fr" ? "véhicule" : "vehicle"))
                .join(" / "),
          );
        const rel = (out.released || []).length;
        const act = (out.inDelivery || []).length;
        if (rel || act)
          toast(
            (lang === "ar"
              ? `طلبات أُعيدت للتوزيع: ${rel} — قيد التوصيل لدى السائق: ${act}`
              : lang === "fr"
                ? `Commandes remises en distribution : ${rel} — en cours de livraison : ${act}`
                : `Orders released: ${rel} — still in the driver's hands: ${act}`),
          );
      } catch (err) {
        const miss = err && err.body && err.body.missing;
        toast(miss ? `${err.message}: ${miss.join(", ")}` : err.message);
      }
    }
  });

  // Customers modal
  el("customersBtn")?.addEventListener("click", async () => {
    if (!token) return showAuth(true);
    try {
      await loadCustomersAdmin();
      const maxTs = maxIsoMs(CUSTOMERS_CACHE, "createdAt");
      if (maxTs) setSeen(LAST_SEEN_CUSTOMERS_KEY, maxTs);
      setNotify("customersBtn", false);
      showCustomers(true);
    } catch (e) {
      toast(e.message);
    }
  });
  el("closeCustomersBtn")?.addEventListener("click", () =>
    showCustomers(false),
  );

  // Support modal
  // order chat modal events
  el("closeOrderChatModalBtn")?.addEventListener("click", () =>
    showOrderChatModal(false),
  );
  el("refreshOrderChatBtn")?.addEventListener("click", () =>
    loadOrderChatModal().catch(() => {}),
  );

  el("supportBtn")?.addEventListener("click", async () => {
    if (!token) return showAuth(true);
    try {
      await loadSupportConvos();
      showSupport(true);
      // Poll conversations and active chat
      if (SUPPORT_POLL) {
        try {
          clearInterval(SUPPORT_POLL);
        } catch (_e) {}
      }
      SUPPORT_POLL = setInterval(async () => {
        try {
          await loadSupportConvos();
          if (SUPPORT_ACTIVE_ID) await openSupportChat(SUPPORT_ACTIVE_ID);
        } catch (_e) {}
      }, 4000);
    } catch (e) {
      toast(e.message);
    }
  });
  el("closeSupportBtn")?.addEventListener("click", () => showSupport(false));
  el("refreshSupportBtn")?.addEventListener("click", () =>
    loadSupportConvos().catch(() => {}),
  );
  el("supportSendBtn")?.addEventListener("click", () =>
    sendSupportMessage().catch((err) => toast(err.message)),
  );
  el("supportMsgInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendSupportMessage().catch((err) => toast(err.message));
    }
  });

  // Notifications modal
  el("notificationsBtn")?.addEventListener("click", async () => {
    if (!token) return showAuth(true);
    try {
      if (el("notifHint")) el("notifHint").textContent = "";
      showNotificationsModal(true);
      await loadNotificationsAdmin();
    } catch (e) {
      toast(e.message);
    }
  });
  el("closeNotifBtn")?.addEventListener("click", () =>
    showNotificationsModal(false),
  );
  // sendNotifBtn / notifImg are now handled by admin-notifications.js

  // Topups modal
  el("topupsBtn")?.addEventListener("click", async () => {
    if (!token) return showAuth(true);
    try {
      await loadTopups();
      showTopups(true);
    } catch (e) {
      toast(e.message);
    }
  });
  el("closeTopupsBtn")?.addEventListener("click", () => showTopups(false));
  el("refreshTopupsBtn")?.addEventListener("click", () =>
    loadTopups().catch(() => {}),
  );
  el("topupsFilter")?.addEventListener("change", () => renderTopups());

  el("topupsBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;
    const topup = (Array.isArray(TOPUPS_CACHE) ? TOPUPS_CACHE : []).find(
      (t) => String(t.id) === String(id),
    );
    if (action === "view" && topup?.receiptUrl) {
      await viewTopupReceipt(topup.receiptUrl).catch((err) => toast(err.message));
      return;
    }
    if (action === "approve") {
      await decideTopup(id, "approved").catch((err) => toast(err.message));
      return;
    }
    if (action === "reject") {
      await decideTopup(id, "rejected").catch((err) => toast(err.message));
      return;
    }
  });

  // Restaurant auth modal
  el("closeRestAuthBtn")?.addEventListener("click", () => showRestAuth(false));
  el("saveRestAuthBtn")?.addEventListener("click", saveRestAuth);
  el("clearRestPassBtn")?.addEventListener("click", clearRestPassword);

  // Restaurant edit modal
  el("closeRestEditBtn")?.addEventListener("click", () => showRestEdit(false));
  el("saveRestEditBtn")?.addEventListener("click", saveRestEdit);

  // Meal edit modal
  el("closeItemEditBtn")?.addEventListener("click", () => showItemEdit(false));
  el("saveItemEditBtn")?.addEventListener("click", saveItemEdit);
  el("itemEditImgFile")?.addEventListener("change", (e) => {
    const f = e.target && e.target.files && e.target.files[0];
    uploadMealImageEdit(f);
  });

  el("todayBtn").addEventListener("click", () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    el("filterDate").value = `${y}-${m}-${da}`;
    render();
  });
  el("allBtn").addEventListener("click", () => {
    el("filterDate").value = "";
    render();
  });
  el("filterDate").addEventListener("change", () => render());
  el("searchInput").addEventListener("input", () => render());

  // auth tabs
  el("tabLogin").addEventListener("click", () => setActiveAuthTab("login"));
  el("tabSignup").addEventListener("click", () => setActiveAuthTab("signup"));
  el("loginBtn").addEventListener("click", doLogin);
  el("signupBtn").addEventListener("click", doSignup);

  bindCustomersUi();

  // orders status tabs + pagination
  el("ordersTabs")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    ordersTab = b.getAttribute("data-tab") || "all";
    render();
  });
  el("ordersPager")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    const p = parseInt(b.getAttribute("data-page"), 10);
    if (!p) return;
    ordersPage = p;
    render();
  });

  // table actions (event delegation)
  el("ordersBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id || !action) return;

    const order = orders.find((o) => o.id === id);
    if (!order) return;

    e.stopPropagation();

    if (action === "view") {
      selectedOrderId = id;
      showDetails(order);
      render();
    } else if (action === "wa") {
      sendToCourier(order);
    } else if (action === "wifi") {
      await printWifi(order);
    } else if (action === "bt") {
      await printBluetooth(order);
    } else if (action === "accept") {
      await markAccepted(id);
    } else if (action === "done") {
      await markDone(id);
    }
  });
}

/***********************
 * Auto refresh
 ***********************/
let refresher = null;
const POLL_MS = 5000;
// unknown permissions deny everything except the orders poll, which is also how an expired session (401) is noticed
const permOk = (p) => !window.adminPerms || window.adminPerms.can(p) || (p === "orders.read" && !window.adminPerms.perms());

// One refresh pass. Every part is independent and permission-aware: a part that fails or is not allowed for this
// role never blocks the others, and never makes a request the server would refuse (403 + audit-log noise).
let notifBusy = false;
const bounded = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(ok, ms))]);
// badges (support / topups / drivers / customers / stores): own in-flight guard, so a slow one never delays orders
function kickNotifs(init) {
  if (notifBusy) return Promise.resolve();
  notifBusy = true;
  return bounded(Promise.resolve().then(() => pollAdminNotifs(!!init)).catch(() => {}), 12000).finally(() => { notifBusy = false; });
}

async function refreshTick(info) {
  if (!token) return;
  info = info || {};
  if (!window.adminPerms || !window.adminPerms.perms()) {
    try { await bounded(window.adminPerms ? window.adminPerms.reload() : null, 8000); } catch (_e) {}
  }
  NOTIF_TICK++;
  const full = !!info.full;
  const badgeJob = full || NOTIF_TICK % 3 === 0 ? kickNotifs(false) : null;
  if (permOk("orders.read")) await loadOrders(true);   // loadOrders handles 401 (sign out) / 403 (reload permissions) itself
  if (full && badgeJob) await badgeJob;                 // manual refresh waits (bounded) so the button reflects completion
  if (info.manual && !token) return;
}

function startAutoRefresh() {
  if (!window.AdminRefresh) return;
  if (!refresher) refresher = window.AdminRefresh.create({ intervalMs: POLL_MS, tick: refreshTick });
  refresher.start();
}
function stopAutoRefresh() {
  if (refresher) refresher.stop();
}
// the page came back (tab visible, phone woke, back/forward cache, network returned): refresh now if stale
function resumeAutoRefresh() {
  if (!token) return;
  if (!refresher || !refresher.isRunning()) { startAutoRefresh(); }
  refresher.resume({ full: true });
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeAutoRefresh(); });
window.addEventListener("pageshow", (e) => { if (e.persisted) resumeAutoRefresh(); });
window.addEventListener("online", resumeAutoRefresh);
window.addEventListener("focus", resumeAutoRefresh);

/***********************
 * Init
 ***********************/
async function bootstrapAfterAuth() {
  NOTIF_TICK = 0;
  // Arm the automatic refresh FIRST (it used to be the last statement, so one hanging/failed loader below stopped it
  // forever, including after a page reload). The loaders below are independent, bounded and permission-aware.
  startAutoRefresh();
  try { if (window.adminPerms) await bounded(window.adminPerms.reload(), 8000); } catch (_e) {}
  await bounded(loadConfig().catch(() => {
    CONFIG = {
      couriers: [],
      wifiPrinter: { ip: "", port: 9100 },
      wifiPrintEnabled: true,
      currency: "MAD",
    };
  }), 8000);
  const first = [];
  if (permOk("orders.read")) first.push(loadOrders());
  first.push(kickNotifs(true));
  await Promise.allSettled(first.map((p) => bounded(p, 10000)));
}

(async function init() {
  loadTheme();
  bindEvents();
  applyI18n();

  // If the browser blocks autoplay, user must tap once to enable sound
  if (soundEnabled) showSoundGate();

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

  if (!token) {
    showAuth(true);
    setActiveAuthTab("login");
    return;
  }

  try {
    await bootstrapAfterAuth();
  } catch (e) {
    showAuth(true);
    setActiveAuthTab("login");
  }
})();
function statusLabelAdmin(st) {
  const t = I18N[lang] || I18N.en;
  const map = t.statusMap || {};
  const key = String(st || "new");
  return map[key] || key;
}
function statusClassAdmin(st) {
  const s = String(st || "new");
  if (s === "new") return "new";
  if (s === "canceled") return "bad";
  if (s === "done") return "done";
  if (s === "admin_accepted") return "sent";
  if (s === "restaurant_ready") return "ready";
  if (["accepted", "picked_up", "on_the_way", "delivered"].includes(s))
    return "delivery";
  return "sent";
}

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
