/* =========================================================
   SIYMON DRIVER APP — application logic
   Talks to the EXISTING backend APIs. Online/Offline and the
   notification list degrade gracefully when the matching
   endpoints (/api/driver/status, /api/driver/notifications)
   are not present on the server.
   ========================================================= */

const el = (id) => document.getElementById(id);

const TOKEN_KEY = "SIYMON_DRIVER_TOKEN";
const LANG_KEY = "SIYMON_DRIVER_LANG";
const SOUND_KEY = "SIYMON_DRIVER_SOUND";
const SOUND_PROMPTED_KEY = "SIYMON_DRIVER_SOUND_PROMPTED"; // the "enable sound" card was already shown on this device
const THEME_KEY = "SIYMON_DRIVER_THEME";
const ONLINE_KEY = "SIYMON_DRIVER_ONLINE";

let token = localStorage.getItem(TOKEN_KEY) || null;
let lang = localStorage.getItem(LANG_KEY) || "ar";
let soundEnabled = localStorage.getItem(SOUND_KEY) !== "0";
let theme = localStorage.getItem(THEME_KEY) || "dark";
let isOnline = localStorage.getItem(ONLINE_KEY) === "1";

let me = null;
let currentPage = "home"; // home | orders | history | wallet | profile
let pollTimer = null;
let publicCfg = null;
let CURRENCY = "MAD";

let lastOrders = { mine: [], available: [] };
let lastStats = null;
let ordersState = "loading"; // loading | ok | error
let firstOrdersLoad = true;
let seenMineIds = new Set();
let seenAvailIds = new Set();
const busyOrders = new Set();

let localNotifs = []; // in-session events observed by the app (newest first)
let localUnread = 0;
let serverNotifs = [];
let serverUnread = 0;

let historyFilterStatus = "all"; // all | delivered | canceled
let historyFilterDate = "all"; // all | today | yesterday | week | month
let historyPageSize = 20;
let historyShown = 20;

let orderAudio = null;
let audioCtx = null;
let audioUnlocked = false;


/* =========================
   I18N
   ========================= */
const I18N = {
  ar: {
    dir: "rtl",
    brand: "بوابة السائق",
    subtitle: "استقبل الطلبات وتتبع التوصيل بسهولة",
    authTitle: "بوابة السائق",
    tabLogin: "دخول",
    tabSignup: "تسجيل",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    name: "الاسم",
    cardNumber: "رقم البطاقة",
    password: "كلمة السر",
    confirmPassword: "تأكيد كلمة المرور",
    login: "دخول",
    signup: "تسجيل",
    loginHint: "يمكنك استعمال البريد الإلكتروني أو رقم الهاتف مع كلمة المرور.",
    refresh: "تحديث",
    logout: "تسجيل خروج",
    pendingTitle: "قيد الانتظار",
    pendingMsg: "حسابك قيد المراجعة. انتظر قبول المشرف ثم أعد التحديث.",
    refreshStatus: "تحديث الحالة",
    navHome: "الرئيسية",
    navOrders: "طلباتي",
    navHistory: "السجل",
    navWallet: "المحفظة",
    navProfile: "البروفايل",
    availableTitle: "طلبات متاحة",
    mineTitle: "طلباتي الحالية",
    historyTitle: "السجل",
    online: "متصل — جاهز لاستقبال الطلبات",
    offline: "غير متصل — لن تستقبل طلبات",
    offlineHint: "فعّل الاتصال لعرض الطلبات المتاحة",
    earnToday: "أرباح اليوم",
    earnWeek: "أرباح الأسبوع",
    earnMonth: "أرباح الشهر",
    noOrders: "لا توجد طلبات هنا حالياً.",
    noAvailable: "لا توجد طلبات متاحة الآن.",
    noHistory: "لا يوجد سجل مطابق.",
    accept: "قبول",
    status: "الحالة",
    st_new: "جديد",
    st_restaurant_ready: "جاهز",
    st_accepted: "مقبول",
    st_picked_up: "تم الاستلام",
    st_on_the_way: "في الطريق",
    st_delivered: "تم التسليم",
    st_done: "تم التسليم",
    st_canceled: "ملغي",
    notApproved: "حسابك غير مقبول بعد.",
    okSaved: "تم الحفظ",
    errPwMismatch: "كلمتا السر غير متطابقتين",
    errNeedEmailPhone: "أدخل البريد الإلكتروني أو رقم الهاتف",
    openMaps: "الموقع",
    restMap: "موقع المطعم",
    custMap: "موقع الزبون",
    call: "اتصال",
    chat: "دردشة",
    chatClosed: "انتهت المحادثة بعد إغلاق الطلب.",
    markDelivered: "تم التسليم",
    markCanceled: "إلغاء",
    addressLabel: "العنوان",
    totalLabel: "الإجمالي",
    subtotalLabel: "المجموع الفرعي",
    feeLabel: "رسوم التوصيل",
    walletBalanceLabel: "الرصيد",
    walletAvailableLabel: "متاح",
    walletReservedLabel: "محجوز",
    bankAccountLabel: "رقم الحساب البنكي",
    topupTitle: "شحن المحفظة",
    topupsListTitle: "شحناتي",
    send: "إرسال",
    time: "الوقت",
    amount: "المبلغ",
    receipt: "الوصل",
    view: "عرض",
    notSet: "غير متوفر",
    enterName: "أدخل الاسم",
    customerPhoneNA: "رقم الزبون غير متوفر",
    noMessagesYet: "لا توجد رسائل بعد",
    you: "أنت",
    customer: "الزبون",
    orderChatTitlePrefix: "دردشة الطلب",
    typeMsg: "اكتب رسالة...",
    attachImageLabel: "صورة",
    attachVoiceLabel: "صوت",
    micNotSupported: "التسجيل الصوتي غير مدعوم على هذا المتصفح.",
    micPermissionDenied: "تعذر الوصول للميكروفون. تحقق من الأذونات.",
    recStatusRecording: "جاري التسجيل...",
    recStatusReady: "جاهز للإرسال",
    sendFailed: "فشل الإرسال، حاول مجدداً",
    loginFirst: "قم بتسجيل الدخول أولاً.",
    insufficientBalance: "الرصيد غير كافٍ لقبول هذا الطلب.",
    goToWallet: "الذهاب للمحفظة",
    profileTitle: "المعلومات الشخصية",
    settingsTitle: "الإعدادات",
    settingDark: "الوضع الداكن",
    settingSound: "صوت الطلبات",
    settingLang: "اللغة",
    dangerZoneTitle: "منطقة الخطر",
    confirmLogoutTitle: "تسجيل الخروج",
    confirmLogoutMsg: "هل تريد تسجيل الخروج من حسابك؟",
    confirmDeleteTitle: "حذف الحساب نهائياً",
    confirmDeleteMsg: "لا يمكن التراجع عن هذه الخطوة. سيتم حذف حسابك بشكل نهائي.",
    confirm: "تأكيد",
    cancel: "إلغاء",
    accountDeleted: "تم حذف الحساب بنجاح.",
    newOrder: "طلب جديد",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات بعد.",
    orderDetails: "تفاصيل الطلب",
    restaurant: "المطعم",
    itemsLabel: "الأصناف",
    all: "الكل",
    delivered: "تم التسليم",
    canceled: "ملغي",
    today: "اليوم",
    yesterday: "أمس",
    week: "الأسبوع",
    month: "الشهر",
    searchPlaceholder: "بحث برقم الطلب أو اسم الزبون",
    soundOnMsg: "فعّل صوت الطلبات الجديدة حتى لا يفوتك أي طلب.",
    enableSound: "تفعيل الصوت",
    networkError: "تعذر الاتصال بالخادم. تحقق من الإنترنت.",
    sessionExpired: "انتهت الجلسة، الرجاء تسجيل الدخول من جديد.",
    tooManyRequests: "طلبات كثيرة جداً، حاول لاحقاً.",
    serverError: "حدث خطأ في الخادم.",
    imagesRequired: "الصور مطلوبة للتسجيل.",
  },
  en: {
    dir: "ltr",
    brand: "Driver Portal",
    subtitle: "Receive orders and track deliveries with ease",
    authTitle: "Driver Portal",
    tabLogin: "Login",
    tabSignup: "Sign up",
    email: "Email",
    phone: "Phone",
    name: "Name",
    cardNumber: "Card Number",
    password: "Password",
    confirmPassword: "Confirm Password",
    login: "Login",
    signup: "Sign up",
    loginHint: "You can use Email OR Phone with password.",
    refresh: "Refresh",
    logout: "Logout",
    pendingTitle: "Pending",
    pendingMsg: "Your account is pending review. Wait for approval then refresh.",
    refreshStatus: "Refresh status",
    navHome: "Home",
    navOrders: "Orders",
    navHistory: "History",
    navWallet: "Wallet",
    navProfile: "Profile",
    availableTitle: "Available orders",
    mineTitle: "My active orders",
    historyTitle: "History",
    online: "Online — ready for orders",
    offline: "Offline — you won't receive orders",
    offlineHint: "Go online to see available orders",
    earnToday: "Today",
    earnWeek: "This week",
    earnMonth: "This month",
    noOrders: "No orders here yet.",
    noAvailable: "No available orders right now.",
    noHistory: "No matching history.",
    accept: "Accept",
    status: "Status",
    st_new: "New",
    st_restaurant_ready: "Ready",
    st_accepted: "Accepted",
    st_picked_up: "Picked up",
    st_on_the_way: "On the way",
    st_delivered: "Delivered",
    st_done: "Delivered",
    st_canceled: "Canceled",
    notApproved: "Your account is not approved yet.",
    okSaved: "Saved",
    errPwMismatch: "Passwords do not match",
    errNeedEmailPhone: "Enter Email or Phone",
    openMaps: "Map",
    restMap: "Restaurant location",
    custMap: "Customer location",
    call: "Call",
    chat: "Chat",
    chatClosed: "This chat is closed (order finished).",
    markDelivered: "Delivered",
    markCanceled: "Cancel",
    addressLabel: "Address",
    totalLabel: "Total",
    subtotalLabel: "Subtotal",
    feeLabel: "Delivery fee",
    walletBalanceLabel: "Balance",
    walletAvailableLabel: "Available",
    walletReservedLabel: "Reserved",
    bankAccountLabel: "Bank account",
    topupTitle: "Top up",
    topupsListTitle: "My topups",
    send: "Send",
    time: "Time",
    amount: "Amount",
    receipt: "Receipt",
    view: "View",
    notSet: "Not set",
    enterName: "Enter name",
    customerPhoneNA: "Customer phone not available",
    noMessagesYet: "No messages yet",
    you: "You",
    customer: "Customer",
    orderChatTitlePrefix: "Order Chat",
    typeMsg: "Type a message...",
    attachImageLabel: "Image",
    attachVoiceLabel: "Voice",
    micNotSupported: "Voice recording is not supported on this browser.",
    micPermissionDenied: "Could not access the microphone. Check permissions.",
    recStatusRecording: "Recording...",
    recStatusReady: "Ready to send",
    sendFailed: "Send failed, try again",
    loginFirst: "Please login first.",
    insufficientBalance: "Insufficient wallet balance to accept this order.",
    goToWallet: "Go to Wallet",
    profileTitle: "Personal information",
    settingsTitle: "Settings",
    settingDark: "Dark mode",
    settingSound: "Order sound",
    settingLang: "Language",
    dangerZoneTitle: "Danger zone",
    confirmLogoutTitle: "Log out",
    confirmLogoutMsg: "Are you sure you want to log out?",
    confirmDeleteTitle: "Delete account permanently",
    confirmDeleteMsg: "This cannot be undone. Your account will be permanently deleted.",
    confirm: "Confirm",
    cancel: "Cancel",
    accountDeleted: "Account deleted successfully.",
    newOrder: "New order",
    notifications: "Notifications",
    noNotifications: "No notifications yet.",
    orderDetails: "Order details",
    restaurant: "Restaurant",
    itemsLabel: "Items",
    all: "All",
    delivered: "Delivered",
    canceled: "Canceled",
    today: "Today",
    yesterday: "Yesterday",
    week: "This week",
    month: "This month",
    searchPlaceholder: "Search by order # or customer name",
    soundOnMsg: "Turn on order sound so you never miss a new order.",
    enableSound: "Enable sound",
    networkError: "Could not reach the server. Check your connection.",
    sessionExpired: "Session expired, please log in again.",
    tooManyRequests: "Too many requests, try again later.",
    serverError: "A server error occurred.",
    imagesRequired: "Images are required for signup.",
  },
  fr: {
    dir: "ltr",
    brand: "Portail Chauffeur",
    subtitle: "Recevez des commandes et suivez vos livraisons",
    authTitle: "Portail Chauffeur",
    tabLogin: "Connexion",
    tabSignup: "Inscription",
    email: "Email",
    phone: "Téléphone",
    name: "Nom",
    cardNumber: "N° de carte",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    login: "Connexion",
    signup: "Inscription",
    loginHint: "Utilisez Email OU Téléphone avec le mot de passe.",
    refresh: "Rafraîchir",
    logout: "Déconnexion",
    pendingTitle: "En attente",
    pendingMsg: "Compte en attente de validation. Attendez l'admin puis rafraîchissez.",
    refreshStatus: "Rafraîchir l'état",
    navHome: "Accueil",
    navOrders: "Commandes",
    navHistory: "Historique",
    navWallet: "Portefeuille",
    navProfile: "Profil",
    availableTitle: "Commandes disponibles",
    mineTitle: "Mes commandes actives",
    historyTitle: "Historique",
    online: "En ligne — prêt à recevoir",
    offline: "Hors ligne — vous ne recevrez rien",
    offlineHint: "Passez en ligne pour voir les commandes",
    earnToday: "Aujourd'hui",
    earnWeek: "Cette semaine",
    earnMonth: "Ce mois",
    noOrders: "Aucune commande ici.",
    noAvailable: "Aucune commande disponible.",
    noHistory: "Aucun historique correspondant.",
    accept: "Accepter",
    status: "Statut",
    st_new: "Nouvelle",
    st_restaurant_ready: "Prête",
    st_accepted: "Acceptée",
    st_picked_up: "Récupérée",
    st_on_the_way: "En route",
    st_delivered: "Livrée",
    st_done: "Livrée",
    st_canceled: "Annulée",
    notApproved: "Compte non validé.",
    okSaved: "Enregistré",
    errPwMismatch: "Les mots de passe ne correspondent pas",
    errNeedEmailPhone: "Entrez Email ou Téléphone",
    openMaps: "Carte",
    restMap: "Position du restaurant",
    custMap: "Position du client",
    call: "Appeler",
    chat: "Chat",
    chatClosed: "Conversation fermée (commande terminée).",
    markDelivered: "Livrée",
    markCanceled: "Annuler",
    addressLabel: "Adresse",
    totalLabel: "Total",
    subtotalLabel: "Sous-total",
    feeLabel: "Frais de livraison",
    walletBalanceLabel: "Solde",
    walletAvailableLabel: "Disponible",
    walletReservedLabel: "Réservé",
    bankAccountLabel: "Compte bancaire",
    topupTitle: "Recharger",
    topupsListTitle: "Mes recharges",
    send: "Envoyer",
    time: "Heure",
    amount: "Montant",
    receipt: "Reçu",
    view: "Voir",
    notSet: "Non défini",
    enterName: "Entrez le nom",
    customerPhoneNA: "Numéro du client indisponible",
    noMessagesYet: "Aucun message pour le moment",
    you: "Vous",
    customer: "Client",
    orderChatTitlePrefix: "Chat commande",
    typeMsg: "Écrivez un message...",
    attachImageLabel: "Image",
    attachVoiceLabel: "Voix",
    micNotSupported: "L'enregistrement vocal n'est pas pris en charge sur ce navigateur.",
    micPermissionDenied: "Impossible d'accéder au microphone. Vérifiez les autorisations.",
    recStatusRecording: "Enregistrement...",
    recStatusReady: "Prêt à envoyer",
    sendFailed: "Échec de l'envoi, réessayez",
    loginFirst: "Connectez-vous d'abord.",
    insufficientBalance: "Solde insuffisant pour accepter cette commande.",
    goToWallet: "Aller au portefeuille",
    profileTitle: "Informations personnelles",
    settingsTitle: "Paramètres",
    settingDark: "Mode sombre",
    settingSound: "Son des commandes",
    settingLang: "Langue",
    dangerZoneTitle: "Zone de danger",
    confirmLogoutTitle: "Déconnexion",
    confirmLogoutMsg: "Voulez-vous vraiment vous déconnecter ?",
    confirmDeleteTitle: "Supprimer le compte définitivement",
    confirmDeleteMsg: "Cette action est irréversible. Votre compte sera définitivement supprimé.",
    confirm: "Confirmer",
    cancel: "Annuler",
    accountDeleted: "Compte supprimé avec succès.",
    newOrder: "Nouvelle commande",
    notifications: "Notifications",
    noNotifications: "Aucune notification.",
    orderDetails: "Détails de la commande",
    restaurant: "Restaurant",
    itemsLabel: "Articles",
    all: "Tout",
    delivered: "Livrée",
    canceled: "Annulée",
    today: "Aujourd'hui",
    yesterday: "Hier",
    week: "Cette semaine",
    month: "Ce mois",
    searchPlaceholder: "Rechercher par n° ou client",
    soundOnMsg: "Activez le son pour ne manquer aucune commande.",
    enableSound: "Activer le son",
    networkError: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    sessionExpired: "Session expirée, veuillez vous reconnecter.",
    tooManyRequests: "Trop de requêtes, réessayez plus tard.",
    serverError: "Une erreur serveur est survenue.",
    imagesRequired: "Les images sont obligatoires.",
  },
};

/* ---- Additional strings for the redesigned UI (same 3 languages) ---- */
const I18N_EXTRA = {
  ar: {
    greeting: "مرحباً",
    offlineBanner: "لا يوجد اتصال بالإنترنت. سيتم التحديث تلقائياً عند عودته.",
    loginIdLabel: "البريد الإلكتروني أو رقم الهاتف",
    loginIdPh: "driver@email.com / 06…",
    orContinueWith: "أو المتابعة باستخدام",
    socialHint: "الدخول عبر Google أو Apple متاح للحسابات المسجلة مسبقاً فقط.",
    noAccount: "ليس لديك حساب؟",
    createAccount: "إنشاء حساب",
    haveAccount: "لديك حساب بالفعل؟",
    secAccount: "بيانات الحساب",
    secDocs: "الوثائق",
    namePh: "اسم السائق",
    profilePhotoLabel: "صورة بروفايل (اختياري)",
    imgFaceLabel: "صورة الوجه مع بطاقة الدراجة",
    imgFrontLabel: "بطاقة التعريف (أمام)",
    imgBackLabel: "بطاقة التعريف (خلف)",
    dropoffKm: "المسافة إلى الزبون: {n} كم",
    addrAfterAccept: "يظهر عنوان الزبون بعد قبول الطلب",
    secVehicle: "المركبة",
    vehicleType: "نوع المركبة",
    vehicleNone: "—",
    vtMotorcycle: "دراجة نارية",
    vtScooter: "سكوتر",
    vtBicycle: "دراجة هوائية",
    vtCar: "سيارة",
    vehiclePlate: "رقم اللوحة",
    vehicleModel: "الطراز",
    imgLicenseLabel: "رخصة السياقة (موصى بها)",
    currentTitle: "طلباتي الحالية",
    seeAll: "عرض الكل",
    completedToday: "طلبات مكتملة اليوم",
    feesEarned: "رسوم التوصيل",
    showMore: "عرض المزيد",
    attachReceipt: "إرفاق صورة الوصل",
    walletHistoryTitle: "الحركات المالية",
    grpAccount: "الحساب",
    grpSettings: "الإعدادات",
    grpHelp: "المساعدة",
    accountInfo: "معلومات الحساب",
    helpSupport: "المساعدة والدعم",
    deleteAccount: "حذف الحساب",
    createdAt: "تاريخ التسجيل",
    back: "رجوع",
    st_admin_accepted: "بانتظار المطعم",
    workOnlineTitle: "أنت متصل",
    workOfflineTitle: "أنت غير متصل",
    workOnlineDesc: "تظهر لك الطلبات المتاحة ويصلك تنبيه عند وصول طلب جديد.",
    workOfflineDesc: "لن تظهر لك طلبات جديدة حتى تبدأ العمل.",
    startWork: "ابدأ العمل",
    stopWork: "إيقاف الاستقبال",
    nextPickedUp: "تأكيد الاستلام",
    nextOnTheWay: "بدء التوصيل",
    nextDelivered: "تأكيد التسليم",
    confirmAcceptTitle: "قبول الطلب؟",
    confirmAcceptMsg: "سيتم تعيين الطلب لك. المبلغ: {total}.",
    confirmDeliverTitle: "تأكيد التسليم؟",
    confirmDeliverMsg: "تأكد أن الطلب سُلّم للزبون. سيتم احتساب الطلب على محفظتك.",
    codePickupTitle: "أدخل كود الاستلام من المتجر",
    codeDeliveryTitle: "أدخل كود التسليم من الزبون",
    codeHint: "الكود مكوّن من 6 أرقام",
    codeWrong: "كود غير صحيح. المحاولات المتبقية: {n}",
    codeLocked: "تم قفل الإدخال مؤقتاً. حاول لاحقاً أو اتصل بالمشرف.",
    confirmCancelTitle: "إلغاء الطلب؟",
    confirmCancelMsg: "لا يمكن التراجع عن الإلغاء.",
    keepOrder: "إبقاء الطلب",
    cancelOrder: "إلغاء الطلب",
    justNow: "الآن",
    agoMin: "منذ {n} د",
    agoHour: "منذ {n} س",
    agoDay: "منذ {n} يوم",
    itemsCount: "{n} أصناف",
    txTopup: "شحن المحفظة",
    txOrderDeduct: "خصم طلب",
    txOther: "حركة مالية",
    noTx: "لا توجد حركات مالية بعد.",
    noTopups: "لا توجد طلبات شحن.",
    walletDisabledNote: "شحن المحفظة غير مفعّل حالياً.",
    tp_pending: "قيد المراجعة",
    tp_approved: "مقبول",
    tp_rejected: "مرفوض",
    supportNone: "بيانات الدعم غير متوفرة حالياً.",
    retry: "إعادة المحاولة",
    loadFailed: "تعذر تحميل البيانات.",
    goOnline: "ابدأ العمل",
    newOrderNotif: "طلب جديد متاح",
    assignedNotif: "تم تعيين طلب جديد لك",
    googleNotEnabled: "تسجيل الدخول عبر Google غير مفعّل بعد على الخادم.",
    appleNotEnabled: "تسجيل الدخول عبر Apple غير مفعّل بعد على الخادم.",
    socialFailed: "تعذر إكمال تسجيل الدخول. حاول مجدداً.",
    stepOf: "{a} من {b}",
    orderNo: "الطلب",
    amountInvalid: "أدخل مبلغاً صحيحاً.",
    receiptNeeded: "أضف صورة الوصل.",
    noTopupsList: "لا توجد طلبات شحن",
    receiptAttached: "تم اختيار الوصل",
  },
  en: {
    greeting: "Welcome back",
    offlineBanner: "No internet connection. Data will refresh automatically when it returns.",
    loginIdLabel: "Email or phone number",
    loginIdPh: "driver@email.com / 06…",
    orContinueWith: "Or continue with",
    socialHint: "Google / Apple sign-in works for existing driver accounts only.",
    noAccount: "Don't have an account?",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    secAccount: "Account details",
    secDocs: "Documents",
    namePh: "Driver name",
    profilePhotoLabel: "Profile photo (optional)",
    imgFaceLabel: "Face photo with bike card",
    imgFrontLabel: "ID card (front)",
    imgBackLabel: "ID card (back)",
    dropoffKm: "Distance to customer: {n} km",
    addrAfterAccept: "Customer address is shown after you accept",
    secVehicle: "Vehicle",
    vehicleType: "Vehicle type",
    vehicleNone: "—",
    vtMotorcycle: "Motorcycle",
    vtScooter: "Scooter",
    vtBicycle: "Bicycle",
    vtCar: "Car",
    vehiclePlate: "Plate number",
    vehicleModel: "Model",
    imgLicenseLabel: "Driving licence (recommended)",
    currentTitle: "My active orders",
    seeAll: "See all",
    completedToday: "orders completed today",
    feesEarned: "Delivery fees",
    showMore: "Show more",
    attachReceipt: "Attach receipt image",
    walletHistoryTitle: "Transactions",
    grpAccount: "Account",
    grpSettings: "Settings",
    grpHelp: "Help",
    accountInfo: "Account info",
    helpSupport: "Help & support",
    deleteAccount: "Delete account",
    createdAt: "Created",
    back: "Back",
    st_admin_accepted: "Waiting for restaurant",
    workOnlineTitle: "You're online",
    workOfflineTitle: "You're offline",
    workOnlineDesc: "Available orders are shown and you'll be alerted to new ones.",
    workOfflineDesc: "You won't see new orders until you start working.",
    startWork: "Start working",
    stopWork: "Stop receiving orders",
    nextPickedUp: "Confirm pickup",
    nextOnTheWay: "Start delivery",
    nextDelivered: "Confirm delivery",
    confirmAcceptTitle: "Accept this order?",
    confirmAcceptMsg: "The order will be assigned to you. Amount: {total}.",
    confirmDeliverTitle: "Confirm delivery?",
    confirmDeliverMsg: "Make sure the order was handed to the customer. It will be charged to your wallet.",
    codePickupTitle: "Enter the pickup code from the store",
    codeDeliveryTitle: "Enter the delivery code from the customer",
    codeHint: "The code has 6 digits",
    codeWrong: "Wrong code. Attempts left: {n}",
    codeLocked: "Entry is temporarily locked. Try later or contact the supervisor.",
    confirmCancelTitle: "Cancel this order?",
    confirmCancelMsg: "This cannot be undone.",
    keepOrder: "Keep order",
    cancelOrder: "Cancel order",
    justNow: "Just now",
    agoMin: "{n} min ago",
    agoHour: "{n} h ago",
    agoDay: "{n} d ago",
    itemsCount: "{n} items",
    txTopup: "Wallet top-up",
    txOrderDeduct: "Order charge",
    txOther: "Transaction",
    noTx: "No transactions yet.",
    noTopups: "No top-up requests.",
    walletDisabledNote: "Wallet top-up is currently disabled.",
    tp_pending: "Pending",
    tp_approved: "Approved",
    tp_rejected: "Rejected",
    supportNone: "Support details are not available right now.",
    retry: "Try again",
    loadFailed: "Could not load data.",
    goOnline: "Start working",
    newOrderNotif: "New order available",
    assignedNotif: "A new order was assigned to you",
    googleNotEnabled: "Google sign-in is not enabled on the server yet.",
    appleNotEnabled: "Apple sign-in is not enabled on the server yet.",
    socialFailed: "Sign-in could not be completed. Please try again.",
    stepOf: "{a} of {b}",
    orderNo: "Order",
    amountInvalid: "Enter a valid amount.",
    receiptNeeded: "Add a receipt image.",
    noTopupsList: "No top-ups",
    receiptAttached: "Receipt selected",
  },
  fr: {
    greeting: "Bon retour",
    offlineBanner: "Pas de connexion Internet. Les données se mettront à jour à son retour.",
    loginIdLabel: "Email ou numéro de téléphone",
    loginIdPh: "driver@email.com / 06…",
    orContinueWith: "Ou continuer avec",
    socialHint: "La connexion Google / Apple fonctionne pour les comptes existants uniquement.",
    noAccount: "Pas de compte ?",
    createAccount: "Créer un compte",
    haveAccount: "Déjà un compte ?",
    secAccount: "Informations du compte",
    secDocs: "Documents",
    namePh: "Nom du chauffeur",
    profilePhotoLabel: "Photo de profil (optionnel)",
    imgFaceLabel: "Photo avec la carte du deux-roues",
    imgFrontLabel: "Carte d'identité (recto)",
    imgBackLabel: "Carte d'identité (verso)",
    dropoffKm: "Distance jusqu'au client : {n} km",
    addrAfterAccept: "L'adresse du client s'affiche après acceptation",
    secVehicle: "Véhicule",
    vehicleType: "Type de véhicule",
    vehicleNone: "—",
    vtMotorcycle: "Moto",
    vtScooter: "Scooter",
    vtBicycle: "Vélo",
    vtCar: "Voiture",
    vehiclePlate: "Plaque",
    vehicleModel: "Modèle",
    imgLicenseLabel: "Permis de conduire (recommandé)",
    currentTitle: "Mes commandes actives",
    seeAll: "Tout voir",
    completedToday: "commandes terminées aujourd'hui",
    feesEarned: "Frais de livraison",
    showMore: "Voir plus",
    attachReceipt: "Joindre l'image du reçu",
    walletHistoryTitle: "Transactions",
    grpAccount: "Compte",
    grpSettings: "Paramètres",
    grpHelp: "Aide",
    accountInfo: "Infos du compte",
    helpSupport: "Aide et support",
    deleteAccount: "Supprimer le compte",
    createdAt: "Créé",
    back: "Retour",
    st_admin_accepted: "En attente du restaurant",
    workOnlineTitle: "Vous êtes en ligne",
    workOfflineTitle: "Vous êtes hors ligne",
    workOnlineDesc: "Les commandes disponibles s'affichent et vous êtes alerté des nouvelles.",
    workOfflineDesc: "Vous ne verrez pas de nouvelles commandes avant de commencer.",
    startWork: "Commencer",
    stopWork: "Arrêter la réception",
    nextPickedUp: "Confirmer la récupération",
    nextOnTheWay: "Démarrer la livraison",
    nextDelivered: "Confirmer la livraison",
    confirmAcceptTitle: "Accepter cette commande ?",
    confirmAcceptMsg: "La commande vous sera attribuée. Montant : {total}.",
    confirmDeliverTitle: "Confirmer la livraison ?",
    confirmDeliverMsg: "Vérifiez que la commande a été remise au client. Elle sera débitée de votre portefeuille.",
    codePickupTitle: "Saisissez le code de retrait du magasin",
    codeDeliveryTitle: "Saisissez le code de livraison du client",
    codeHint: "Le code comporte 6 chiffres",
    codeWrong: "Code incorrect. Tentatives restantes : {n}",
    codeLocked: "Saisie verrouillée temporairement. Réessayez plus tard ou contactez le superviseur.",
    confirmCancelTitle: "Annuler cette commande ?",
    confirmCancelMsg: "Cette action est irréversible.",
    keepOrder: "Garder la commande",
    cancelOrder: "Annuler la commande",
    justNow: "À l'instant",
    agoMin: "il y a {n} min",
    agoHour: "il y a {n} h",
    agoDay: "il y a {n} j",
    itemsCount: "{n} articles",
    txTopup: "Recharge du portefeuille",
    txOrderDeduct: "Débit commande",
    txOther: "Transaction",
    noTx: "Aucune transaction pour le moment.",
    noTopups: "Aucune demande de recharge.",
    walletDisabledNote: "La recharge du portefeuille est désactivée.",
    tp_pending: "En attente",
    tp_approved: "Validée",
    tp_rejected: "Refusée",
    supportNone: "Coordonnées du support indisponibles.",
    retry: "Réessayer",
    loadFailed: "Impossible de charger les données.",
    goOnline: "Commencer",
    newOrderNotif: "Nouvelle commande disponible",
    assignedNotif: "Une nouvelle commande vous a été attribuée",
    googleNotEnabled: "La connexion Google n'est pas encore activée sur le serveur.",
    appleNotEnabled: "La connexion Apple n'est pas encore activée sur le serveur.",
    socialFailed: "Connexion impossible. Réessayez.",
    stepOf: "{a} sur {b}",
    orderNo: "Commande",
    amountInvalid: "Entrez un montant valide.",
    receiptNeeded: "Ajoutez l'image du reçu.",
    noTopupsList: "Aucune recharge",
    receiptAttached: "Reçu sélectionné",
  },
};
for (const k of Object.keys(I18N_EXTRA)) Object.assign(I18N[k], I18N_EXTRA[k]);

function t() {
  return I18N[lang] || I18N.en;
}

/* =========================
   Toasts
   ========================= */
function toast(message, kind) {
  const wrap = el("toastWrap");
  if (!wrap) return;
  const div = document.createElement("div");
  div.className = "toast" + (kind ? " " + kind : "");
  div.textContent = message;
  wrap.appendChild(div);
  setTimeout(() => {
    div.style.transition = "opacity .2s ease";
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 200);
  }, 3200);
}

/* =========================
   API helper (unchanged contract)
   ========================= */
async function api(url, opts = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {},
  );
  if (token) headers["X-Driver-Token"] = token;
  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (_networkErr) {
    window.SiymonOffline && window.SiymonOffline.onNetworkFail(); // real "server unreachable" signal
    const err = new Error(t().networkError);
    err.status = 0;
    throw err;
  }
  // any HTTP answer proves the server is reachable; only a 2xx counts as a successful synchronisation
  window.SiymonOffline && window.SiymonOffline.onServerAnswered(res.ok);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    data = { error: text || "Error" };
  }
  if (!res.ok) {
    let msg = data.error || "";
    // never show raw HTML (e.g. Express "Cannot PATCH ...") to the driver
    if (/^\s*<(!doctype|html)/i.test(String(msg))) msg = "";
    if (!msg) {
      if (res.status === 401) msg = t().sessionExpired;
      else if (res.status === 429) msg = t().tooManyRequests;
      else if (res.status >= 500) msg = t().serverError;
      else msg = t().serverError;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function friendlyErr(e) {
  if (!e) return t().serverError;
  const m = String(e.message || "");
  if (!m || m === "undefined" || m === "null" || m === "NaN")
    return t().serverError;
  return m;
}

/* =========================
   Icons & small formatters
   ========================= */
function icon(name, cls) {
  return `<svg class="ic${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function fmt(template, vars) {
  return String(template || "").replace(/\{(\w+)\}/g, (_m, k) => (vars && vars[k] !== undefined ? vars[k] : ""));
}

function timeAgo(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  const tr = t();
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return tr.justNow;
  if (mins < 60) return fmt(tr.agoMin, { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return fmt(tr.agoHour, { n: hrs });
  return fmt(tr.agoDay, { n: Math.floor(hrs / 24) });
}

function money(n) {
  const v = Number(n || 0);
  const rounded = Math.round(v * 100) / 100;
  const isInt = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  const s = isInt ? String(Math.round(rounded)) : rounded.toFixed(2);
  const cur = lang === "ar" && CURRENCY === "MAD" ? "د.م." : CURRENCY;
  return `${s} ${cur}`;
}

function statusLabel(st) {
  const tr = t();
  const key = "st_" + String(st || "").toLowerCase();
  return tr[key] || String(st || "");
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/* =========================
   Theme
   ========================= */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  const sw = el("darkSwitch");
  if (sw) {
    sw.classList.toggle("on", theme === "dark");
    sw.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0F0F0F" : "#F8F8F8");
}
function setTheme(next) {
  theme = next === "dark" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

/* =========================
   Sound
   ========================= */
function soundPrompted() {
  try { return localStorage.getItem(SOUND_PROMPTED_KEY) === "1"; } catch (_e) { return false; }
}
function markSoundPrompted() {
  try { localStorage.setItem(SOUND_PROMPTED_KEY, "1"); } catch (_e) {}
}
/** Browsers that can tell us (Firefox/Safari getAutoplayPolicy) say whether sound may start without a tap. */
function autoplayAllowed() {
  try {
    if (navigator.getAutoplayPolicy) return navigator.getAutoplayPolicy("mediaelement") === "allowed";
  } catch (_e) {}
  return false;
}
/** The card is shown ONCE per device (persisted), never on the sign-in screen, never twice at the same time.
 *  `explicit` = the driver just switched sound on in Settings and the browser still refused: tell them then. */
function showSoundGate(explicit) {
  if (!token) return; // never block the sign-in screen
  const gate = el("soundGate");
  if (!gate || gate.classList.contains("show-flex")) return;
  if (explicit !== true && soundPrompted()) return;
  markSoundPrompted();
  gate.classList.add("show-flex");
}
function hideSoundGate() {
  const gate = el("soundGate");
  if (gate) gate.classList.remove("show-flex");
}
function unlockAudio(explicit) {
  if (!soundEnabled) return;
  if (explicit !== true) explicit = false; // listeners pass an Event here
  try {
    if (!orderAudio) {
      orderAudio = new Audio("/sounds/order.mp3");
      orderAudio.preload = "auto";
    }
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
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
        showSoundGate(explicit);
      });
    } else {
      hideSoundGate();
    }
  } catch (_e) {
    showSoundGate(explicit);
  }
}
function playRingtone() {
  if (!soundEnabled || !isOnline) return;
  unlockAudio();
  try {
    if (!orderAudio) orderAudio = new Audio("/sounds/order.mp3");
    orderAudio.currentTime = 0;
    orderAudio.volume = 1.0;
    const p = orderAudio.play();
    if (p !== undefined) {
      p.catch(() => {
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = "sine";
          o.frequency.value = 880;
          g.gain.value = 0.1;
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
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (_e) {}
  } catch (_e) {}
}
function setSound(enabled, byUser) {
  soundEnabled = !!enabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0");
  const sw = el("soundSwitch");
  if (sw) sw.classList.toggle("on", soundEnabled);
  if (sw) sw.setAttribute("aria-checked", soundEnabled ? "true" : "false");
  if (soundEnabled) {
    try {
      unlockAudio(byUser === true);
    } catch (_e) {}
  }
}

/* =========================
   Language
   ========================= */
function setLang(next) {
  lang = ["ar", "en", "fr"].includes(next) ? next : "ar";
  localStorage.setItem(LANG_KEY, lang);
  applyI18n();
  renderAll();
}
function nextLang() {
  return lang === "ar" ? "en" : lang === "en" ? "fr" : "ar";
}

function applyI18n() {
  const tr = t();
  document.documentElement.lang = lang;
  document.documentElement.dir = tr.dir;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const v = tr[node.getAttribute("data-i18n")];
    if (v !== undefined) node.textContent = v;
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((node) => {
    const v = tr[node.getAttribute("data-i18n-ph")];
    if (v !== undefined) node.placeholder = v;
  });

  const setText = (id, val) => {
    const node = el(id);
    if (node) node.textContent = val;
  };
  setText("soundGateText", tr.soundOnMsg);
  setText("soundGateBtn", tr.enableSound);
  setText("attachImageLabel", tr.attachImageLabel);
  setText("attachVoiceLabel", tr.attachVoiceLabel);
  const ci = el("orderChatInput");
  if (ci) ci.placeholder = tr.typeMsg;
  setText("authLangText", nextLang().toUpperCase());

  document.querySelectorAll("#langSeg button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-lang") === lang);
  });
  setSound(soundEnabled);
  applyAvailUI();
  applyPageTitle();
}

/* =========================
   Availability (Online/Offline) — client-enforced,
   tries a server sync but never blocks on it.
   ========================= */
function applyAvailUI() {
  const card = el("workCard");
  if (!card) return;
  const tr = t();
  card.classList.toggle("is-online", isOnline);
  card.classList.toggle("is-offline", !isOnline);
  el("availSwitch")?.classList.toggle("on", isOnline);
  el("availBtn")?.setAttribute("aria-pressed", isOnline ? "true" : "false");
  const label = el("availLabelText");
  if (label) label.textContent = isOnline ? tr.workOnlineTitle : tr.workOfflineTitle;
  const desc = el("workDesc");
  if (desc) desc.textContent = isOnline ? tr.workOnlineDesc : tr.workOfflineDesc;
  const btn = el("availBtnText");
  if (btn) btn.textContent = isOnline ? tr.stopWork : tr.startWork;
}

async function setOnline(next) {
  let want = !!next;
  if (window.SiymonDispatch) {
    // Real GPS + server availability state (see dispatch.js). On failure the
    // driver stays/returns to the previous state and sees why.
    const r = await window.SiymonDispatch.setOnline(want);
    if (!r.ok) {
      toast(r.message, "err");
      want = !want;
    }
  }
  isOnline = want;
  localStorage.setItem(ONLINE_KEY, isOnline ? "1" : "0");
  applyAvailUI();
  renderOrders();
  if (isOnline) {
    loadOrders(true).catch(() => {});
  }
}

/* =========================
   Connectivity banner (only when the network is really down)
   ========================= */
let netDown = false;
function setNetDown(down) {
  if (netDown === down) return;
  netDown = down;
  el("netBanner")?.classList.toggle("hidden", !down);
}

/* =========================
   File helpers (unchanged behavior)
   ========================= */
function _readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file, opts) {
  if (!file) return "";
  const o = opts || {};
  const maxDim = Number(o.maxDim || 0);
  const quality = Math.max(0.5, Math.min(0.95, Number(o.quality || 0.85)));
  const type = String(file.type || "");
  const isImg = type.startsWith("image/");
  if (!isImg) return await _readFileAsDataUrl(file);

  const needsResize = maxDim > 0;
  if (!needsResize && Number(file.size || 0) <= 1_500_000) {
    return await _readFileAsDataUrl(file);
  }

  const original = await _readFileAsDataUrl(file);
  const img = new Image();
  const loaded = await new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = original;
  });
  if (!loaded) return original;

  const w0 = img.naturalWidth || img.width || 0;
  const h0 = img.naturalHeight || img.height || 0;
  if (!w0 || !h0) return original;

  let w = w0,
    h = h0;
  if (maxDim > 0) {
    const m = Math.max(w0, h0);
    if (m > maxDim) {
      const s = maxDim / m;
      w = Math.max(1, Math.round(w0 * s));
      h = Math.max(1, Math.round(h0 * s));
    }
  }
  if (w === w0 && h === h0 && Number(file.size || 0) <= 1_500_000) return original;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch (_e) {
    return original;
  }
}

function setPreview(inputId, imgId) {
  const input = el(inputId);
  const img = el(imgId);
  if (!input || !img) return;
  const tile = input.closest(".upload-tile");
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) {
      img.style.display = "none";
      img.src = "";
      tile && tile.classList.remove("has-img");
      return;
    }
    const url = await fileToDataUrl(file).catch(() => "");
    if (url) {
      img.src = url;
      img.style.display = "block";
      tile && tile.classList.add("has-img");
    }
  });
}

/* =========================
   Auth screens
   ========================= */
function setActiveAuthTab(which) {
  const signup = which === "signup";
  el("tabSignup").classList.toggle("active", signup);
  el("tabLogin").classList.toggle("active", !signup);
  el("tabSignup").setAttribute("aria-selected", signup ? "true" : "false");
  el("tabLogin").setAttribute("aria-selected", signup ? "false" : "true");
  el("signupForm").style.display = signup ? "block" : "none";
  el("loginForm").style.display = signup ? "none" : "block";
}

function setLoggedInUI(isIn) {
  el("authScreen").style.display = isIn ? "none" : "block";
  el("dashScreen").style.display = isIn ? "block" : "none";
}

function setBtnBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.setAttribute("aria-busy", busy ? "true" : "false");
}

async function doLogin() {
  const tr = t();
  const ident = String(el("loginId").value || "").trim();
  const password = String(el("loginPassword").value || "");
  const email = ident.includes("@") ? ident : "";
  const phone = ident && !ident.includes("@") ? ident : "";
  if (!ident) {
    el("authHintLogin").textContent = tr.errNeedEmailPhone;
    return;
  }
  try {
    unlockAudio();
  } catch (_e) {}
  const btn = el("loginBtn");
  try {
    setBtnBusy(btn, true);
    el("authHintLogin").textContent = "";
    const res = await api("/api/driver/login", {
      method: "POST",
      body: JSON.stringify({ email, phone, password }),
    });
    await finishLogin(res);
  } catch (e) {
    el("authHintLogin").textContent = friendlyErr(e);
  } finally {
    setBtnBusy(btn, false);
  }
}

async function finishLogin(res) {
  token = res.token;
  localStorage.setItem(TOKEN_KEY, token);
  await onLoggedIn();
}

async function doSignup() {
  const tr = t();
  const btn = el("signupBtn");

  const email = String(el("signupEmail").value || "").trim();
  const phone = String(el("signupPhone").value || "").trim();
  const name = String(el("signupName")?.value || "").trim();
  const cardNumber = String(el("signupCardNumber").value || "").trim();
  const password = String(el("signupPassword").value || "");
  const password2 = String(el("signupPassword2").value || "");

  if (password2 !== password) {
    el("authHint").textContent = tr.errPwMismatch;
    return;
  }
  if (!name) {
    el("authHint").textContent = tr.enterName;
    return;
  }

  const faceFile = el("faceWithBikeCard").files && el("faceWithBikeCard").files[0];
  const frontFile = el("idFront").files && el("idFront").files[0];
  const backFile = el("idBack").files && el("idBack").files[0];
  const profileFile = el("profilePhoto")?.files && el("profilePhoto")?.files[0];
  const licenseFile = el("licenseImage")?.files && el("licenseImage").files[0];

  if (!faceFile || !frontFile || !backFile) {
    el("authHint").textContent = tr.imagesRequired;
    return;
  }

  try {
    setBtnBusy(btn, true);
    el("authHint").textContent = "";
    const [profilePhoto, faceWithBikeCard, idFront, idBack, licenseImage] = await Promise.all([
      fileToDataUrl(profileFile, { maxDim: 900, quality: 0.82 }),
      fileToDataUrl(faceFile, { maxDim: 1600, quality: 0.85 }),
      fileToDataUrl(frontFile, { maxDim: 1600, quality: 0.85 }),
      fileToDataUrl(backFile, { maxDim: 1600, quality: 0.85 }),
      fileToDataUrl(licenseFile, { maxDim: 1600, quality: 0.85 }),
    ]);

    const payload = {
      name,
      phone,
      cardNumber,
      password,
      password2,
      profilePhoto,
      faceWithBikeCard,
      idFront,
      idBack,
    };
    if (email) payload.email = email;
    if (licenseImage) payload.licenseImage = licenseImage;
    const vType = String(el("vehicleType")?.value || "");
    if (vType) {
      payload.vehicleType = vType;
      payload.vehiclePlate = String(el("vehiclePlate")?.value || "").trim();
      payload.vehicleModel = String(el("vehicleModel")?.value || "").trim();
    }

    const res = await api("/api/driver/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await finishLogin(res);
  } catch (e) {
    el("authHint").textContent = friendlyErr(e);
  } finally {
    setBtnBusy(btn, false);
  }
}

function logout() {
  try {
    if (window.SiymonDispatch && token) {
      api("/api/driver/status", { method: "PATCH", body: JSON.stringify({ status: "offline" }) }).catch(() => {});
    }
    window.SiymonDispatch && window.SiymonDispatch.stop();
  } catch (_e) {}
  // wipe the saved active delivery and the pending queue of this driver (nothing stays on a shared phone)
  window.SiymonOffline && window.SiymonOffline.reset();
  token = null;
  me = null;
  localStorage.removeItem(TOKEN_KEY);
  setLoggedInUI(false);
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  lastOrders = { mine: [], available: [] };
  lastStats = null;
  ordersState = "loading";
  firstOrdersLoad = true;
  seenMineIds = new Set();
  seenAvailIds = new Set();
  localNotifs = [];
  localUnread = 0;
  serverNotifs = [];
  serverUnread = 0;
  setActiveAuthTab("login");
  window.scrollTo(0, 0);
}

/* =========================
   Social sign-in (Google / Apple)
   The server verifies the provider token and only signs in an
   EXISTING driver account. Nothing here is trusted client-side;
   if a provider is not configured on the server the button says so.
   ========================= */
const social = { google: false, apple: false, googleClientId: "", appleClientId: "", appleRedirectUri: "", gsiReady: false, appleReady: false };

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
}

async function handleSocialLogin(path, idToken) {
  try {
    const res = await api(path, { method: "POST", body: JSON.stringify({ idToken }) });
    await finishLogin(res);
  } catch (e) {
    const msg = e && e.status ? friendlyErr(e) : t().socialFailed;
    el("authHintLogin").textContent = msg;
    toast(msg, "err");
  }
}

async function initSocialAuth() {
  let cfg = {};
  try {
    cfg = await loadPublicCfg();
  } catch (_e) {}
  social.google = !!(cfg.googleAuthEnabled && cfg.googleClientId);
  social.googleClientId = cfg.googleClientId || "";
  social.apple = !!(cfg.appleAuthEnabled && cfg.appleClientId && cfg.appleRedirectUri);
  social.appleClientId = cfg.appleClientId || "";
  social.appleRedirectUri = cfg.appleRedirectUri || "";

  const gBtn = el("googleBtn");
  const aBtn = el("appleBtn");
  gBtn?.setAttribute("aria-disabled", social.google ? "false" : "true");
  aBtn?.setAttribute("aria-disabled", social.apple ? "false" : "true");

  if (social.google) {
    try {
      await loadScriptOnce("https://accounts.google.com/gsi/client");
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: social.googleClientId,
          callback: (resp) => {
            if (resp && resp.credential) handleSocialLogin("/api/driver/google", resp.credential);
          },
        });
        const host = el("googleHost");
        const slot = host.parentElement;
        host.classList.remove("hidden");
        google.accounts.id.renderButton(host, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: Math.min(400, Math.max(160, slot.offsetWidth || 200)),
        });
        gBtn.classList.add("hidden");
        social.gsiReady = true;
      }
    } catch (_e) {
      /* script blocked/offline: the custom button stays and explains */
    }
  }
}

async function onGoogleClick() {
  if (!social.google) return toast(t().googleNotEnabled, "warn");
  if (!social.gsiReady) return toast(t().socialFailed, "err");
}

async function onAppleClick() {
  if (!social.apple) return toast(t().appleNotEnabled, "warn");
  try {
    if (!social.appleReady) {
      await loadScriptOnce("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
      window.AppleID.auth.init({
        clientId: social.appleClientId,
        scope: "name email",
        redirectURI: social.appleRedirectUri,
        usePopup: true,
      });
      social.appleReady = true;
    }
    const resp = await window.AppleID.auth.signIn();
    const idToken = resp && resp.authorization && resp.authorization.id_token;
    if (!idToken) throw new Error("no id_token");
    await handleSocialLogin("/api/driver/apple", idToken);
  } catch (e) {
    const code = e && (e.error || e.code);
    if (code === "popup_closed_by_user" || code === "user_cancelled_authorize") return;
    toast(t().socialFailed, "err");
  }
}

/* =========================
   Public config (currency, bank account, wallet mode)
   ========================= */
async function loadPublicCfg() {
  if (publicCfg) return publicCfg;
  const res = await fetch("/api/public-config").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!res) return {}; // do not cache a failed fetch; retry on next call
  publicCfg = res;
  CURRENCY = publicCfg.currency || "MAD";
  return publicCfg;
}

/* =========================
   Wallet math (unchanged logic from previous build)
   ========================= */
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function computeWalletChargeForOrder(order, cfg) {
  const enabled = cfg?.driverWalletEnabled !== false;
  if (!enabled) return 0;
  const mode = String(cfg?.driverWalletChargeMode || "subtotal").toLowerCase();
  if (mode === "commission") return Math.max(0, toNumber(cfg?.driverCommissionPerOrder));
  if (mode === "total") return Math.max(0, toNumber(order?.total));
  return Math.max(0, toNumber(order?.subtotal));
}
function computeReservedWallet(mineOrders, cfg) {
  const arr = Array.isArray(mineOrders) ? mineOrders : [];
  return arr
    .filter((o) => {
      const st = String(o?.status || "").toLowerCase();
      const done = ["delivered", "done", "canceled"].includes(st);
      const charged = !!(o?.walletChargedAt || o?.commissionChargedAt);
      return !done && !charged;
    })
    .reduce((sum, o) => sum + computeWalletChargeForOrder(o, cfg), 0);
}

/* =========================
   Navigation (bottom nav pages)
   ========================= */
const PAGES = ["home", "orders", "history", "wallet", "profile"];
const PAGE_TITLE_KEY = { orders: "navOrders", history: "navHistory", wallet: "navWallet", profile: "navProfile" };

function applyPageTitle() {
  const isHome = currentPage === "home";
  el("hdrHome")?.classList.toggle("hidden", !isHome);
  const title = el("pageTitle");
  if (title) {
    title.classList.toggle("hidden", isHome);
    if (!isHome) title.textContent = t()[PAGE_TITLE_KEY[currentPage]] || "";
  }
}

function setPage(page) {
  if (!PAGES.includes(page)) page = "home";
  currentPage = page;
  PAGES.forEach((p) => {
    const node = el("page" + p.charAt(0).toUpperCase() + p.slice(1));
    if (node) node.style.display = p === page ? "block" : "none";
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const on = btn.getAttribute("data-page") === page;
    btn.classList.toggle("active", on);
    if (on) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  applyPageTitle();
  if (page === "wallet") loadWallet().catch(() => {});
  if (page === "profile") {
    renderProfile();
    window.SiymonDriverExtras && window.SiymonDriverExtras.loadRatings();
  }
  if (page === "history") renderHistory();
  if (page === "orders" || page === "home") renderOrders();
  window.scrollTo(0, 0);
}

/* =========================
   Orders rendering
   ========================= */
const ACTIVE_STATUSES = ["new", "restaurant_ready", "accepted", "picked_up", "on_the_way"];
const CLOSED_STATUSES = ["delivered", "done", "canceled"];
const FLOW = ["accepted", "picked_up", "on_the_way", "delivered"];

function skeletonTickets(n) {
  return Array.from({ length: n })
    .map(() => `<div class="skeleton sk-ticket"></div>`)
    .join("");
}

function emptyState(iconName, text, actionHtml) {
  return `<div class="empty-state"><div class="e-ic">${icon(iconName)}</div><div class="t">${escapeHtml(text)}</div>${actionHtml || ""}</div>`;
}

function errorState() {
  const tr = t();
  return emptyState(
    "wifi-off",
    tr.loadFailed,
    `<button class="btn small" type="button" data-action="retry">${icon("refresh")}${escapeHtml(tr.retry)}</button>`,
  );
}

function nextStepFor(order) {
  const st = String(order?.status || "");
  const tr = t();
  if (st === "accepted") return { to: "picked_up", label: tr.nextPickedUp };
  if (st === "picked_up") return { to: "on_the_way", label: tr.nextOnTheWay };
  if (st === "on_the_way") return { to: "delivered", label: tr.nextDelivered };
  return null;
}

function stepsHtml(order) {
  const tr = t();
  const st0 = String(order.status || "");
  const st = st0 === "done" ? "delivered" : st0;
  const idx = FLOW.indexOf(st);
  const bars = FLOW.map((_, i) => `<i class="${idx >= 0 && i <= idx ? "done" : ""}"></i>`).join("");
  const right = idx >= 0 ? fmt(tr.stepOf, { a: idx + 1, b: FLOW.length }) : "";
  return `<div class="steps" role="img" aria-label="${escapeHtml(statusLabel(st))}">${bars}</div>
    <div class="steps-label"><span class="now">${escapeHtml(statusLabel(st))}</span><span>${escapeHtml(right)}</span></div>`;
}

/* Can the driver take this order, and if not, why (wallet) */
function acceptState(o) {
  const tr = t();
  const isMine = String(o.driverId || "") === String(me?.id || "");
  const base = !isMine && String(o.status || "") === "restaurant_ready" && !o.driverId;
  if (!base) return { canAccept: false, warn: "" };
  const cfg = publicCfg || { driverWalletEnabled: true, driverWalletChargeMode: "subtotal", driverCommissionPerOrder: 0 };
  const required = computeWalletChargeForOrder(o, cfg);
  const reserved = computeReservedWallet(lastOrders?.mine, cfg);
  const available = toNumber(me?.walletBalance) - reserved;
  if (required > available + 1e-9) return { canAccept: false, warn: tr.insufficientBalance };
  return { canAccept: true, warn: "" };
}

function itemsCount(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  return items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
}

function feeChip(o) {
  const fee = Number(o.driverEarning != null ? o.driverEarning : o.deliveryFee || 0);
  return fee > 0 ? `<span class="fee">${escapeHtml(t().feeLabel)} ${escapeHtml(money(fee))}</span>` : "";
}

function availableCardHtml(o) {
  const tr = t();
  const st = String(o.status || "restaurant_ready");
  const { canAccept, warn } = acceptState(o);
  const when = timeAgo(o.restaurantReadyAt || o.createdAt);
  const n = itemsCount(o);
  return `
  <article class="o-card" data-oid="${escapeHtml(o.id)}">
    <div class="o-head">
      <div>
        <div class="o-id">#${escapeHtml(o.id)}</div>
        <div class="o-sub">${escapeHtml(when)}</div>
      </div>
      <span class="status-chip st-${escapeHtml(st)}">${escapeHtml(statusLabel(st))}</span>
    </div>
    <div class="o-amount"><span class="money">${escapeHtml(money(o.total))}</span>${feeChip(o)}</div>
    <div class="o-line">${icon("pin")}<span class="addr">${escapeHtml(o.customer?.withheld ? (o.dropoffKm ? fmt(tr.dropoffKm, { n: o.dropoffKm }) : tr.addrAfterAccept) : o.customer?.addr || "—")}</span></div>
    ${n ? `<div class="o-line">${icon("receipt")}<span>${escapeHtml(fmt(tr.itemsCount, { n }))}</span></div>` : ""}
    ${warn ? `<div class="ticket-warn">${icon("alert")}<span>${escapeHtml(warn)}</span></div>` : ""}
    <div class="o-actions">
      <button class="btn ghost" type="button" data-action="detail" data-id="${escapeHtml(o.id)}">${escapeHtml(tr.orderDetails)}</button>
      ${
        canAccept
          ? `<button class="btn primary" type="button" data-action="accept" data-id="${escapeHtml(o.id)}">${icon("check")}${escapeHtml(tr.accept)}</button>`
          : warn
            ? `<button class="btn primary" type="button" data-action="goWallet">${icon("wallet")}${escapeHtml(tr.goToWallet)}</button>`
            : ""
      }
    </div>
  </article>`;
}

function mineCardHtml(o) {
  const tr = t();
  const st = String(o.status || "new");
  const next = nextStepFor(o);
  const id = escapeHtml(o.id);
  return `
  <article class="o-card" data-oid="${id}">
    <div class="o-head">
      <div>
        <div class="o-id">#${id}</div>
        <div class="o-sub">${escapeHtml(o.customer?.name || "")}</div>
      </div>
      <span class="status-chip st-${escapeHtml(st)}">${escapeHtml(statusLabel(st))}</span>
    </div>
    <div class="o-amount"><span class="money">${escapeHtml(money(o.total))}</span>${feeChip(o)}</div>
    ${stepsHtml(o)}
    <div class="o-line">${icon("pin")}<span class="addr">${escapeHtml(o.customer?.addr || "—")}</span></div>
    ${
      next && window.SiymonOffline && window.SiymonOffline.hasPending(id, "order_on_the_way")
        ? `<div class="o-actions"><div class="pending-badge" role="status">${escapeHtml(window.SiymonOffline.text().pendingBadge)}</div></div>`
        : next
        ? `<div class="o-actions"><button class="btn primary lg" type="button" data-action="advance" data-id="${id}" data-to="${next.to}">${icon("check")}${escapeHtml(next.label)}</button></div>`
        : ""
    }
    <div class="act-row">
      <button class="act" type="button" data-action="call" data-id="${id}">${icon("phone")}<span>${escapeHtml(tr.call)}</span></button>
      <button class="act" type="button" data-action="chat" data-id="${id}">${icon("chat")}<span>${escapeHtml(tr.chat)}</span></button>
      <button class="act" type="button" data-action="map" data-id="${id}">${icon("navigation")}<span>${escapeHtml(tr.openMaps)}</span></button>
      <button class="act" type="button" data-action="detail" data-id="${id}">${icon("receipt")}<span>${escapeHtml(tr.orderDetails)}</span></button>
    </div>
    ${
      ACTIVE_STATUSES.includes(st)
        ? `<button class="link-btn danger cancel-link" type="button" data-action="cancel" data-id="${id}">${escapeHtml(tr.cancelOrder)}</button>`
        : ""
    }
  </article>`;
}

function currentRowHtml(o) {
  const st = String(o.status || "new");
  const next = nextStepFor(o);
  return `
  <button class="cur-row" type="button" data-action="openOrders">
    <div class="cr-main">
      <div class="o-id">#${escapeHtml(o.id)} · <span class="money">${escapeHtml(money(o.total))}</span></div>
      <div class="o-sub">${escapeHtml(o.customer?.name || "")}</div>
      ${next ? `<div class="cr-next">${escapeHtml(next.label)}</div>` : ""}
    </div>
    <span class="status-chip st-${escapeHtml(st)}">${escapeHtml(statusLabel(st))}</span>
    ${icon("chevron", "chev flip")}
  </button>`;
}

function activeMine() {
  const mine = lastOrders.mine || [];
  return mine.filter(
    (o) =>
      ACTIVE_STATUSES.includes(String(o.status || "new")) ||
      (String(o.driverId || "") === String(me?.id || "") && !CLOSED_STATUSES.includes(String(o.status || ""))),
  );
}

function setCount(titleId, countId, key, n) {
  const node = el(titleId);
  if (!node) return;
  node.innerHTML = `${escapeHtml(t()[key])} (<span id="${countId}">${n}</span>)`;
}

function renderEarnings() {
  if (lastStats) {
    el("earnToday") && (el("earnToday").textContent = money(lastStats.earningsToday));
    el("earnWeek") && (el("earnWeek").textContent = money(lastStats.earningsWeek));
    el("earnMonth") && (el("earnMonth").textContent = money(lastStats.earningsMonth));
  } else {
    el("earnToday") && (el("earnToday").textContent = money(0));
    el("earnWeek") && (el("earnWeek").textContent = money(0));
    el("earnMonth") && (el("earnMonth").textContent = money(0));
  }
  const doneToday = (lastOrders.mine || []).filter(
    (o) => ["delivered", "done"].includes(String(o.status || "")) && withinDateFilter(o, "today"),
  ).length;
  el("earnDoneCount") && (el("earnDoneCount").textContent = String(doneToday));
}

function renderOrders() {
  const tr = t();
  const loading = ordersState === "loading";
  const failed = ordersState === "error";

  // Available (home) — hidden while offline
  const availWrap = el("availableList");
  const avail = isOnline ? lastOrders.available || [] : [];
  if (availWrap) {
    if (!isOnline) {
      availWrap.innerHTML = emptyState(
        "moon-offline",
        tr.offlineHint,
        `<button class="btn primary small" type="button" data-action="goOnline">${escapeHtml(tr.goOnline)}</button>`,
      );
    } else if (loading) {
      availWrap.innerHTML = skeletonTickets(2);
    } else if (failed) {
      availWrap.innerHTML = errorState();
    } else {
      availWrap.innerHTML = avail.length ? avail.map(availableCardHtml).join("") : emptyState("inbox", tr.noAvailable);
    }
  }
  setCount("availableTitle", "availCount", "availableTitle", avail.length);

  // Mine (orders page + compact list on Home)
  const mineActive = activeMine();
  const mineWrap = el("mineList");
  if (mineWrap) {
    if (loading) mineWrap.innerHTML = skeletonTickets(2);
    else if (failed) mineWrap.innerHTML = errorState();
    else mineWrap.innerHTML = mineActive.length ? mineActive.map(mineCardHtml).join("") : emptyState("package", tr.noOrders);
  }
  setCount("mineTitle", "mineCount", "mineTitle", mineActive.length);

  const homeBlock = el("homeCurrentBlock");
  if (homeBlock) {
    homeBlock.classList.toggle("hidden", mineActive.length === 0);
    el("homeCurrentList").innerHTML = mineActive.slice(0, 3).map(currentRowHtml).join("");
  }
  const navDot = el("navOrdersDot");
  if (navDot) navDot.classList.toggle("hidden", mineActive.length === 0);

  renderEarnings();
}

function renderAll() {
  renderOrders();
  renderHistory();
  if (me) renderProfile();
  renderWalletStatic();
  renderNotifList();
}

function findOrderById(id) {
  return (
    [...(lastOrders.mine || []), ...(lastOrders.available || [])].find((x) => String(x.id) === String(id)) || null
  );
}

/* =========================
   Order actions (accept / advance / cancel) — always behind
   a confirmation for the sensitive ones
   ========================= */
async function acceptOrder(id) {
  if (busyOrders.has(id)) return;
  busyOrders.add(id);
  try {
    await api(`/api/driver/orders/${encodeURIComponent(id)}/accept`, { method: "POST" });
    seenMineIds.add(String(id)); // my own accept must not ring as a "new order"
    toast(t().okSaved, "ok");
    closeOrderSheet();
    await loadOrders();
  } catch (e) {
    // Never claim an accept the server did not confirm. A lost response is re-checked after reconnecting.
    if (e && e.status === 0 && window.SiymonOffline) toast(window.SiymonOffline.text().acceptUnconfirmed, "warn");
    else toast(friendlyErr(e), "err");
  } finally {
    busyOrders.delete(id);
  }
}

function confirmAccept(id) {
  const tr = t();
  const order = findOrderById(id);
  askConfirm({
    title: tr.confirmAcceptTitle,
    message: fmt(tr.confirmAcceptMsg, { total: money(order?.total) }),
    okText: tr.accept,
    onConfirm: () => acceptOrder(id),
  });
}

async function patchOrderStatus(id, status, code) {
  if (busyOrders.has(id)) return;
  busyOrders.add(id);
  try {
    await api(`/api/driver/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(code ? { status, code } : { status }),
    });
    toast(t().okSaved, "ok");
    closeOrderSheet();
    await loadOrders();
  } catch (e) {
    const d = (e && e.data) || {};
    if (d.code === "CODE_INVALID") {
      toast(fmt(t().codeWrong, { n: d.attemptsLeft }), "err");
      busyOrders.delete(id);
      askCode(id, status);
      return;
    }
    if (e && e.status === 0 && window.SiymonOffline) {
      // Only "start delivery" may wait in the queue. Pickup/delivery verification, cancel, etc. are never
      // completed or claimed offline (the code is checked by the server; exceptions go through a supervisor).
      if (status === "on_the_way") {
        const q = window.SiymonOffline.queueOnTheWay(id);
        toast(q.message, q.ok ? "warn" : "err");
        closeOrderSheet();
        renderOrders();
      } else {
        toast(window.SiymonOffline.text().needOnline, "err");
      }
      return;
    }
    if (d.code === "CODE_LOCKED") toast(t().codeLocked, "err");
    else toast(friendlyErr(e), "err");
    await loadMe().catch(() => {});
  } finally {
    busyOrders.delete(id);
  }
}

/** Ask for the 6-digit pickup/delivery code. The server is the only verifier. */
function askCode(id, status) {
  const tr = t();
  const old = document.getElementById("codeModal");
  if (old) old.remove();
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop show";
  wrap.id = "codeModal";
  wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="codeTitle">
    <h3 id="codeTitle"></h3>
    <p></p>
    <input id="codeInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" dir="ltr" style="width:100%;font-size:28px;letter-spacing:8px;text-align:center;padding:10px;margin:8px 0;box-sizing:border-box">
    <div class="modal-actions">
      <button class="btn ghost" id="codeCancel" type="button"></button>
      <button class="btn primary" id="codeOk" type="button"></button>
    </div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#codeTitle").textContent = status === "picked_up" ? tr.codePickupTitle : tr.codeDeliveryTitle;
  wrap.querySelector("p").textContent = tr.codeHint;
  wrap.querySelector("#codeCancel").textContent = tr.back;
  wrap.querySelector("#codeOk").textContent = tr.confirm;
  const input = wrap.querySelector("#codeInput");
  const close = () => wrap.remove();
  input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); });
  wrap.querySelector("#codeCancel").onclick = close;
  const submit = () => {
    if (!/^\d{6}$/.test(input.value)) { toast(tr.codeHint, "err"); return; }
    const code = input.value;
    close();
    patchOrderStatus(id, status, code);
  };
  wrap.querySelector("#codeOk").onclick = submit;
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
  input.focus();
}

function advanceOrder(id, to) {
  const order = findOrderById(id);
  const next = nextStepFor(order);
  // only the next step of the flow is ever offered from the UI
  if (!next || next.to !== to) return;
  const vr = (order && order.verifyRequired) || {};
  if (to === "delivered") {
    const tr = t();
    askConfirm({
      title: tr.confirmDeliverTitle,
      message: tr.confirmDeliverMsg,
      okText: tr.nextDelivered,
      onConfirm: () => (vr.delivery ? askCode(id, "delivered") : patchOrderStatus(id, "delivered")),
    });
    return;
  }
  if (to === "picked_up" && vr.pickup) { askCode(id, "picked_up"); return; }
  patchOrderStatus(id, to);
}

function cancelOrder(id) {
  const tr = t();
  askConfirm({
    title: tr.confirmCancelTitle,
    message: tr.confirmCancelMsg,
    okText: tr.cancelOrder,
    cancelText: tr.keepOrder,
    danger: true,
    onConfirm: () => patchOrderStatus(id, "canceled"),
  });
}

function callCustomer(order) {
  const raw = String(order?.customer?.phone || "").trim();
  const phone = raw.replace(/[^\d+]/g, "");
  if (!phone) {
    toast(t().customerPhoneNA, "err");
    return;
  }
  try {
    const a = document.createElement("a");
    a.href = "tel:" + phone;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_e) {
    window.location.href = "tel:" + phone;
  }
}

function showRouteInfo(info) {
  const n = el("sheetMapInfo");
  if (!n || !info) return;
  const km = info.distance < 1000 ? `${Math.max(10, Math.round(info.distance / 10) * 10)} ${lang === "ar" ? "م" : "m"}` : `${(info.distance / 1000).toFixed(1)} ${lang === "ar" ? "كم" : "km"}`;
  const min = Math.max(1, Math.round(info.duration / 60));
  n.textContent = `${km} • ≈ ${min} ${lang === "ar" ? "د" : "min"}${info.fallback ? (lang === "ar" ? " (خط مستقيم)" : " (straight line)") : ""}`;
}

let sheetMapTimer = null;
function stopSheetMap() {
  clearInterval(sheetMapTimer);
  sheetMapTimer = null;
}
async function startSheetMap(order, next) {
  stopSheetMap();
  const box = el("sheetMap");
  if (!box || !window.SiyMap) return;
  if (!MAP_CFG) MAP_CFG = await window.SiyMap.loadConfig();
  if (!el("sheetMap")) return;
  const map = window.SiyMap.create(box, { height: 220, dark: true });
  window.SiymonDispatch?.ensureFix?.();
  const cust = customerCoords(order);
  const rest = restaurantCoords();
  const tr = t();
  const draw = () => {
    if (!el("sheetMap")) return stopSheetMap();
    const fix = window.SiymonDispatch?.lastFix?.();
    const items = [{ kind: "tri", lat: rest.lat, lng: rest.lng, title: tr.restMap }];
    if (cust) items.push({ kind: "pin", lat: cust.lat, lng: cust.lng, title: tr.custMap });
    if (fix) {
      // line to the next stop: restaurant until picked up, then the customer
      const target = ["picked_up", "on_the_way"].includes(String(order.status)) ? cust : rest;
      if (target) items.push({ kind: "route", key: "nav", from: fix, to: target, color: "#3fae1c", onInfo: showRouteInfo });
      items.push({ kind: "dot", lat: fix.lat, lng: fix.lng, r: 9, color: "#3fae1c", inner: true });
    }
    map.draw(items);
  };
  draw();
  sheetMapTimer = setInterval(draw, 4000);
}

// Programmatic <a target=_blank> click: far more reliable than window.open inside an installed PWA.
function openUrl(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function validLL(lat, lng) {
  lat = Number(lat);
  lng = Number(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// Delivery point: validated coordinates, else the exact-location link saved in the notes (older orders).
function customerCoords(order) {
  const c = (order && order.customer) || {};
  if (validLL(c.lat, c.lng)) return { lat: Number(c.lat), lng: Number(c.lng) };
  const m = String(c.notes || "").match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  return m && validLL(m[1], m[2]) ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

let MAP_CFG = null; // from /api/map-config (pickup point + tile url)
function restaurantCoords() {
  const p = MAP_CFG && MAP_CFG.pickup;
  if (p && validLL(p.lat, p.lng)) return { lat: Number(p.lat), lng: Number(p.lng) };
  return { lat: 33.2643604, lng: -7.5717029 }; // legacy default restaurant location
}

const NAV_TX = {
  ar: { title: "فتح الموقع في", google: "خرائط Google", waze: "Waze", copy: "نسخ الإحداثيات", copied: "تم نسخ الإحداثيات", close: "إغلاق" },
  en: { title: "Open location in", google: "Google Maps", waze: "Waze", copy: "Copy coordinates", copied: "Coordinates copied", close: "Close" },
  fr: { title: "Ouvrir la position dans", google: "Google Maps", waze: "Waze", copy: "Copier les coordonnées", copied: "Coordonnées copiées", close: "Fermer" },
};
function closeNavPop() {
  el("navPop")?.remove();
}
function showNavChooser(links, copyText) {
  closeNavPop();
  const tx = NAV_TX[lang] || NAV_TX.ar;
  const back = document.createElement("div");
  back.id = "navPop";
  back.className = "nav-backdrop";
  const card = document.createElement("div");
  card.className = "nav-card";
  const h = document.createElement("div");
  h.className = "nav-title";
  h.textContent = tx.title;
  card.appendChild(h);
  [["google", links.google], ["waze", links.waze]].forEach(([k, href]) => {
    const a = document.createElement("a");
    a.className = "nav-opt";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = tx[k];
    a.addEventListener("click", () => setTimeout(closeNavPop, 150));
    card.appendChild(a);
  });
  if (copyText) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "nav-opt";
    c.textContent = tx.copy;
    c.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyText);
        toast(tx.copied, "ok");
      } catch (_e) {
        window.prompt(tx.copy, copyText);
      }
      closeNavPop();
    });
    card.appendChild(c);
  }
  const x = document.createElement("button");
  x.type = "button";
  x.className = "nav-opt ghost";
  x.textContent = tx.close;
  x.addEventListener("click", closeNavPop);
  card.appendChild(x);
  back.appendChild(card);
  back.addEventListener("click", (e) => {
    if (e.target === back) closeNavPop();
  });
  document.body.appendChild(back);
}

// Same options as the Wajbatna driver app: Google Maps + Waze (+ copy as a last resort inside WebViews).
function openMaps(addr, lat, lng) {
  if (validLL(lat, lng)) {
    const la = Number(lat), ln = Number(lng);
    showNavChooser(
      {
        google: `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}&travelmode=driving`,
        waze: `https://waze.com/ul?ll=${la},${ln}&navigate=yes`,
      },
      `${la},${ln}`,
    );
    return;
  }
  if (addr && /^https?:\/\//.test(addr)) return openUrl(addr);
  const q = encodeURIComponent(addr || "");
  showNavChooser(
    { google: `https://www.google.com/maps/search/?api=1&query=${q}`, waze: `https://waze.com/ul?q=${q}&navigate=yes` },
    addr || "",
  );
}

/* One delegated handler for every data-action button in the app */
function onActionClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  const order = id ? findOrderById(id) : null;

  switch (action) {
    case "detail":
      return openOrderDetail(order);
    case "chat":
      return openOrderChat(String(id));
    case "call":
      return callCustomer(order);
    case "map":
      if (!order) return;
      const cc = customerCoords(order);
      return openMaps(order.customer?.addr || "", cc?.lat, cc?.lng);
    case "accept":
      return confirmAccept(id);
    case "advance":
      return advanceOrder(id, btn.getAttribute("data-to"));
    case "cancel":
      return cancelOrder(id);
    case "goWallet":
      closeOrderSheet();
      return setPage("wallet");
    case "goOnline":
      return setOnline(true);
    case "openOrders":
      return setPage("orders");
    case "retry":
      ordersState = "loading";
      renderOrders();
      return loadOrders();
    case "viewReceipt": {
      const url = btn.getAttribute("data-url");
      if (!url) return;
      // private receipt: fetch with the driver token, show from a blob
      return fetch(url, { headers: { "X-Driver-Token": token || "" } })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
        .then((b) => {
          const u = URL.createObjectURL(b);
          window.open(u, "_blank");
          setTimeout(() => URL.revokeObjectURL(u), 60000);
        })
        .catch((e) => toast(friendlyErr(e)));
    }
    default:
      return;
  }
}

/* =========================
   Order detail sheet + timeline
   ========================= */
function timelineHtml(order) {
  const tr = t();
  const st = String(order.status || "new");
  const steps = [
    { key: "accepted", label: tr.st_accepted },
    { key: "picked_up", label: tr.st_picked_up },
    { key: "on_the_way", label: tr.st_on_the_way },
    { key: "delivered", label: tr.st_delivered },
  ];
  const order_ = ["new", "admin_accepted", "restaurant_ready", "accepted", "picked_up", "on_the_way", "delivered", "done"];
  const curIdx = order_.indexOf(st === "done" ? "delivered" : st);

  return `<div class="timeline">${steps
    .map((s, i) => {
      const idx = order_.indexOf(s.key);
      const done = curIdx > idx || st === "delivered" || st === "done";
      const current = idx === curIdx && !done;
      const cls = done ? "done" : current ? "current" : "";
      const isLast = i === steps.length - 1;
      return `<div class="tl-step ${cls}">
        <div class="tl-dot-col"><div class="tl-dot"></div>${isLast ? "" : '<div class="tl-line"></div>'}</div>
        <div class="tl-content"><div class="lbl">${escapeHtml(s.label)}</div></div>
      </div>`;
    })
    .join("")}</div>`;
}

function openOrderDetail(order) {
  if (!order) return;
  const tr = t();
  const backdrop = el("orderSheetBackdrop");
  const body = el("orderSheetBody");
  if (!backdrop || !body) return;

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items
    .map(
      (it) =>
        `<div class="ticket-line"><span>${it.qty || 0}× ${escapeHtml(it.name || it.id || "")}</span><b class="money">${escapeHtml(money((it.qty || 0) * (it.price || 0)))}</b></div>`,
    )
    .join("");

  const isMine = String(order.driverId || "") === String(me?.id || "");
  const { canAccept } = acceptState(order);
  const next = isMine ? nextStepFor(order) : null;
  const closed = CLOSED_STATUSES.includes(String(order.status || ""));

  body.innerHTML = `
    <div class="card flat" style="margin-bottom:12px">
      <div class="o-head">
        <div><div class="o-id">#${escapeHtml(order.id)}</div><div class="o-sub">${escapeHtml(order.customer?.name || "")}</div></div>
        <span class="status-chip st-${escapeHtml(String(order.status || "new"))}">${escapeHtml(statusLabel(order.status))}</span>
      </div>
      <div class="o-line" style="margin-top:8px">${icon("pin")}<span class="addr">${escapeHtml(order.customer?.addr || "—")}</span></div>
      ${order.customer?.notes ? `<div class="o-line">${icon("info")}<span class="addr">${escapeHtml(order.customer.notes)}</span></div>` : ""}
    </div>

    <div class="sheet-section">${escapeHtml(tr.itemsLabel)}</div>
    <div class="card flat" style="margin-bottom:12px">
      ${itemsHtml || `<div class="muted">—</div>`}
      <hr class="ticket-divider" />
      <div class="ticket-line"><span class="muted">${escapeHtml(tr.subtotalLabel)}</span><b class="money">${escapeHtml(money(order.subtotal))}</b></div>
      <div class="ticket-line"><span class="muted">${escapeHtml(tr.feeLabel)}</span><b class="money">${escapeHtml(money(order.deliveryFee))}</b></div>
      <div class="ticket-line"><span>${escapeHtml(tr.totalLabel)}</span><b class="money">${escapeHtml(money(order.total))}</b></div>
    </div>

    ${
      order.status === "canceled"
        ? ""
        : `<div class="sheet-section">${escapeHtml(tr.status)}</div><div class="card flat" style="margin-bottom:12px">${timelineHtml(order)}</div>`
    }

    <div class="sheet-section">${escapeHtml(lang === "ar" ? "الخريطة" : lang === "fr" ? "Carte" : "Map")}</div>
    <div id="sheetMap" class="sheet-map"></div>
    <div id="sheetMapInfo" class="sheet-map-info muted"></div>

    <div class="act-row" style="grid-template-columns:repeat(2,1fr)">
      <button class="act" type="button" id="sheetRestMapBtn">${icon("store")}<span>${escapeHtml(tr.restMap)}</span></button>
      <button class="act" type="button" id="sheetCustMapBtn">${icon("pin")}<span>${escapeHtml(tr.custMap)}</span></button>
      ${isMine ? `<button class="act" type="button" id="sheetCallBtn">${icon("phone")}<span>${escapeHtml(tr.call)}</span></button>` : ""}
      ${isMine ? `<button class="act" type="button" id="sheetChatBtn">${Number(order.chatUnread) > 0 ? '<i class="unread-dot" aria-label="unread"></i>' : ""}${icon("chat")}<span>${escapeHtml(tr.chat)}</span></button>` : ""}
    </div>
    ${canAccept ? `<div class="o-actions"><button class="btn primary lg" type="button" id="sheetAcceptBtn">${icon("check")}${escapeHtml(tr.accept)}</button></div>` : ""}
    ${next && !closed ? `<div class="o-actions"><button class="btn primary lg" type="button" id="sheetNextBtn">${icon("check")}${escapeHtml(next.label)}</button></div>` : ""}
  `;

  el("sheetRestMapBtn")?.addEventListener("click", () => {
    const r = restaurantCoords();
    openMaps("", r.lat, r.lng);
  });
  el("sheetCustMapBtn")?.addEventListener("click", () => {
    const cc = customerCoords(order);
    openMaps(order.customer?.addr || "", cc?.lat, cc?.lng);
  });
  startSheetMap(order, next);
  el("sheetCallBtn")?.addEventListener("click", () => callCustomer(order));
  el("sheetChatBtn")?.addEventListener("click", () => {
    closeOrderSheet();
    openOrderChat(String(order.id));
  });
  el("sheetAcceptBtn")?.addEventListener("click", () => confirmAccept(order.id));
  el("sheetNextBtn")?.addEventListener("click", () => advanceOrder(order.id, next.to));

  backdrop.classList.add("show");
}
function closeOrderSheet() {
  stopSheetMap();
  el("orderSheetBackdrop")?.classList.remove("show");
}

/* =========================
   History (client-derived from "mine" — nothing is deleted,
   only separated in the UI)
   ========================= */
function withinDateFilter(order, filter) {
  if (filter === "all") return true;
  const ts = order.deliveredAt || order.canceledAt || order.updatedAt || order.createdAt;
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const todayStart = startOfDay(now);
  if (filter === "today") return d >= todayStart;
  if (filter === "yesterday") {
    const y0 = new Date(todayStart);
    y0.setDate(y0.getDate() - 1);
    return d >= y0 && d < todayStart;
  }
  if (filter === "week") {
    const w0 = new Date(todayStart);
    const dow = (w0.getDay() + 6) % 7;
    w0.setDate(w0.getDate() - dow);
    return d >= w0;
  }
  if (filter === "month") {
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= m0;
  }
  return true;
}

function renderHistory() {
  const tr = t();
  const mine = lastOrders.mine || [];
  const q = String(el("historySearch")?.value || "").trim().toLowerCase();

  // base = closed orders matching the date + search filters (stats ignore the status chip)
  const base = mine
    .filter((o) => CLOSED_STATUSES.includes(String(o.status || "")))
    .filter((o) => withinDateFilter(o, historyFilterDate))
    .filter(
      (o) =>
        !q ||
        String(o.id || "").toLowerCase().includes(q) ||
        String(o.customer?.name || "").toLowerCase().includes(q),
    );
  const deliveredList = base.filter((o) => ["delivered", "done"].includes(String(o.status || "")));
  const canceledList = base.filter((o) => String(o.status || "") === "canceled");
  el("histDelivered") && (el("histDelivered").textContent = String(deliveredList.length));
  el("histCanceled") && (el("histCanceled").textContent = String(canceledList.length));
  el("histEarn") && (el("histEarn").textContent = money(deliveredList.reduce((s, o) => s + Number(o.driverEarning != null ? o.driverEarning : o.deliveryFee || 0), 0)));

  let list = base;
  if (historyFilterStatus === "delivered") list = deliveredList;
  else if (historyFilterStatus === "canceled") list = canceledList;

  list = list.slice().sort((a, b) => {
    const ta = new Date(a.deliveredAt || a.canceledAt || a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.deliveredAt || b.canceledAt || b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  const wrap = el("historyList");
  const moreBtn = el("historyMoreBtn");
  if (!wrap) return;

  if (ordersState === "loading") {
    wrap.innerHTML = skeletonTickets(2);
    moreBtn?.classList.add("hidden");
    return;
  }
  if (ordersState === "error" && !mine.length) {
    wrap.innerHTML = errorState();
    moreBtn?.classList.add("hidden");
    return;
  }
  if (list.length === 0) {
    wrap.innerHTML = emptyState("clock", tr.noHistory);
    moreBtn?.classList.add("hidden");
    return;
  }

  const visible = list.slice(0, historyShown);
  wrap.innerHTML = visible
    .map((o) => {
      const st = String(o.status || "");
      const bad = st === "canceled";
      const d = new Date(o.deliveredAt || o.canceledAt || o.updatedAt || o.createdAt || "");
      const dateStr = isNaN(d.getTime()) ? "" : d.toLocaleString(lang === "ar" ? "ar-MA" : lang, { dateStyle: "medium", timeStyle: "short" });
      return `
      <button class="h-row" type="button" data-action="detail" data-id="${escapeHtml(o.id)}">
        <span class="h-ic ${bad ? "bad" : ""}">${icon(bad ? "x" : "check")}</span>
        <span class="h-main">
          <span class="t" style="display:block">#${escapeHtml(o.id)} · ${escapeHtml(o.customer?.name || "")}</span>
          <span class="s" style="display:block">${escapeHtml(dateStr)}</span>
        </span>
        <span class="h-end"><span class="money">${escapeHtml(money(o.total))}</span><span class="status-chip st-${escapeHtml(st)}">${escapeHtml(statusLabel(st))}</span></span>
      </button>`;
    })
    .join("");

  moreBtn?.classList.toggle("hidden", list.length <= historyShown);
}

/* =========================
   Wallet
   ========================= */
let lastWallet = { history: [], topups: [] };

function walletEnabled() {
  return (publicCfg || {}).driverWalletEnabled !== false;
}

function renderTopupsList(topups) {
  const tr = t();
  const wrap = el("driverTopupsList");
  if (!wrap) return;
  const list = Array.isArray(topups) ? topups : [];
  if (!list.length) {
    wrap.innerHTML = emptyState("receipt", tr.noTopups);
    return;
  }
  wrap.innerHTML = list
    .map((tpu) => {
      const st = String(tpu.status || "pending").toLowerCase();
      const d = tpu.createdAt ? new Date(tpu.createdAt) : null;
      const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleString(lang === "ar" ? "ar-MA" : lang, { dateStyle: "medium", timeStyle: "short" }) : "";
      const view = tpu.hasReceipt || tpu.receiptUrl
        ? `<button class="mini-link" type="button" data-action="viewReceipt" data-url="/api/driver/topups/${encodeURIComponent(tpu.id)}/receipt">${escapeHtml(tr.view)}</button>`
        : "";
      const meta = [tpu.reference ? "Ref: " + tpu.reference : "", st === "rejected" || st === "failed" ? tpu.decisionNote || "" : ""].filter(Boolean).join(" · ");
      return `<div class="tx-row">
        <span class="tx-ic in">${icon("receipt")}</span>
        <span class="tx-main"><span class="t" style="display:block">${escapeHtml(money(tpu.amount))}</span><span class="s" style="display:block">${escapeHtml(dateStr)}</span><span class="s" style="display:block;direction:auto">${escapeHtml(meta)}</span></span>
        <span class="tx-end"><span class="status-badge ${escapeHtml(st)}">${escapeHtml(tr["tp_" + st] || st)}</span>${view}</span>
      </div>`;
    })
    .join("");
}

function renderWalletHistory(history) {
  const tr = t();
  const wrap = el("walletHistoryList");
  if (!wrap) return;
  const list = (Array.isArray(history) ? history : [])
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (!list.length) {
    wrap.innerHTML = emptyState("wallet", tr.noTx);
    return;
  }
  wrap.innerHTML = list
    .map((h) => {
      const amt = Number(h.amount || 0);
      const credit = amt >= 0;
      const label = h.type === "topup" ? tr.txTopup : h.type === "order_deduct" ? tr.txOrderDeduct : tr.txOther;
      const d = h.createdAt ? new Date(h.createdAt) : null;
      const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleString(lang === "ar" ? "ar-MA" : lang, { dateStyle: "medium", timeStyle: "short" }) : "";
      const sub = [h.orderId ? "#" + h.orderId : "", dateStr].filter(Boolean).join(" · ");
      return `<div class="tx-row">
        <span class="tx-ic ${credit ? "in" : "out"}">${icon(credit ? "arrow-down" : "arrow-up")}</span>
        <span class="tx-main"><span class="t" style="display:block">${escapeHtml(label)}</span><span class="s" style="display:block">${escapeHtml(sub)}</span></span>
        <span class="tx-amt money ${credit ? "in" : "out"}">${credit ? "+" : "−"}${escapeHtml(money(Math.abs(amt)))}</span>
      </div>`;
    })
    .join("");
}

function renderWalletStatic() {
  renderTopupsList(lastWallet.topups);
  renderWalletHistory(lastWallet.history);
  const cfg = publicCfg || {};
  const enabled = walletEnabled();
  el("topupBlock")?.classList.toggle("hidden", !enabled);
  const bank = [cfg.bankAccountName, cfg.bankAccount].filter(Boolean).join("\n");
  el("bankAccountValue") && (el("bankAccountValue").textContent = bank || t().notSet);
  updateWalletNumbers();
}

function updateWalletNumbers() {
  const cfg = publicCfg || {};
  const reserved = computeReservedWallet(lastOrders?.mine, cfg);
  const balance = toNumber(me?.walletBalance);
  el("walletBalance") && (el("walletBalance").textContent = money(balance));
  el("walletAvailable") && (el("walletAvailable").textContent = money(balance - reserved));
  el("walletReserved") && (el("walletReserved").textContent = money(reserved));
}

async function loadWallet() {
  if (!token) return;
  await loadPublicCfg().catch(() => ({}));
  try {
    const res = await api("/api/driver/wallet");
    if (me) me.walletBalance = res.walletBalance;
    lastWallet = { history: res.walletHistory || [], topups: res.topups || [] };
    renderWalletStatic();
    loadTopupMethods().catch(() => {});
  } catch (e) {
    toast(friendlyErr(e), "err");
  }
}

let topupMethods = [];
let topupSending = false;
const TP_TXT = {
  ar: { method: "طريقة الدفع", ref: "مرجع التحويل", pick: "اختر طريقة", refNeeded: "أدخل مرجع التحويل", methodNeeded: "اختر طريقة الدفع", min: "الحد الأدنى", max: "الحد الأقصى", holder: "المستفيد", bank: "البنك/الخدمة", branch: "الوكالة", pendingNote: "طلبك قيد المراجعة؛ لن يُضاف الرصيد إلا بعد تأكيد المشرف." },
  fr: { method: "Mode de paiement", ref: "Référence du virement", pick: "Choisir", refNeeded: "Saisissez la référence", methodNeeded: "Choisissez un mode", min: "Minimum", max: "Maximum", holder: "Bénéficiaire", bank: "Banque/Service", branch: "Agence", pendingNote: "Demande en cours de vérification; le solde n'est crédité qu'après confirmation." },
  en: { method: "Payment method", ref: "Transfer reference", pick: "Select", refNeeded: "Enter the transfer reference", methodNeeded: "Choose a payment method", min: "Min", max: "Max", holder: "Beneficiary", bank: "Bank/Service", branch: "Branch", pendingNote: "Your request is under review; the balance is credited only after confirmation." },
};
const tpt = () => TP_TXT[lang] || TP_TXT.en;

function selectedTopupMethod() {
  const id = el("topupMethod")?.value;
  return topupMethods.find((m) => m.id === id) || null;
}

function renderTopupMethodInfo() {
  const m = selectedTopupMethod();
  const info = el("topupMethodInfo");
  const qr = el("topupQr");
  if (!info) return;
  if (!m) {
    info.textContent = "";
    qr?.classList.add("hidden");
    return;
  }
  const x = tpt();
  const a = m.account || {};
  const L = lang === "fr" || lang === "en" ? lang : "ar";
  const rows = [
    a.holderName && `${x.holder}: ${a.holderName}`,
    a.bankName && `${x.bank}: ${a.bankName}`,
    a.rib && `RIB: ${a.rib}`,
    a.iban && `IBAN: ${a.iban}`,
    a.accountNumber && `N°: ${a.accountNumber}`,
    a.paymentIdentifier && `ID: ${a.paymentIdentifier}`,
    a.branch && `${x.branch}: ${a.branch}`,
    a.referenceFormat && `${x.ref}: ${a.referenceFormat}`,
    a.instructions && (a.instructions[L] || a.instructions.ar || ""),
    m.minAmount != null && `${x.min}: ${m.minAmount}`,
    m.maxAmount != null && `${x.max}: ${m.maxAmount}`,
    m.statusMessage && (m.statusMessage[L] || m.statusMessage.ar || ""),
    x.pendingNote,
  ].filter(Boolean);
  info.textContent = rows.join("\n");
  if (qr) {
    if (m.qrImage) {
      qr.src = m.qrImage;
      qr.classList.remove("hidden");
    } else qr.classList.add("hidden");
  }
}

async function loadTopupMethods() {
  const sel = el("topupMethod");
  topupMethods = [];
  try {
    const r = await api("/api/payment-methods?context=driverTopup");
    topupMethods = (r.methods || []).filter((m) => m.kind === "transfer" && m.available && m.account);
  } catch (_e) {}
  const has = topupMethods.length > 0;
  el("topupMethodField")?.classList.toggle("hidden", !has);
  el("topupRefField")?.classList.toggle("hidden", !has);
  el("bankAccountLabel")?.parentElement?.classList.toggle("hidden", has); // legacy single account only when no configured method
  if (!sel) return;
  const L = lang === "fr" || lang === "en" ? lang : "ar";
  sel.innerHTML = `<option value="">${escapeHtml(tpt().pick)}</option>` + topupMethods.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml((m.name && (m.name[L] || m.name.ar)) || m.id)}</option>`).join("");
  el("topupMethodLabel") && (el("topupMethodLabel").textContent = tpt().method);
  el("topupRefLabel") && (el("topupRefLabel").textContent = tpt().ref);
  renderTopupMethodInfo();
}

async function sendTopup() {
  if (topupSending) return; // no duplicate submissions
  const tr = t();
  const hint = el("topupHint");
  const btn = el("topupSendBtn");
  if (hint) hint.textContent = "";
  const amount = Number(el("topupAmount")?.value || 0);
  const file = el("topupReceipt")?.files?.[0];
  const method = selectedTopupMethod();
  const useMethods = topupMethods.length > 0;
  if (!amount || amount <= 0) {
    if (hint) hint.textContent = tr.amountInvalid;
    return;
  }
  if (useMethods && !method) {
    if (hint) hint.textContent = tpt().methodNeeded;
    return;
  }
  const reference = (el("topupRef")?.value || "").trim();
  if (useMethods && reference.replace(/[^A-Za-z0-9]/g, "").length < 4) {
    if (hint) hint.textContent = tpt().refNeeded;
    return;
  }
  if ((!useMethods || (method && method.requireReceipt)) && !file) {
    if (hint) hint.textContent = tr.receiptNeeded;
    return;
  }
  try {
    topupSending = true;
    setBtnBusy(btn, true);
    const receipt = file ? await fileToDataUrl(file) : undefined;
    const body = useMethods ? { amount, receipt, methodId: method.id, reference } : { amount, receipt };
    await api("/api/driver/topups", { method: "POST", body: JSON.stringify(body) });
    toast(tr.okSaved, "ok");
    el("topupAmount").value = "";
    el("topupReceipt").value = "";
    if (el("topupRef")) el("topupRef").value = "";
    el("topupReceiptLabel") && (el("topupReceiptLabel").textContent = tr.attachReceipt);
    await loadWallet().catch(() => {});
  } catch (e) {
    if (hint) hint.textContent = friendlyErr(e);
  } finally {
    topupSending = false;
    setBtnBusy(btn, false);
  }
}

/* =========================
   Profile
   ========================= */
function accountStatusLabel(st) {
  const s = String(st || "").toLowerCase();
  if (lang === "ar") return s === "approved" ? "مقبول" : s === "rejected" ? "مرفوض" : "قيد المراجعة";
  if (lang === "fr") return s === "approved" ? "Validé" : s === "rejected" ? "Refusé" : "En attente";
  return s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending";
}

function renderProfile() {
  if (!me) return;
  const tr = t();

  const photoUrl = me.profilePhotoUrl ? String(me.profilePhotoUrl) : "";
  const img = el("driverProfileImg");
  if (img) {
    img.src = photoUrl ? photoUrl + (photoUrl.includes("?") ? "&" : "?") + "v=" + Date.now() : "/icons/icon-192.png";
    img.onclick = photoUrl ? () => openImageViewer(photoUrl) : null;
    img.style.cursor = photoUrl ? "pointer" : "default";
  }
  const topImg = el("topAvatarImg");
  if (topImg) topImg.src = photoUrl || "/icons/icon-192.png";

  el("driverProfileName") && (el("driverProfileName").textContent = me.name || "—");
  el("driverProfileContact") &&
    (el("driverProfileContact").textContent = [me.phone, me.email].filter(Boolean).join(" • "));

  const statusEl = el("driverProfileStatus");
  if (statusEl) {
    const s = String(me.status || "pending").toLowerCase();
    statusEl.textContent = accountStatusLabel(s);
    statusEl.classList.remove("ok", "warn", "bad");
    statusEl.classList.add(s === "approved" ? "ok" : s === "rejected" ? "bad" : "warn");
  }
  el("driverProfileWalletTag") &&
    (el("driverProfileWalletTag").textContent = tr.walletBalanceLabel + ": " + money(me.walletBalance));

  el("profileEmail") && (el("profileEmail").textContent = me.email || "—");
  el("profilePhone") && (el("profilePhone").textContent = me.phone || "—");
  el("profileCard") && (el("profileCard").textContent = me.cardNumber || "—");
  try {
    const d = me.createdAt ? new Date(me.createdAt) : null;
    el("profileCreated") &&
      (el("profileCreated").textContent = d && !isNaN(d.getTime()) ? d.toLocaleDateString(lang === "ar" ? "ar-MA" : lang) : me.createdAt || "—");
  } catch (_e) {
    el("profileCreated") && (el("profileCreated").textContent = me.createdAt || "—");
  }

  el("dashName") && (el("dashName").textContent = me.name || "—");
  const sw = el("soundSwitch");
  if (sw) sw.setAttribute("aria-checked", soundEnabled ? "true" : "false");
}

function openSupport() {
  const cfg = publicCfg || {};
  const wa = String(cfg.adminWhatsappNumber || "").replace(/[^\d]/g, "");
  const phone = String(cfg.supportPhone || "").replace(/[^\d+]/g, "");
  if (wa) return void window.open("https://wa.me/" + wa, "_blank");
  if (phone) {
    window.location.href = "tel:" + phone;
    return;
  }
  toast(t().supportNone, "warn");
}

function openImageViewer(url) {
  el("imgViewerImg").src = url;
  el("imgViewer").classList.add("show");
}
function closeImageViewer() {
  el("imgViewer").classList.remove("show");
  el("imgViewerImg").src = "";
}

/* =========================
   Confirm modal (in-app dialog, replaces window.confirm)
   ========================= */
function askConfirm({ title, message, onConfirm, okText, cancelText, danger }) {
  const tr = t();
  el("confirmTitle").textContent = title;
  el("confirmMsg").textContent = message;
  const okBtn = el("confirmOkBtn");
  const cancelBtn = el("confirmCancelBtn");
  okBtn.textContent = okText || tr.confirm;
  cancelBtn.textContent = cancelText || tr.back;
  okBtn.classList.toggle("bad", !!danger);
  okBtn.classList.toggle("primary", !danger);
  el("confirmModal").classList.add("show");
  const cleanup = () => {
    el("confirmModal").classList.remove("show");
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };
  okBtn.onclick = () => {
    cleanup();
    onConfirm();
  };
  cancelBtn.onclick = cleanup;
  cancelBtn.focus();
}

/* =========================
   Notifications
   - events the app really observed (new / assigned orders) this session
   - plus anything the server returns from /api/driver/notifications (if present)
   ========================= */
function pushLocalNotif(title, message) {
  localNotifs.unshift({ title, message, ts: Date.now() });
  if (localNotifs.length > 30) localNotifs.length = 30;
  localUnread += 1;
  updateNotifBadge();
  renderNotifList();
}

function updateNotifBadge() {
  const badge = el("notifBadge");
  if (!badge) return;
  const n = localUnread + serverUnread;
  badge.classList.toggle("hidden", n <= 0);
  badge.textContent = String(n > 99 ? "99+" : n);
}

function renderNotifList() {
  const list = el("notifList");
  if (!list) return;
  const items = [
    ...localNotifs.map((n) => ({ title: n.title, message: n.message + (n.ts ? " · " + timeAgo(n.ts) : "") })),
    ...serverNotifs.map((n) => ({ title: n.title || "", message: n.message || "" })),
  ];
  list.innerHTML = items.length
    ? items
        .map(
          (n) => `<div class="notif-item"><span class="ni">${icon("bell")}</span><div>
            <div class="nt">${escapeHtml(n.title)}</div><div class="nm">${escapeHtml(n.message)}</div></div></div>`,
        )
        .join("")
    : emptyState("bell-off", t().noNotifications);
}

async function loadNotifications() {
  try {
    const res = await api("/api/driver/notifications");
    serverNotifs = Array.isArray(res.notifications) ? res.notifications : [];
    serverUnread = Number(res.unreadCount || 0);
  } catch (_e) {
    serverNotifs = [];
    serverUnread = 0;
  }
  updateNotifBadge();
  renderNotifList();
}

function openNotifSheet() {
  renderNotifList();
  el("notifSheetBackdrop").classList.add("show");
  localUnread = 0;
  updateNotifBadge();
  loadNotifications().catch(() => {});
}

/* =========================
   Order chat (unchanged API contract)
   ========================= */
let CHAT_ORDER_ID = null;
let CHAT_POLL = null;

function showOrderChat(show) {
  const m = el("orderChatModal");
  if (!m) return;
  m.classList.toggle("show", !!show);
  if (!show) {
    CHAT_ORDER_ID = null;
    if (CHAT_POLL) clearInterval(CHAT_POLL);
    CHAT_POLL = null;
  }
}
function fmtChatTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function chatBubbleInner(m) {
  // Backward compatible: messages without "type" are plain text (old builds)
  const type = String(m.type || "text");
  if (type === "image" && m.url) {
    return `<div class="chat-img-bubble" data-url="${escapeHtml(m.url)}"><img src="${escapeHtml(m.url)}" loading="lazy" alt="" /></div>`;
  }
  if (type === "audio" && m.url) {
    return `<div class="chat-audio-bubble" data-url="${escapeHtml(m.url)}" data-dur="${escapeHtml(String(m.duration || 0))}">
      <button class="chat-audio-play" type="button" aria-label="Play">${icon("play")}</button>
      <span class="chat-audio-time">${escapeHtml(fmtDuration(m.duration))}</span>
    </div>`;
  }
  return `<div class="chat-bubble">${escapeHtml(m.text || "")}</div>`;
}

function renderOrderChat(messages) {
  const tr = t();
  const box = el("orderChatBox");
  if (!box) return;
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) {
    box.innerHTML = emptyState("chat", tr.noMessagesYet);
    window.SiymonOffline && window.SiymonOffline.decorateChat(CHAT_ORDER_ID);
    return;
  }
  box.innerHTML = list
    .map((m) => {
      const mine = String(m.from || "") === "driver";
      const who = mine ? tr.you : tr.customer;
      return `<div class="chat-msg ${mine ? "me" : ""}">
        ${chatBubbleInner(m)}
        <div class="chat-meta">${escapeHtml(who)} • ${escapeHtml(fmtChatTime(m.createdAt))}</div>
      </div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight + 9999;
  window.SiymonOffline && window.SiymonOffline.decorateChat(CHAT_ORDER_ID); // pending (unconfirmed) messages

  // Wire up media playback / viewing (delegated fresh each render — list is small)
  box.querySelectorAll(".chat-img-bubble").forEach((node) => {
    node.onclick = () => openImageViewer(node.getAttribute("data-url"));
  });
  box.querySelectorAll(".chat-audio-bubble").forEach((node) => {
    const btn = node.querySelector(".chat-audio-play");
    const timeEl = node.querySelector(".chat-audio-time");
    const url = node.getAttribute("data-url");
    const dur = Number(node.getAttribute("data-dur") || 0);
    let audioObj = null;
    btn.onclick = () => {
      if (!audioObj) audioObj = new Audio(url);
      if (audioObj.paused) {
        // pause any other playing bubble
        document.querySelectorAll(".chat-audio-play").forEach((b) => {
          if (b !== btn) b.innerHTML = icon("play");
        });
        audioObj.play().catch(() => toast(t().sendFailed, "err"));
        btn.innerHTML = icon("pause");
        audioObj.ontimeupdate = () => {
          timeEl.textContent = fmtDuration(audioObj.currentTime);
        };
        audioObj.onended = () => {
          btn.innerHTML = icon("play");
          timeEl.textContent = fmtDuration(dur);
        };
      } else {
        audioObj.pause();
        btn.innerHTML = icon("play");
      }
    };
  });
}
async function loadOrderChat() {
  if (!CHAT_ORDER_ID) return;
  const res = await api(`/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat`);
  const order = findOrderById(CHAT_ORDER_ID);
  el("orderChatTitle") && (el("orderChatTitle").textContent = order?.customer?.name || t().orderChatTitlePrefix);
  el("orderChatSub") && (el("orderChatSub").textContent = "#" + CHAT_ORDER_ID);
  renderOrderChat(res.messages || []);
  // closed after delivery/cancel: read-only
  el("chatInputRow")?.classList.toggle("hidden", !!res.closed);
  const ch = el("orderChatHint");
  if (ch && res.closed) ch.textContent = t().chatClosed || "";
}
async function sendOrderChat() {
  if (!CHAT_ORDER_ID) return;
  const input = el("orderChatInput");
  const hint = el("orderChatHint");
  const text = String(input?.value || "").trim();
  if (!text) return;
  if (input) input.value = "";
  if (hint) hint.textContent = "";
  // One idempotency key per message: a retry/replay can never create a second copy on the server.
  const clientId = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  try {
    await api(`/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat`, {
      method: "POST",
      body: JSON.stringify({ text, clientId }),
    });
    await loadOrderChat();
  } catch (e) {
    if (e && e.status === 0 && window.SiymonOffline) {
      // no answer from the server: keep it as PENDING (not sent), it goes out when the connection is back
      const q = window.SiymonOffline.queueChat(CHAT_ORDER_ID, text, clientId);
      if (hint) hint.textContent = q.message;
      return;
    }
    if (String(e && e.message) === "chat_closed") {
      loadOrderChat().catch(() => {});
      return;
    }
    if (hint) hint.textContent = friendlyErr(e);
  }
}
/* =========================
   Chat attachments: image + voice notes
   ========================= */
let pendingChatImageDataUrl = null;
let mediaRec = {
  recorder: null,
  chunks: [],
  stream: null,
  startTs: 0,
  timerInt: null,
  blob: null,
  objectUrl: null,
  previewAudio: null,
  mimeType: "",
};

function micSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

function openAttachSheet() {
  el("chatAttachSheet")?.classList.add("show");
}
function closeAttachSheet() {
  el("chatAttachSheet")?.classList.remove("show");
}

/* ---- Image ---- */
function showImagePreviewBar(dataUrl) {
  pendingChatImageDataUrl = dataUrl;
  el("chatImagePreviewImg").src = dataUrl;
  el("chatImagePreviewBar").classList.remove("hidden");
  el("chatInputRow").classList.add("hidden");
}
function hideImagePreviewBar() {
  pendingChatImageDataUrl = null;
  el("chatImagePreviewImg").src = "";
  el("chatImagePreviewBar").classList.add("hidden");
  el("chatInputRow").classList.remove("hidden");
  const input = el("chatImageFile");
  if (input) input.value = "";
}
async function onChatImagePicked(file) {
  if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file, { maxDim: 1600, quality: 0.8 });
    showImagePreviewBar(dataUrl);
  } catch (_e) {
    toast(t().sendFailed, "err");
  }
}
async function sendChatImageMessage() {
  if (!pendingChatImageDataUrl || !CHAT_ORDER_ID) return;
  const dataUrl = pendingChatImageDataUrl;
  hideImagePreviewBar();
  try {
    await api(`/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat/image`, {
      method: "POST",
      body: JSON.stringify({ image: dataUrl }),
    });
    await loadOrderChat();
  } catch (e) {
    toast(friendlyErr(e), "err");
  }
}

/* ---- Voice ---- */
function showRecordBar() {
  el("chatRecordBar").classList.remove("hidden");
  el("chatInputRow").classList.add("hidden");
}
function hideRecordBar() {
  el("chatRecordBar").classList.add("hidden");
  el("chatInputRow").classList.remove("hidden");
}
function resetRecordUI() {
  el("recTimer").textContent = "00:00";
  el("recStatusText").textContent = "";
  el("recDot").style.display = "inline-block";
  el("recStopBtn").classList.remove("hidden");
  el("recPlayBtn").classList.add("hidden");
  el("recSendBtn").classList.add("hidden");
  el("recDeleteBtn").classList.add("hidden");
}

async function startRecording() {
  if (!micSupported()) {
    toast(t().micNotSupported, "err");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec.stream = stream;
    mediaRec.chunks = [];
    const mimeCandidates = ["audio/webm", "audio/ogg", "audio/mp4"];
    mediaRec.mimeType = mimeCandidates.find((m) => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(m)) || "";
    mediaRec.recorder = mediaRec.mimeType
      ? new MediaRecorder(stream, { mimeType: mediaRec.mimeType })
      : new MediaRecorder(stream);

    mediaRec.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) mediaRec.chunks.push(e.data);
    };
    mediaRec.recorder.onstop = () => {
      const blob = new Blob(mediaRec.chunks, { type: mediaRec.recorder.mimeType || mediaRec.mimeType || "audio/webm" });
      mediaRec.blob = blob;
      mediaRec.objectUrl = URL.createObjectURL(blob);
      try {
        stream.getTracks().forEach((tr) => tr.stop());
      } catch (_e) {}
    };

    resetRecordUI();
    showRecordBar();
    el("recStatusText").textContent = t().recStatusRecording;
    mediaRec.startTs = Date.now();
    mediaRec.recorder.start();

    mediaRec.timerInt = setInterval(() => {
      const sec = Math.floor((Date.now() - mediaRec.startTs) / 1000);
      el("recTimer").textContent = fmtDuration(sec);
    }, 250);
  } catch (_e) {
    toast(t().micPermissionDenied, "err");
  }
}

function stopRecording() {
  if (mediaRec.recorder && mediaRec.recorder.state !== "inactive") {
    mediaRec.recorder.stop();
  }
  if (mediaRec.timerInt) clearInterval(mediaRec.timerInt);
  el("recDot").style.display = "none";
  el("recStatusText").textContent = t().recStatusReady;
  el("recStopBtn").classList.add("hidden");
  el("recPlayBtn").classList.remove("hidden");
  el("recSendBtn").classList.remove("hidden");
  el("recDeleteBtn").classList.remove("hidden");
}

function playRecordedPreview() {
  if (!mediaRec.objectUrl) return;
  if (!mediaRec.previewAudio) mediaRec.previewAudio = new Audio(mediaRec.objectUrl);
  if (mediaRec.previewAudio.paused) {
    mediaRec.previewAudio.play().catch(() => {});
    el("recPlayBtn").innerHTML = icon("pause");
    mediaRec.previewAudio.onended = () => {
      el("recPlayBtn").innerHTML = icon("play");
    };
  } else {
    mediaRec.previewAudio.pause();
    el("recPlayBtn").innerHTML = icon("play");
  }
}

function cancelRecording() {
  try {
    if (mediaRec.recorder && mediaRec.recorder.state !== "inactive") mediaRec.recorder.stop();
    if (mediaRec.stream) mediaRec.stream.getTracks().forEach((tr) => tr.stop());
  } catch (_e) {}
  if (mediaRec.timerInt) clearInterval(mediaRec.timerInt);
  if (mediaRec.previewAudio) {
    try {
      mediaRec.previewAudio.pause();
    } catch (_e) {}
  }
  mediaRec = { recorder: null, chunks: [], stream: null, startTs: 0, timerInt: null, blob: null, objectUrl: null, previewAudio: null, mimeType: "" };
  hideRecordBar();
}

async function sendRecordedAudio() {
  if (!mediaRec.blob || !CHAT_ORDER_ID) return;
  const durationSec = Math.round((Date.now() - mediaRec.startTs) / 1000);
  const blob = mediaRec.blob;
  hideRecordBar();
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    await api(`/api/driver/orders/${encodeURIComponent(CHAT_ORDER_ID)}/chat/audio`, {
      method: "POST",
      body: JSON.stringify({ audio: dataUrl, duration: durationSec }),
    });
    await loadOrderChat();
  } catch (e) {
    toast(friendlyErr(e), "err");
  } finally {
    mediaRec = { recorder: null, chunks: [], stream: null, startTs: 0, timerInt: null, blob: null, objectUrl: null, previewAudio: null, mimeType: "" };
  }
}

function openOrderChat(orderId) {
  CHAT_ORDER_ID = String(orderId || "");
  showOrderChat(true);
  loadOrderChat().catch((e) => {
    const hint = el("orderChatHint");
    if (hint) hint.textContent = friendlyErr(e);
  });
  if (CHAT_POLL) clearInterval(CHAT_POLL);
  CHAT_POLL = setInterval(() => {
    if (CHAT_ORDER_ID) loadOrderChat().catch(() => {});
  }, 3500);
}

/* =========================
   Core data loading
   ========================= */
async function loadMe() {
  if (!token) return null;
  try {
    const res = await api("/api/driver/me");
    me = res.driver;
    window.SiymonOffline && window.SiymonOffline.saveMe(me);
    return me;
  } catch (e) {
    // Offline (no answer from the server): keep the session and use the last known profile, never a logout.
    const cached = e && e.status === 0 && window.SiymonOffline && window.SiymonOffline.loadMe();
    if (cached) { me = cached; return me; }
    throw e;
  }
}

async function loadOrders(isPoll = false) {
  const tr = t();
  try {
    const res = await api("/api/driver/orders");
    setNetDown(false);
    const available = Array.isArray(res.available) ? res.available : [];
    const mine = Array.isArray(res.mine) ? res.mine : [];
    lastStats = res.stats || null;

    if (firstOrdersLoad) {
      seenMineIds = new Set(mine.map((o) => String(o.id)));
      seenAvailIds = new Set(available.map((o) => String(o.id)));
      firstOrdersLoad = false;
    } else {
      const newMine = mine.filter((o) => !seenMineIds.has(String(o.id)));
      const newAvail = isOnline
        ? available.filter((o) => !seenAvailIds.has(String(o.id)) && String(o.status || "") === "restaurant_ready")
        : [];
      if (newMine.length + newAvail.length > 0) {
        playRingtone();
        toast(tr.newOrder, "warn");
        newAvail.forEach((o) => pushLocalNotif(tr.newOrderNotif, `#${o.id} · ${money(o.total)}`));
        newMine.forEach((o) => pushLocalNotif(tr.assignedNotif, `#${o.id} · ${money(o.total)}`));
      }
      seenMineIds = new Set(mine.map((o) => String(o.id)));
      seenAvailIds = new Set(available.map((o) => String(o.id)));
    }

    lastOrders = { mine, available: isOnline ? available : [] };
    ordersState = "ok";
    window.SiymonOffline && window.SiymonOffline.saveSnapshot(mine); // active delivery survives a network drop

    if (currentPage === "wallet") await loadWallet().catch(() => {});
    updateWalletNumbers();
    renderOrders();
    renderHistory();
  } catch (e) {
    if (e.status === 401) {
      logout();
      return;
    }
    if (e.status === 403) {
      el("pendingBox").classList.remove("hidden");
      ordersState = "ok";
      renderOrders();
      return;
    }
    if (e.status === 0) {
      setNetDown(true);
      // Offline: show the last saved ACTIVE delivery (clearly labelled), never invented data.
      const snap = window.SiymonOffline && window.SiymonOffline.loadSnapshot();
      if (snap && snap.mine && snap.mine.length && !(lastOrders.mine || []).length) {
        lastOrders = { mine: snap.mine, available: [] };
        ordersState = "ok";
        renderOrders();
        if (!isPoll) toast(window.SiymonOffline.text().snapshot, "warn");
        return;
      }
    }
    if (ordersState === "loading") {
      ordersState = "error";
      renderOrders();
      renderHistory();
    }
    if (!isPoll) toast(friendlyErr(e), "err");
  }
}

async function refreshStatus() {
  try {
    await loadMe();
    if (String(me?.status || "pending") !== "approved") {
      el("pendingBox").classList.remove("hidden");
      toast(t().notApproved, "warn");
      return;
    }
    el("pendingBox").classList.add("hidden");
    await loadOrders();
  } catch (e) {
    toast(friendlyErr(e), "err");
  }
}

async function onLoggedIn() {
  setLoggedInUI(true);
  ordersState = "loading";
  renderOrders();
  await loadMe();
  if (window.SiymonOffline) { window.SiymonOffline.adopt(); window.SiymonOffline.flush(); }
  try {
    await loadPublicCfg();
  } catch (_e) {}
  try {
    const w = await api("/api/driver/wallet");
    if (me) me.walletBalance = w.walletBalance;
    lastWallet = { history: w.walletHistory || [], topups: w.topups || [] };
  } catch (_e) {}

  renderProfile();
  renderWalletStatic();
  applyAvailUI();
  if (isOnline && window.SiymonDispatch) {
    // resume tracking after reload; drop to offline if GPS can't be restored
    window.SiymonDispatch.setOnline(true).then((r) => {
      if (r.ok) return;
      isOnline = false;
      localStorage.setItem(ONLINE_KEY, "0");
      applyAvailUI();
      renderOrders();
      toast(r.message, "err");
    });
  }

  el("pendingBox").classList.toggle("hidden", String(me?.status || "pending") === "approved");

  setPage("home");
  if (soundEnabled && !audioUnlocked && !autoplayAllowed()) showSoundGate();
  await loadOrders();
  loadNotifications().catch(() => {});

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!token) return;
    try {
      const res = await api("/api/driver/me");
      me = res.driver;
      el("pendingBox").classList.toggle("hidden", String(me?.status) === "approved");
    } catch (_e) {}
    loadOrders(true);
  }, 3500);
}

/* =========================
   Event bindings
   ========================= */
function closeTopOverlay() {
  const order = [
    ["confirmModal", "show"],
    ["chatAttachSheet", "show"],
    ["imgViewer", "show"],
    ["orderSheetBackdrop", "show"],
    ["notifSheetBackdrop", "show"],
    ["accountSheetBackdrop", "show"],
  ];
  for (const [id, cls] of order) {
    const node = el(id);
    if (node && node.classList.contains(cls)) {
      node.classList.remove(cls);
      return true;
    }
  }
  return false;
}

function bindEvents() {
  // --- auth
  el("authLangBtn")?.addEventListener("click", () => setLang(nextLang()));
  el("tabLogin").addEventListener("click", () => setActiveAuthTab("login"));
  el("tabSignup").addEventListener("click", () => setActiveAuthTab("signup"));
  el("goSignupBtn")?.addEventListener("click", () => setActiveAuthTab("signup"));
  el("goLoginBtn")?.addEventListener("click", () => setActiveAuthTab("login"));
  el("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin();
  });
  el("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doSignup();
  });
  document.querySelectorAll("[data-eye]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = el(btn.getAttribute("data-eye"));
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = icon(show ? "eye-off" : "eye");
    });
  });
  el("googleBtn")?.addEventListener("click", onGoogleClick);
  el("appleBtn")?.addEventListener("click", onAppleClick);

  // --- settings
  el("soundSwitch")?.addEventListener("click", () => setSound(!soundEnabled, true));
  el("soundGateBtn")?.addEventListener("click", () => {
    markSoundPrompted();
    setSound(true, true);
    playRingtone();
    hideSoundGate();
  });
  el("darkSwitch")?.addEventListener("click", () => setTheme(theme === "dark" ? "light" : "dark"));
  document.querySelectorAll("#langSeg button").forEach((b) => {
    b.addEventListener("click", () => setLang(b.getAttribute("data-lang")));
  });

  // --- dashboard
  el("refreshOrdersBtn")?.addEventListener("click", () => loadOrders());
  el("refreshStatusBtn")?.addEventListener("click", refreshStatus);
  el("availBtn")?.addEventListener("click", () => setOnline(!isOnline));
  el("homeSeeAllBtn")?.addEventListener("click", () => setPage("orders"));

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => setPage(btn.getAttribute("data-page")));
  });
  el("topAvatarBtn")?.addEventListener("click", () => setPage("profile"));

  // sheets
  el("notifBtn")?.addEventListener("click", openNotifSheet);
  el("rowNotifications")?.addEventListener("click", openNotifSheet);
  el("notifSheetClose")?.addEventListener("click", () => el("notifSheetBackdrop").classList.remove("show"));
  el("orderSheetClose")?.addEventListener("click", closeOrderSheet);
  el("rowAccountInfo")?.addEventListener("click", () => el("accountSheetBackdrop").classList.add("show"));
  el("accountSheetClose")?.addEventListener("click", () => el("accountSheetBackdrop").classList.remove("show"));
  el("rowSupport")?.addEventListener("click", openSupport);
  ["orderSheetBackdrop", "notifSheetBackdrop", "accountSheetBackdrop"].forEach((id) => {
    el(id)?.addEventListener("click", (e) => {
      if (e.target === el(id)) el(id).classList.remove("show");
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTopOverlay();
  });

  // every data-action button (order cards, history rows, receipts…)
  document.addEventListener("click", onActionClick);

  // wallet
  el("walletRefreshBtn")?.addEventListener("click", () => loadWallet().catch(() => {}));
  el("topupSendBtn")?.addEventListener("click", () => sendTopup());
  el("topupMethod")?.addEventListener("change", renderTopupMethodInfo);
  loadTopupMethods().catch(() => {});
  el("topupReceipt")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    el("topupReceiptLabel").textContent = f ? `${t().receiptAttached}: ${f.name}` : t().attachReceipt;
  });

  // history
  el("historySearch")?.addEventListener("input", () => {
    historyShown = historyPageSize;
    renderHistory();
  });
  document.querySelectorAll("[data-hfilter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      historyFilterStatus = btn.getAttribute("data-hfilter");
      historyShown = historyPageSize;
      document.querySelectorAll("[data-hfilter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderHistory();
    });
  });
  document.querySelectorAll("[data-hdate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      historyFilterDate = btn.getAttribute("data-hdate");
      historyShown = historyPageSize;
      document.querySelectorAll("[data-hdate]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderHistory();
    });
  });
  el("historyMoreBtn")?.addEventListener("click", () => {
    historyShown += historyPageSize;
    renderHistory();
  });

  // profile
  el("profileLogoutBtn")?.addEventListener("click", () => {
    askConfirm({
      title: t().confirmLogoutTitle,
      message: t().confirmLogoutMsg,
      okText: t().logout,
      onConfirm: logout,
    });
  });
  el("profileDeleteBtn")?.addEventListener("click", () => {
    askConfirm({
      title: t().confirmDeleteTitle,
      message: t().confirmDeleteMsg,
      okText: t().deleteAccount,
      danger: true,
      onConfirm: async () => {
        try {
          await api("/api/driver/me", { method: "DELETE" });
          toast(t().accountDeleted, "ok");
          logout();
        } catch (e) {
          toast(friendlyErr(e), "err");
        }
      },
    });
  });

  // --- chat
  el("closeOrderChatBtn")?.addEventListener("click", () => {
    cancelRecording();
    hideImagePreviewBar();
    showOrderChat(false);
  });
  el("chatAttachBtn")?.addEventListener("click", openAttachSheet);
  el("chatAttachSheet")?.addEventListener("click", (e) => {
    if (e.target === el("chatAttachSheet")) closeAttachSheet();
  });
  el("attachImageBtn")?.addEventListener("click", () => {
    closeAttachSheet();
    el("chatImageFile")?.click();
  });
  el("chatImageFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onChatImagePicked(file);
  });
  el("chatImageCancelBtn")?.addEventListener("click", hideImagePreviewBar);
  el("chatImageSendBtn")?.addEventListener("click", () => sendChatImageMessage());
  el("attachVoiceBtn")?.addEventListener("click", () => {
    closeAttachSheet();
    startRecording();
  });
  el("chatMicBtn")?.addEventListener("click", () => {
    if (!micSupported()) {
      toast(t().micNotSupported, "err");
      return;
    }
    startRecording();
  });
  el("recStopBtn")?.addEventListener("click", stopRecording);
  el("recPlayBtn")?.addEventListener("click", playRecordedPreview);
  el("recDeleteBtn")?.addEventListener("click", cancelRecording);
  el("recSendBtn")?.addEventListener("click", () => sendRecordedAudio());
  el("orderChatSendBtn")?.addEventListener("click", () => sendOrderChat().catch(() => {}));
  el("orderChatInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendOrderChat().catch(() => {});
    }
  });
  el("orderChatCallBtn")?.addEventListener("click", () => {
    const order = findOrderById(CHAT_ORDER_ID);
    if (order) callCustomer(order);
  });

  el("imgViewerClose")?.addEventListener("click", closeImageViewer);
  el("imgViewer")?.addEventListener("click", (e) => {
    if (e.target === el("imgViewer")) closeImageViewer();
  });

  setPreview("profilePhoto", "prevProfile");
  setPreview("faceWithBikeCard", "prevFace");
  setPreview("idFront", "prevFront");
  setPreview("idBack", "prevBack");
  setPreview("licenseImage", "prevLicense");

  if (!micSupported()) {
    el("chatMicBtn")?.classList.add("hidden");
    el("attachVoiceBtn")?.classList.add("hidden");
  }

  // connectivity
  window.addEventListener("offline", () => setNetDown(true));
  window.addEventListener("online", () => {
    // the browser flag is only a hint: SiymonOffline probes the server, flushes the queue in order, then reloads
    if (window.SiymonOffline) window.SiymonOffline.probe();
    else {
      setNetDown(false);
      if (token) loadOrders(true).catch(() => {});
    }
  });
}

/* =========================
   Init
   ========================= */
(async function init() {
  applyTheme();
  bindEvents();
  applyI18n();
  applyAvailUI();
  if (!navigator.onLine) setNetDown(true);

  document.addEventListener("pointerdown", unlockAudio, { once: true, passive: true, capture: true });
  document.addEventListener("touchstart", unlockAudio, { once: true, passive: true, capture: true });
  document.addEventListener("keydown", unlockAudio, { once: true, passive: true, capture: true });

  if (!token) {
    setLoggedInUI(false);
    setActiveAuthTab("login");
    initSocialAuth().catch(() => {});
    return;
  }

  try {
    await onLoggedIn();
  } catch (_e) {
    if (_e && _e.status === 0) {
      // Opened with no connection and no saved profile: do NOT destroy the session. The login screen shows,
      // the token stays, and the page reloads by itself as soon as the server is reachable again.
      setLoggedInUI(false);
      setActiveAuthTab("login");
      toast(t().networkError, "err");
      return;
    }
    logout();
    setActiveAuthTab("login");
    initSocialAuth().catch(() => {});
  }
})();


/* =========================
   PWA: keep service worker fresh (unchanged behavior)
   ========================= */
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
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              try {
                reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" });
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
