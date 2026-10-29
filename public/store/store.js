/* Unified store dashboard (all business types). Vanilla JS, no deps.
 * Security: every permission is enforced by the server; the UI only hides
 * what the server would refuse. All server data is inserted with textContent
 * (never innerHTML) so names/messages can't inject markup. */
(function () {
  "use strict";

  const TOKEN_KEY = "siymon_store_token";
  const STORE_KEY = "siymon_store_id";
  const LIST_KEY = "siymon_store_list";
  const LANG_KEY = "siymon_lang_v1";
  const THEME_KEY = "siymon_store_theme";

  /* ------------------------------ i18n ------------------------------ */
  const I18N = {
    ar: {
      feedback: "التقييمات والشكاوى", fb_rating: "تقييم متجرك", fb_count: "تقييم", fb_reviews: "آراء الزبائن المنشورة", fb_noReviews: "لا توجد آراء منشورة بعد. تُنشر التعليقات بعد مراجعة المشرف.", fb_complaints: "الشكاوى", fb_none: "لا توجد شكاوى.", fb_answer: "ردّك", fb_send: "إرسال الرد", fb_answerHint: "اكتب ردّك للزبون (حلّ أو اعتذار أو توضيح)", fb_sent: "تم إرسال ردّك", fb_tl: "المتابعة", fb_deadline: "الرد قبل", fb_closed: "مغلقة", fb_back: "رجوع",
      fb_st_with_party: "تنتظر ردّك", fb_st_party_responded: "تم ردّك", fb_st_escalated: "عند المشرف", fb_st_in_review: "قيد المراجعة", fb_st_resolved: "مغلقة",
      fb_cat_food_quality: "جودة الطعام", fb_cat_missing_items: "أصناف ناقصة", fb_cat_wrong_order: "طلب خاطئ", fb_cat_late_delivery: "تأخر التوصيل", fb_cat_driver_behavior: "سلوك السائق", fb_cat_extra_charge: "مبلغ إضافي", fb_cat_payment: "الدفع", fb_cat_other: "أخرى",
      fb_who_customer: "الزبون", fb_who_store: "المتجر", fb_who_driver: "السائق", fb_who_supervisor: "الدعم", fb_who_system: "النظام",
      title: "لوحة المتجر", login: "تسجيل الدخول", identifier: "البريد أو الهاتف", password: "كلمة المرور",
      loginHint: "ادخل بحساب المتجر الخاص بك", chooseStore: "اختر المتجر", logout: "تسجيل الخروج",
      dashboard: "لوحة المعلومات", orders_new: "الطلبات الجديدة", orders: "جميع الطلبات", products: "المنتجات",
      categories: "الفئات والتصنيفات", pricing: "الأسعار والعروض", inventory: "المخزون والكميات",
      customers: "العملاء", chat: "الرسائل والمحادثات", notifications: "الإشعارات", reports: "تقارير المبيعات",
      settings: "إعدادات المتجر", hours: "ساعات العمل والتوفر", delivery: "معلومات التوصيل", help: "المساعدة والدعم",
      loading: "جارٍ التحميل…", retry: "إعادة المحاولة", save: "حفظ", cancel: "إلغاء", close: "إغلاق", saved: "تم الحفظ",
      confirm: "تأكيد", back: "رجوع", search: "بحث…", all: "الكل", refresh: "تحديث", edit: "تعديل", add: "إضافة",
      days: "أيام", day: "يوم", period: "الفترة", currency: "درهم",
      s_newOrders: "طلبات جديدة", s_preparing: "قيد التحضير", s_completed: "طلبات مكتملة", s_canceled: "طلبات ملغاة",
      s_ordersValue: "قيمة الطلبات", s_sales: "المبيعات الفعلية", s_unavailable: "منتجات غير متوفرة",
      s_low: "مخزون منخفض", s_customers: "العملاء", s_unread: "رسائل غير مقروءة", s_products: "عدد المنتجات",
      stmtTitle: "كشف الحساب", stmtGoods: "قيمة البضاعة", stmtCommission: "عمولة المنصة", stmtNet: "صافي مستحقاتك",
      stmtOrders: "طلبات مسلّمة", stmtSettled: "ما تم تسويته", stmtBalance: "الرصيد المستحق لك", stmtAllTime: "منذ البداية",
      stmtRange: "ضمن الفترة", stmtLegacy: "طلبات قديمة بلا لقطة مالية (محسوبة بدون عمولة):", stmtNote: "الأرقام محسوبة من الطلبات المسلّمة فقط، والتسويات تسجّلها الإدارة.",
      valueVsSales: "«قيمة الطلبات» تشمل كل الطلبات غير الملغاة، أما «المبيعات الفعلية» فتشمل الطلبات المسلّمة فقط.",
      emptyDash: "لا توجد بيانات بعد", emptyDashHint: "أضف منتجاتك الأولى لتبدأ باستقبال الطلبات.",
      addFirst: "إضافة منتج",
      st_new: "جديد", st_preparing: "قيد التحضير", st_ready: "جاهز", st_on_delivery: "في التوصيل", st_done: "منجز", st_canceled: "ملغى",
      noOrders: "لا توجد طلبات", order: "طلب", total: "الإجمالي", subtotal: "المجموع الفرعي", deliveryFee: "رسوم التوصيل", pickupCode: "كود الاستلام (أعطه للسائق)",
      customer: "العميل", phone: "الهاتف", address: "العنوان", notes: "ملاحظات", payment: "الدفع", items: "المنتجات", qty: "الكمية", price: "السعر",
      accept: "قبول وبدء التحضير", ready: "جاهز للتسليم", reject: "رفض الطلب", reason: "سبب الرفض", reasonReq: "اكتب سبب الرفض (3 أحرف على الأقل)",
      print: "طباعة", printTicket: "طباعة التذكرة", paper: "ورق الطباعة", openChat: "محادثة العميل", from: "من", to: "إلى",
      confirmReady: "تأكيد: الطلب جاهز وسيُرسل للتوصيل؟", confirmAccept: "قبول الطلب وبدء التحضير؟", confirmReject: "رفض هذا الطلب؟",
      name: "الاسم", nameAr: "الاسم بالعربية", nameFr: "الاسم بالفرنسية", desc: "الوصف", category: "الفئة", salePrice: "سعر التخفيض",
      stock: "المخزون", stockHint: "اتركه فارغاً إن لم يتطلب مخزوناً", available: "متوفر", unavailable: "غير متوفر", archived: "مؤرشف",
      image: "صورة المنتج", imageHint: "", uploadImage: "رفع صورة", changeImage: "تغيير الصورة", removeImage: "إزالة", uploading: "جارٍ رفع الصورة…", imageFail: "تعذّر رفع الصورة (JPG / PNG / WebP)", newProduct: "منتج جديد", editProduct: "تعديل المنتج",
      archive: "أرشفة", restore: "استرجاع", del: "حذف نهائي", confirmArchive: "أرشفة هذا المنتج؟ يمكن استرجاعه لاحقاً.",
      confirmDelete: "حذف المنتج نهائياً؟ لا يمكن التراجع.", noProducts: "لا توجد منتجات", lowStock: "مخزون منخفض",
      typeFields: "خصائص حسب نوع النشاط", yes: "نعم", no: "لا", rxNote: "المنتجات التي تتطلب وصفة لا تُباع عبر الطلب الإلكتروني.",
      renameCat: "تعديل اسم الفئة", catId: "معرّف الفئة", catLabel: "اسم الفئة", products_n: "منتج",
      ordersN: "طلبات", spent: "المشتريات", lastOrder: "آخر طلب", noCustomers: "لا يوجد عملاء بعد", noChats: "لا توجد محادثات بعد",
      send: "إرسال", typeMsg: "اكتب رسالة…", you: "أنت", chatOrder: "طلب",
      notifEmpty: "لا توجد تنبيهات الآن", n_new: "طلبات جديدة تنتظرك", n_unread: "رسائل جديدة من العملاء", n_low: "منتجات بمخزون منخفض", n_unavail: "منتجات غير متوفرة",
      pause: "إيقاف الاستقبال مؤقتاً", resume: "استئناف الاستقبال", paused: "المتجر متوقف مؤقتاً", open: "المتجر يستقبل الطلبات",
      closed: "مغلق", open_t: "يفتح", close_t: "يغلق", minOrder: "الحد الأدنى للطلب", freeOver: "توصيل مجاني فوق", avgMin: "متوسط زمن التوصيل (دقيقة)",
      hoursHint: "اتركه دون تحديد ليبقى المتجر مفتوحاً دائماً.", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة", sat: "السبت", sun: "الأحد",
      helpText: "للمساعدة تواصل مع إدارة المنصة. لا تشارك كلمة مرورك مع أحد. لإضافة موظفين أو متاجر اطلب ذلك من المشرف.",
      supportLink: "فتح صفحة الدعم", err_unauth: "انتهت الجلسة، سجّل الدخول من جديد", err_forbidden: "لا تملك صلاحية لهذا الإجراء",
      err_generic: "حدث خطأ، حاول مرة أخرى", err_login: "بيانات الدخول غير صحيحة", err_disabled: "الحساب أو المتجر موقوف",
      err_controlled_not_allowed: "لا يُسمح بإدراج هذا الدواء المقيّد على المنصة", err_sale: "سعر التخفيض يجب أن يكون أقل من السعر",
      members: "فريق العمل", memAdd: "إضافة موظف", memEmail: "البريد الإلكتروني", memPhone: "الهاتف", memPass: "كلمة المرور (8 أحرف على الأقل)",
      memRole: "الدور", memDisable: "تعطيل", memEnable: "تفعيل", memReset: "كلمة مرور جديدة", memInactive: "معطّل", memNone: "لا يوجد موظفون بعد", memNeedContact: "أدخل بريداً أو هاتفاً", memNote: "المدير: منتجات وطلبات وتقارير. الكاشير: الطلبات والمحادثات فقط. لا يمكنك تعديل المالكين أو حسابك هنا.",
      sp_channels: "وسائل التواصل مع الإدارة", sp_noChannels: "لم تُضف الإدارة وسائل تواصل بعد. يمكنك فتح تذكرة أدناه.", sp_tickets: "تذاكري", sp_new: "تذكرة جديدة",
      sp_subject: "الموضوع", sp_category: "التصنيف", sp_message: "رسالتك", sp_send: "إرسال", sp_none: "لا توجد تذاكر بعد", sp_close: "إغلاق التذكرة", sp_closed: "مغلقة", sp_open: "بانتظار الرد", sp_answered: "تم الرد",
      sp_you: "أنت", sp_admin: "الإدارة", sp_sent: "تم إرسال التذكرة", sp_closedNote: "هذه التذكرة مغلقة. افتح تذكرة جديدة إذا احتجت مساعدة.", sp_typeMsg: "اكتب ردّك…", sp_hours: "ساعات العمل",
      sp_tooMany: "لديك تذاكر مفتوحة كثيرة، انتظر الرد أو أغلق بعضها", sp_needSubject: "اكتب موضوعاً من 3 أحرف على الأقل ونص الرسالة", sp_back: "كل التذاكر",
      sp_cat_orders: "الطلبات", sp_cat_products: "المنتجات", sp_cat_payments: "المدفوعات", sp_cat_technical: "مشكلة تقنية", sp_cat_account: "الحساب", sp_cat_other: "أخرى", sp_kind_phone: "اتصال", sp_kind_whatsapp: "واتساب", sp_kind_email: "بريد", sp_kind_telegram: "تيليغرام",
      pharmacy: "طلبات الأدوية", phNew: "جديدة", phQuoted: "بانتظار الزبون", phAccepted: "مقبولة", phClosed: "مغلقة", phAll: "الكل", phNone: "لا توجد طلبات أدوية",
      phText: "الدواء المطلوب", phRx: "صورة الوصفة الطبية", phRxMissing: "لا توجد وصفة", phLoadingRx: "جارٍ تحميل الوصفة…",
      phAvail: "متوفر", phUnavail: "غير متوفر", phName: "اسم الدواء", phQty: "الكمية", phPrice: "السعر", phLineNote: "ملاحظة", phAddLine: "إضافة دواء",
      phReason: "سبب عدم التوفر", phValid: "مدة صلاحية العرض (دقيقة)", phTotal: "مجموع الأدوية", phSend: "إرسال الرد للزبون", phSent: "تم إرسال الرد",
      phNoteToCustomer: "ملاحظة للزبون (اختياري)", phCustomer: "الزبون", phAddr: "العنوان", phOpenChat: "محادثة الزبون", phCurrent: "العرض الحالي", phExpires: "ينتهي",
      ph_pending: "بانتظار ردّك", ph_quoted: "بانتظار موافقة الزبون", ph_unavailable: "غير متوفر", ph_accepted: "قبل الزبون العرض", ph_declined: "رفضه الزبون", ph_canceled: "ألغاه الزبون", ph_expired: "انتهت صلاحيته", phOrder: "الطلب", phNewToast: "طلب دواء جديد",
      newOrderToast: "وصل طلب جديد", role_owner: "مالك", role_manager: "مدير", role_cashier: "كاشير", empty: "فارغ",
    },
    fr: {
      feedback: "Avis et réclamations", fb_rating: "Note de votre magasin", fb_count: "avis", fb_reviews: "Avis publiés", fb_noReviews: "Aucun avis publié. Les commentaires sont publiés après vérification.", fb_complaints: "Réclamations", fb_none: "Aucune réclamation.", fb_answer: "Votre réponse", fb_send: "Envoyer la réponse", fb_answerHint: "Répondez au client (solution, excuses, explication)", fb_sent: "Réponse envoyée", fb_tl: "Suivi", fb_deadline: "Répondre avant", fb_closed: "Clôturée", fb_back: "Retour",
      fb_st_with_party: "Attend votre réponse", fb_st_party_responded: "Répondu", fb_st_escalated: "Chez le superviseur", fb_st_in_review: "En examen", fb_st_resolved: "Clôturée",
      fb_cat_food_quality: "Qualité des plats", fb_cat_missing_items: "Articles manquants", fb_cat_wrong_order: "Mauvaise commande", fb_cat_late_delivery: "Livraison en retard", fb_cat_driver_behavior: "Comportement du livreur", fb_cat_extra_charge: "Montant en plus", fb_cat_payment: "Paiement", fb_cat_other: "Autre",
      fb_who_customer: "Client", fb_who_store: "Magasin", fb_who_driver: "Livreur", fb_who_supervisor: "Support", fb_who_system: "Système",
      title: "Espace boutique", login: "Connexion", identifier: "E-mail ou téléphone", password: "Mot de passe",
      loginHint: "Connectez-vous avec le compte de votre boutique", chooseStore: "Choisir la boutique", logout: "Déconnexion",
      dashboard: "Tableau de bord", orders_new: "Nouvelles commandes", orders: "Toutes les commandes", products: "Produits",
      categories: "Catégories", pricing: "Prix et promotions", inventory: "Stock et quantités",
      customers: "Clients", chat: "Messages", notifications: "Notifications", reports: "Rapports de ventes",
      settings: "Paramètres", hours: "Horaires", delivery: "Livraison", help: "Aide et support",
      loading: "Chargement…", retry: "Réessayer", save: "Enregistrer", cancel: "Annuler", close: "Fermer", saved: "Enregistré",
      confirm: "Confirmer", back: "Retour", search: "Rechercher…", all: "Tout", refresh: "Actualiser", edit: "Modifier", add: "Ajouter",
      days: "jours", day: "jour", period: "Période", currency: "MAD",
      s_newOrders: "Nouvelles commandes", s_preparing: "En préparation", s_completed: "Commandes terminées", s_canceled: "Commandes annulées",
      s_ordersValue: "Valeur des commandes", s_sales: "Ventes réelles", s_unavailable: "Produits indisponibles",
      s_low: "Stock faible", s_customers: "Clients", s_unread: "Messages non lus", s_products: "Produits",
      stmtTitle: "Relevé de compte", stmtGoods: "Valeur des marchandises", stmtCommission: "Commission plateforme", stmtNet: "Net à percevoir",
      stmtOrders: "Commandes livrées", stmtSettled: "Déjà réglé", stmtBalance: "Solde dû au commerce", stmtAllTime: "Depuis le début",
      stmtRange: "Sur la période", stmtLegacy: "Anciennes commandes sans instantané financier (sans commission) :", stmtNote: "Calculé uniquement sur les commandes livrées ; les règlements sont saisis par l'administration.",
      valueVsSales: "« Valeur des commandes » inclut toutes les commandes non annulées ; « Ventes réelles » uniquement les commandes livrées.",
      emptyDash: "Aucune donnée pour l'instant", emptyDashHint: "Ajoutez vos premiers produits pour recevoir des commandes.",
      addFirst: "Ajouter un produit",
      st_new: "Nouvelle", st_preparing: "En préparation", st_ready: "Prête", st_on_delivery: "En livraison", st_done: "Terminée", st_canceled: "Annulée",
      noOrders: "Aucune commande", order: "Commande", total: "Total", subtotal: "Sous-total", deliveryFee: "Frais de livraison", pickupCode: "Code de retrait (à donner au chauffeur)",
      customer: "Client", phone: "Téléphone", address: "Adresse", notes: "Notes", payment: "Paiement", items: "Articles", qty: "Qté", price: "Prix",
      accept: "Accepter et préparer", ready: "Prête à remettre", reject: "Refuser", reason: "Motif du refus", reasonReq: "Indiquez le motif (3 caractères minimum)",
      print: "Imprimer", printTicket: "Imprimer le ticket", paper: "Papier", openChat: "Discuter avec le client", from: "Du", to: "Au",
      confirmReady: "Confirmer : la commande est prête pour la livraison ?", confirmAccept: "Accepter la commande et commencer la préparation ?", confirmReject: "Refuser cette commande ?",
      name: "Nom", nameAr: "Nom en arabe", nameFr: "Nom en français", desc: "Description", category: "Catégorie", salePrice: "Prix promo",
      stock: "Stock", stockHint: "Laisser vide si pas de suivi de stock", available: "Disponible", unavailable: "Indisponible", archived: "Archivé",
      image: "Photo du produit", imageHint: "", uploadImage: "Téléverser une photo", changeImage: "Changer la photo", removeImage: "Retirer", uploading: "Téléversement…", imageFail: "Échec du téléversement (JPG / PNG / WebP)", newProduct: "Nouveau produit", editProduct: "Modifier le produit",
      archive: "Archiver", restore: "Restaurer", del: "Supprimer", confirmArchive: "Archiver ce produit ? Il pourra être restauré.",
      confirmDelete: "Supprimer définitivement ? Action irréversible.", noProducts: "Aucun produit", lowStock: "Stock faible",
      typeFields: "Champs selon le type d'activité", yes: "Oui", no: "Non", rxNote: "Les produits sur ordonnance ne sont pas vendus en ligne.",
      renameCat: "Renommer la catégorie", catId: "Identifiant", catLabel: "Nom de la catégorie", products_n: "produit(s)",
      ordersN: "Commandes", spent: "Achats", lastOrder: "Dernière commande", noCustomers: "Aucun client", noChats: "Aucune conversation",
      send: "Envoyer", typeMsg: "Écrire un message…", you: "Vous", chatOrder: "Commande",
      notifEmpty: "Aucune alerte", n_new: "nouvelles commandes à traiter", n_unread: "nouveaux messages clients", n_low: "produits en stock faible", n_unavail: "produits indisponibles",
      pause: "Suspendre les commandes", resume: "Reprendre les commandes", paused: "Boutique en pause", open: "La boutique reçoit des commandes",
      closed: "Fermé", open_t: "Ouvre", close_t: "Ferme", minOrder: "Commande minimum", freeOver: "Livraison gratuite dès", avgMin: "Délai moyen (min)",
      hoursHint: "Sans horaires, la boutique reste toujours ouverte.", mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
      helpText: "Pour toute aide, contactez l'administration. Ne partagez jamais votre mot de passe. Pour ajouter des employés ou boutiques, demandez à l'administrateur.",
      supportLink: "Ouvrir le support", err_unauth: "Session expirée, reconnectez-vous", err_forbidden: "Action non autorisée",
      err_generic: "Une erreur est survenue, réessayez", err_login: "Identifiants incorrects", err_disabled: "Compte ou boutique désactivé",
      err_controlled_not_allowed: "Ce médicament contrôlé ne peut pas être listé", err_sale: "Le prix promo doit être inférieur au prix",
      members: "Équipe", memAdd: "Ajouter un membre", memEmail: "E-mail", memPhone: "Téléphone", memPass: "Mot de passe (8 caractères min.)",
      memRole: "Rôle", memDisable: "Désactiver", memEnable: "Activer", memReset: "Nouveau mot de passe", memInactive: "désactivé", memNone: "Aucun membre pour l'instant", memNeedContact: "Saisissez un e-mail ou un téléphone", memNote: "Gérant : produits, commandes, rapports. Caissier : commandes et messages uniquement. Vous ne pouvez pas modifier les propriétaires ni votre compte ici.",
      sp_channels: "Contacter l'administration", sp_noChannels: "Aucun canal de contact publié pour l'instant. Ouvrez un ticket ci-dessous.", sp_tickets: "Mes tickets", sp_new: "Nouveau ticket",
      sp_subject: "Sujet", sp_category: "Catégorie", sp_message: "Votre message", sp_send: "Envoyer", sp_none: "Aucun ticket", sp_close: "Clore le ticket", sp_closed: "Clos", sp_open: "En attente", sp_answered: "Répondu",
      sp_you: "Vous", sp_admin: "Administration", sp_sent: "Ticket envoyé", sp_closedNote: "Ticket clos. Ouvrez-en un nouveau si besoin.", sp_typeMsg: "Votre réponse…", sp_hours: "Horaires",
      sp_tooMany: "Trop de tickets ouverts, attendez une réponse ou clôturez-en", sp_needSubject: "Sujet (3 caractères min.) et message requis", sp_back: "Tous les tickets",
      sp_cat_orders: "Commandes", sp_cat_products: "Produits", sp_cat_payments: "Paiements", sp_cat_technical: "Technique", sp_cat_account: "Compte", sp_cat_other: "Autre", sp_kind_phone: "Appeler", sp_kind_whatsapp: "WhatsApp", sp_kind_email: "E-mail", sp_kind_telegram: "Telegram",
      pharmacy: "Demandes de médicaments", phNew: "Nouvelles", phQuoted: "En attente du client", phAccepted: "Acceptées", phClosed: "Clôturées", phAll: "Toutes", phNone: "Aucune demande",
      phText: "Médicament demandé", phRx: "Ordonnance", phRxMissing: "Pas d'ordonnance", phLoadingRx: "Chargement de l'ordonnance…",
      phAvail: "Disponible", phUnavail: "Indisponible", phName: "Médicament", phQty: "Qté", phPrice: "Prix", phLineNote: "Note", phAddLine: "Ajouter un médicament",
      phReason: "Motif d'indisponibilité", phValid: "Validité de l'offre (min)", phTotal: "Total médicaments", phSend: "Envoyer la réponse", phSent: "Réponse envoyée",
      phNoteToCustomer: "Note pour le client (facultatif)", phCustomer: "Client", phAddr: "Adresse", phOpenChat: "Discuter avec le client", phCurrent: "Offre actuelle", phExpires: "Expire",
      ph_pending: "À traiter", ph_quoted: "En attente du client", ph_unavailable: "Indisponible", ph_accepted: "Offre acceptée", ph_declined: "Refusée", ph_canceled: "Annulée", ph_expired: "Expirée", phOrder: "Commande", phNewToast: "Nouvelle demande de médicament",
      newOrderToast: "Nouvelle commande", role_owner: "Propriétaire", role_manager: "Gérant", role_cashier: "Caissier", empty: "vide",
    },
  };
  let lang = localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "ar";
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
  const locale = () => (lang === "fr" ? "fr-MA" : "ar-MA");

  /* ------------------------------ helpers ------------------------------ */
  const $ = (id) => document.getElementById(id);
  const money = (n) => `${Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: 2 })} ${t("currency")}`;
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }); };
  const nm = (o) => (o && typeof o === "object" ? o[lang] || o.ar || o.fr || o.en || "" : String(o || ""));
  const safeImg = (u) => (/^(\/uploads\/|https:\/\/)/.test(String(u || "")) ? String(u) : "");

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  let toastTimer;
  function toast(msg, isErr) {
    const el = $("toast");
    el.textContent = msg;
    el.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast"), 2600);
  }

  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(audioCtx.currentTime + 0.25);
    } catch (_e) {}
  }

  /* ------------------------------ state + api ------------------------------ */
  // Super admin "enter store": the admin panel opens /store/#admintoken=...&store=ID (fragment, never sent to a server)
  try {
    const hp = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    if (hp.get("admintoken")) {
      localStorage.setItem(TOKEN_KEY, hp.get("admintoken"));
      if (hp.get("store")) localStorage.setItem(STORE_KEY, hp.get("store")); else localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(LIST_KEY);
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (_e) {}
  let token = localStorage.getItem(TOKEN_KEY) || "";
  let storeId = localStorage.getItem(STORE_KEY) || "";
  const S = { me: null, view: "dashboard", stats: null, prevNew: null, ord: { stage: "all", q: "", from: "", to: "" }, prod: { q: "", status: "", cat: "" }, days: 7, chatOrder: null, refresh: null, timers: [] };

  class ApiError extends Error { constructor(m, status, data) { super(m); this.status = status; this.data = data; } }

  async function api(path, opt = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (storeId) headers["X-Store-Id"] = storeId;
    let url = path;
    if (opt.query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opt.query)) if (v !== "" && v !== undefined && v !== null) qs.set(k, v);
      const s = qs.toString();
      if (s) url += "?" + s;
    }
    const r = await fetch(url, { method: opt.method || "GET", headers, body: opt.body ? JSON.stringify(opt.body) : undefined });
    let data = {};
    try { data = await r.json(); } catch (_e) {}
    if (r.status === 401 && token && !opt.noAuthRedirect) { logout(); throw new ApiError("unauth", 401, data); }
    if (!r.ok) throw new ApiError(data.error || "HTTP " + r.status, r.status, data);
    return data;
  }
  function errText(e) {
    if (!e) return t("err_generic");
    const m = String(e.message || "");
    if (e.status === 401) return t("err_unauth");
    if (e.status === 403) return t("err_forbidden");
    if (m === "controlled_not_allowed") return t("err_controlled_not_allowed");
    if (m === "Sale price must be lower than price") return t("err_sale");
    if (/^[\u0600-\u06FF]/.test(m)) return m;
    return t("err_generic") + (m && m.length < 80 ? ` (${m})` : "");
  }
  const can = (p) => !!(S.me && S.me.permissions.includes(p));

  function stopTimers() { S.timers.forEach(clearInterval); S.timers = []; S.refresh = null; }
  function logout() {
    stopTimers();
    token = ""; storeId = ""; S.me = null; S.stats = null; S.prevNew = null; S.prevPh = null;
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(STORE_KEY); localStorage.removeItem(LIST_KEY);
    renderLogin();
  }

  /* ------------------------------ modal helpers ------------------------------ */
  function modal(title, body, buttons) {
    const root = $("modalRoot");
    const close = () => clear(root);
    const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, h("h2", {}, title), body,
      h("div", { class: "foot" }, (buttons || []).map((b) => h("button", { class: "btn " + (b.cls || ""), type: "button", onclick: () => b.run(close) }, b.label))));
    const ov = h("div", { class: "overlay", onclick: (e) => { if (e.target === ov) close(); } }, box);
    clear(root).appendChild(ov);
    return close;
  }
  function confirmBox(msg, danger) {
    return new Promise((res) => {
      modal(t("confirm"), h("p", {}, msg), [
        { label: t("cancel"), run: (c) => { c(); res(false); } },
        { label: t("confirm"), cls: danger ? "danger" : "primary", run: (c) => { c(); res(true); } },
      ]);
    });
  }
  function askReason() {
    return new Promise((res) => {
      const inp = h("textarea", { class: "input", maxlength: "300", placeholder: t("reasonReq") });
      modal(t("reject"), h("div", { class: "field" }, h("label", { class: "f" }, t("reason")), inp), [
        { label: t("cancel"), run: (c) => { c(); res(null); } },
        { label: t("reject"), cls: "danger", run: (c) => { const v = inp.value.trim(); if (v.length < 3) return toast(t("reasonReq"), true); c(); res(v); } },
      ]);
    });
  }

  /* ------------------------------ login ------------------------------ */
  function renderLogin(errMsg) {
    stopTimers();
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    const id = h("input", { class: "input", id: "li", autocomplete: "username", inputmode: "email" });
    const pw = h("input", { class: "input", id: "lp", type: "password", autocomplete: "current-password" });
    const msg = h("p", { class: "muted", id: "lmsg", role: "alert" }, errMsg || "");
    const btn = h("button", { class: "btn primary", type: "submit", style: "width:100%" }, t("login"));
    const form = h("form", { class: "card", onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; msg.textContent = "";
      try { await doLogin(id.value.trim(), pw.value); } catch (er) { msg.textContent = er.status === 403 ? t("err_disabled") : t("err_login"); btn.disabled = false; }
    } },
      h("div", { class: "brand" }, h("img", { src: "/icons/icon-192.png", alt: "" }), h("div", {}, h("h1", {}, "siymon"), h("div", { class: "muted" }, t("loginHint")))),
      h("div", { class: "field" }, h("label", { class: "f", for: "li" }, t("identifier")), id),
      h("div", { class: "field" }, h("label", { class: "f", for: "lp" }, t("password")), pw), msg, btn,
      h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn sm", type: "button", onclick: toggleLang }, lang === "ar" ? "FR" : "AR")));
    clear($("app")).appendChild(h("div", { class: "login" }, form));
    id.focus();
  }

  async function doLogin(identifier, password) {
    let data;
    try {
      data = await api("/api/store/login", { method: "POST", body: { identifier, password }, noAuthRedirect: true });
    } catch (e) {
      if (e.status !== 401) throw e;
      // legacy single-password restaurant account keeps working
      data = await api("/api/restaurant/login", { method: "POST", body: { identifier, password }, noAuthRedirect: true });
      data.stores = [];
    }
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    const list = Array.isArray(data.stores) ? data.stores : [];
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    if (list.length > 1) return renderPicker(list);
    storeId = list.length ? String(list[0].id) : "";
    storeId ? localStorage.setItem(STORE_KEY, storeId) : localStorage.removeItem(STORE_KEY);
    await boot();
  }

  function renderPicker(list) {
    stopTimers();
    const buttons = list.map((s) => h("button", { class: "btn", type: "button", onclick: async () => { storeId = String(s.id); localStorage.setItem(STORE_KEY, storeId); await boot(); } },
      h("div", {}, h("div", { style: "font-weight:700" }, nm(s.name)), h("div", { class: "muted" }, t("role_" + s.role)))));
    clear($("app")).appendChild(h("div", { class: "login" }, h("div", { class: "card" }, h("h2", {}, t("chooseStore")), h("div", { class: "picker" }, buttons),
      h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn sm", type: "button", onclick: logout }, t("logout"))))));
  }

  /* ------------------------------ boot + shell ------------------------------ */
  async function boot() {
    if (!token) return renderLogin();
    clear($("app")).appendChild(h("div", { class: "login" }, h("div", { class: "muted" }, t("loading"))));
    try {
      S.me = await api("/api/store/me");
    } catch (e) {
      if (e.status === 400 && e.data && e.data.error === "store_required") {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(LIST_KEY) || "[]"); } catch (_e) {}
        if (list.length) return renderPicker(list);
      }
      if (e.status === 403) { storeId = ""; localStorage.removeItem(STORE_KEY); }
      return e.status === 401 ? undefined : renderLogin(errText(e));
    }
    storeId = String(S.me.store.id);
    localStorage.setItem(STORE_KEY, storeId);
    localStorage.setItem(LIST_KEY, JSON.stringify(S.me.stores));
    if (!S.me.sections.includes(S.view)) S.view = S.me.sections[0] || "dashboard";
    renderShell();
    startPolling();
  }

  /* ------------------------------ line icons (same style as the admin sidebar) ------------------------------ */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const IC = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8c0 2.7.5 4.5 1.1 5.7"/><path d="M17 17H3s3-2 3-9c0-.7.1-1.3.3-1.9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    down: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    up: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  };
  function ico(name, cls) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "ico" + (cls ? " " + cls : ""));
    svg.innerHTML = IC[name] || IC.dashboard;           // static, trusted markup from the table above
    return svg;
  }
  const iconTile = (name) => h("span", { class: "ic-tile" }, ico(name));

  const ICONS = { dashboard: "dashboard", orders_new: "bell", orders: "receipt", products: "package", categories: "folder", pricing: "tag", inventory: "down", customers: "users", chat: "message", notifications: "bellOff", reports: "up", settings: "settings", hours: "clock", delivery: "truck", help: "help", feedback: "star", members: "users", pharmacy: "pill" };

  function renderShell() {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    const me = S.me;
    const nav = h("nav", { class: "nav" }, me.sections.map((k) =>
      h("a", { class: S.view === k ? "on" : "", "data-k": k, role: "button", tabindex: "0", onclick: () => go(k), onkeydown: (e) => { if (e.key === "Enter") go(k); } },
        h("span", { class: "ic" }, iconTile(ICONS[k] || "dashboard")), h("span", {}, t(k)), h("span", { class: "badge hidden", id: "bd_" + k }))));
    const switcher = me.stores.length > 1 ? h("select", { class: "input", style: "max-width:220px", "aria-label": t("chooseStore"), onchange: async (e) => { storeId = e.target.value; localStorage.setItem(STORE_KEY, storeId); S.view = "dashboard"; S.chatOrder = null; await boot(); } },
      me.stores.map((s) => h("option", { value: String(s.id), selected: String(s.id) === String(me.store.id) }, nm(s.name)))) : null;
    const side = h("aside", { class: "side" },
      h("div", { class: "who" }, h("div", { class: "brand" }, h("img", { src: safeImg(me.store.logo) || "/icons/icon-192.png", alt: "" }),
        h("div", {}, h("div", { style: "font-weight:800" }, nm(me.store.name)), h("div", { class: "muted" }, `${me.type.icon || ""} ${nm(me.type.name)} · ${t("role_" + me.role)}`)))),
      nav, h("div", { style: "padding:10px" }, h("button", { class: "btn", style: "width:100%", type: "button", onclick: logout }, "⎋ " + t("logout"))));
    const top = h("header", { class: "top" },
      h("button", { class: "btn menu-btn", type: "button", "aria-label": "menu", onclick: () => $("shell").classList.toggle("open") }, "≡"),
      h("h1", { id: "viewTitle" }, t(S.view)), h("span", { class: "spacer" }), switcher,
      h("button", { class: "btn sm", type: "button", onclick: toggleLang }, lang === "ar" ? "FR" : "AR"),
      h("button", { class: "btn sm", type: "button", "aria-label": "theme", onclick: toggleTheme }, ico("moon")));
    const shell = h("div", { class: "shell", id: "shell" }, side, h("div", { class: "scrim", onclick: () => $("shell").classList.remove("open") }), h("main", { class: "main" }, top, h("div", { class: "content", id: "view" })));
    clear($("app")).appendChild(shell);
    updateBadges();
    renderView();
  }

  function go(k) {
    S.view = k; stopViewTimers();
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("data-k") === k));
    const vt = $("viewTitle"); if (vt) vt.textContent = t(k);
    $("shell").classList.remove("open");
    renderView();
  }
  let viewTimers = [];
  function stopViewTimers() { viewTimers.forEach(clearInterval); viewTimers = []; S.refresh = null; }

  const VIEWS = {};
  function renderView() {
    const root = clear($("view"));
    S.refresh = null;
    const fn = VIEWS[S.view] || VIEWS.dashboard;
    Promise.resolve(fn(root)).catch((e) => showErr(root, e));
  }
  function showErr(root, e) {
    clear(root).appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, ico("alert")), h("p", {}, errText(e)), h("button", { class: "btn", type: "button", onclick: renderView }, t("retry"))));
  }
  const skeleton = (n) => h("div", { class: "list" }, Array.from({ length: n || 3 }, () => h("div", { class: "skeleton" })));
  const emptyBox = (icon, title, hint, action) => h("div", { class: "empty" }, h("div", { class: "big" }, icon), h("h3", {}, title), hint ? h("p", {}, hint) : null, action || null);

  /* ------------------------------ polling / badges ------------------------------ */
  function updateBadges() {
    const st = S.stats; if (!st) return;
    const set = (k, n) => { const b = $("bd_" + k); if (!b) return; b.textContent = n > 99 ? "99+" : String(n); b.classList.toggle("hidden", !(n > 0)); };
    set("orders_new", st.newOrders); set("chat", st.unreadMessages); set("pharmacy", st.pendingPharmacy || 0); set("help", st.supportUnread || 0); set("feedback", st.complaintsAwaiting || 0);
  }
  async function pollStats() {
    if (document.hidden || !token || !S.me) return;
    try {
      const r = await api("/api/store/stats", { query: { days: S.days } });
      S.stats = r.stats;
      if (S.prevNew !== null && r.stats.newOrders > S.prevNew) { beep(); toast(t("newOrderToast")); if (S.refresh) S.refresh(); }
      S.prevNew = r.stats.newOrders;
      const pp = r.stats.pendingPharmacy || 0;
      if (S.prevPh !== null && S.prevPh !== undefined && pp > S.prevPh) { beep(); toast(t("phNewToast")); if (S.refresh) S.refresh(); }
      S.prevPh = pp;
      updateBadges();
    } catch (_e) {}
  }
  function startPolling() {
    stopTimers();
    pollStats();
    S.timers.push(setInterval(pollStats, 20000));
  }

  /* ------------------------------ dashboard / reports ------------------------------ */
  const STAT_ICON = { s_newOrders: "bell", s_preparing: "utensils", s_completed: "check", s_canceled: "ban", s_ordersValue: "receipt", s_sales: "up", s_unavailable: "package", s_low: "down", s_customers: "users", s_unread: "message", s_products: "package" };
  function statCard(label, value, cls, onclick, key) {
    const k = key || Object.keys(STAT_ICON).find((x) => t(x) === label);
    return h("div", { class: "card stat " + (cls || ""), style: onclick ? "cursor:pointer" : "", onclick },
      h("div", { class: "stat-top" }, iconTile(STAT_ICON[k] || "dashboard"), h("div", { class: "n" }, value)), h("div", { class: "l" }, label));
  }
  function periodSelect(onchange) {
    return h("select", { class: "input", "aria-label": t("period"), onchange: (e) => { S.days = Number(e.target.value); onchange(); } },
      [1, 7, 30, 90].map((d) => h("option", { value: String(d), selected: S.days === d }, `${d} ${d === 1 ? t("day") : t("days")}`)));
  }

  VIEWS.dashboard = async (root) => {
    clear(root).appendChild(skeleton(3));
    const r = await api("/api/store/stats", { query: { days: S.days } });
    S.stats = r.stats; S.prevNew = r.stats.newOrders; updateBadges();
    const s = r.stats;
    const wrap = h("div", {}, h("div", { class: "dash-toolbar" }, h("label", { class: "dash-period" }, h("span", {}, t("period")), periodSelect(renderView)),
      h("button", { class: "dash-refresh", type: "button", onclick: renderView }, [ico("refresh"), " " + t("refresh")])));
    if (!s.productsTotal && !s.completedOrders && !s.newOrders) {
      wrap.appendChild(emptyBox(ico("bag"), t("emptyDash"), t("emptyDashHint"), can("products.write") ? h("button", { class: "btn primary", type: "button", onclick: () => { go("products"); } }, t("addFirst")) : null));
    } else {
      wrap.appendChild(h("div", { class: "stats" },
        statCard(t("s_newOrders"), s.newOrders, s.newOrders ? "hot" : "", () => go("orders_new")),
        statCard(t("s_preparing"), s.preparingOrders), statCard(t("s_completed"), s.completedOrders),
        statCard(t("s_ordersValue"), money(s.ordersValue)), statCard(t("s_sales"), money(s.sales), "hot"),
        statCard(t("s_unavailable"), s.unavailableProducts, s.unavailableProducts ? "alert" : ""),
        statCard(t("s_low"), s.lowStockProducts, s.lowStockProducts ? "alert" : ""),
        statCard(t("s_customers"), s.customers), statCard(t("s_unread"), s.unreadMessages, s.unreadMessages ? "hot" : "", () => go("chat"))));
      wrap.appendChild(h("p", { class: "muted" }, t("valueVsSales")));
    }
    clear(root).appendChild(wrap);
  };

  VIEWS.reports = async (root) => {
    clear(root).appendChild(skeleton(2));
    const r = await api("/api/store/stats", { query: { days: S.days } });
    const s = r.stats;
    clear(root).appendChild(h("div", {}, h("div", { class: "row", style: "margin-bottom:12px" }, h("span", { class: "muted" }, t("period")), periodSelect(renderView)),
      h("div", { class: "stats" }, statCard(t("s_sales"), money(s.sales), "hot"), statCard(t("s_ordersValue"), money(s.ordersValue)),
        statCard(t("s_completed"), s.completedOrders), statCard(t("s_canceled"), s.canceledOrders), statCard(t("s_customers"), s.customers)),
      h("p", { class: "muted" }, t("valueVsSales")), stmtBox(), detailedReports()));
  /* ---- detailed reports (section 17): the shared reports UI, scoped by the server to THIS store only ---- */
  let rpScript = null;
  function loadReportsUi() {
    if (window.SiymonReports) return Promise.resolve();
    if (rpScript) return rpScript;
    rpScript = new Promise((resolve, reject) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/shared/reports-ui.css?v=1"; document.head.appendChild(css);
      const sc = document.createElement("script"); sc.src = "/shared/reports-ui.js?v=1"; sc.onload = resolve; sc.onerror = () => { rpScript = null; reject(new Error("load")); };
      document.head.appendChild(sc);
    });
    return rpScript;
  }
  function detailedReports() {
    const box = h("div", { style: "margin-top:24px" }), mount = h("div", {});
    box.appendChild(h("h3", { style: "margin:0 0 8px" }, t("reports")));
    box.appendChild(mount);
    loadReportsUi().then(() => window.SiymonReports.mount(mount, {
      base: "/api/store/reports",
      lang: () => lang,
      headers: () => { const hd = {}; if (token) hd.Authorization = "Bearer " + token; if (storeId) hd["X-Store-Id"] = storeId; return hd; },
      onUnauthorized: () => logout(),
    })).catch((e) => showErr(mount, e));
    return box;
  }
  };

  /* ---- account statement (own store only; the server takes the store from the token) ---- */
  function stmtBox() {
    const box = h("div", { style: "margin-top:20px" });
    const st = S.stmt || (S.stmt = { from: "", to: "" });
    const body = h("div", {});
    const load = async () => {
      clear(body).appendChild(skeleton(2));
      try {
        const r = await api("/api/store/statement", { query: { from: st.from, to: st.to } });
        const g = (a, b, c) => h("div", { class: "stats" }, a, b, c);
        clear(body).appendChild(h("div", {},
          h("h4", { style: "margin:12px 0 6px" }, t("stmtRange")),
          h("div", { class: "stats" }, statCard(t("stmtOrders"), r.range.orders), statCard(t("stmtGoods"), money(r.range.goods)),
            statCard(t("stmtCommission"), money(r.range.commission)), statCard(t("stmtNet"), money(r.range.net), "hot")),
          r.range.legacyOrdersWithoutSnapshot ? h("p", { class: "muted" }, `${t("stmtLegacy")} ${r.range.legacyOrdersWithoutSnapshot}`) : null,
          h("h4", { style: "margin:12px 0 6px" }, t("stmtAllTime")),
          g(statCard(t("stmtNet"), money(r.allTime.netEntitlement)), statCard(t("stmtSettled"), money(r.allTime.settledNet)),
            statCard(t("stmtBalance"), money(r.allTime.balanceOwedToStore), "hot")),
          h("p", { class: "muted" }, t("stmtNote"))));
      } catch (e) { showErr(body, e); }
    };
    const from = h("input", { class: "input", type: "date", value: st.from, "aria-label": t("from"), onchange: (e) => { st.from = e.target.value; load(); } });
    const to = h("input", { class: "input", type: "date", value: st.to, "aria-label": t("to"), onchange: (e) => { st.to = e.target.value; load(); } });
    box.appendChild(h("div", {}, h("h3", { style: "margin:0 0 8px" }, t("stmtTitle")),
      h("div", { class: "row" }, h("div", { style: "flex:1;min-width:130px" }, from), h("div", { style: "flex:1;min-width:130px" }, to)), body));
    load();
    return box;
  }

  /* ------------------------------ orders ------------------------------ */
  const STAGES = ["new", "preparing", "ready", "on_delivery", "done", "canceled"];
  const pillCls = (st) => (st === "new" ? "new" : st === "canceled" ? "bad" : st === "preparing" ? "warn" : "");

  function orderView(lockStage) {
    return async (root) => {
      // "new orders" has its own filter state so it can't leak into "all orders"
      const st = lockStage ? { stage: lockStage, q: "", from: "", to: "" } : S.ord;
      const list = h("div", { class: "list" });
      const load = async () => {
        clear(list).appendChild(skeleton(3));
        try {
          const r = await api("/api/store/orders", { query: { stage: st.stage === "all" ? "" : st.stage, q: st.q, from: st.from, to: st.to } });
          clear(list);
          if (!r.orders.length) return list.appendChild(emptyBox(ico("receipt"), t("noOrders")));
          r.orders.forEach((o) => list.appendChild(h("div", { class: "item", role: "button", tabindex: "0", onclick: () => openOrder(o, load), onkeydown: (e) => { if (e.key === "Enter") openOrder(o, load); } },
            h("div", { class: "grow" }, h("div", { class: "t" }, `#${String(o.id).slice(-6)} · ${(o.customer && o.customer.name) || ""}`),
              h("div", { class: "muted" }, `${when(o.createdAt)} · ${(o.items || []).length} ${t("items")}`)),
            h("div", { style: "text-align:end" }, h("div", { style: "font-weight:700" }, money(o.total)), h("span", { class: "pill " + pillCls(o.stage) }, t("st_" + o.stage))))));
        } catch (e) { showErr(list, e); }
      };
      S.refresh = load;
      const tabs = lockStage ? null : h("div", { class: "tabs" }, ["all", ...STAGES].map((k) =>
        h("button", { class: "tab" + (st.stage === k ? " on" : ""), type: "button", onclick: (e) => { st.stage = k; document.querySelectorAll(".tabs .tab").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); load(); } }, k === "all" ? t("all") : t("st_" + k))));
      let qTimer;
      const q = h("input", { class: "input", type: "search", placeholder: t("search"), value: st.q, oninput: (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 300); } });
      const from = h("input", { class: "input", type: "date", value: st.from, "aria-label": t("from"), onchange: (e) => { st.from = e.target.value; load(); } });
      const to = h("input", { class: "input", type: "date", value: st.to, "aria-label": t("to"), onchange: (e) => { st.to = e.target.value; load(); } });
      clear(root).appendChild(h("div", {}, tabs, h("div", { class: "row", style: "margin-bottom:12px" }, h("div", { style: "flex:2;min-width:160px" }, q), h("div", { style: "flex:1;min-width:130px" }, from), h("div", { style: "flex:1;min-width:130px" }, to)), list));
      load();
      viewTimers.push(setInterval(() => { if (!document.hidden) load(); }, 30000));
    };
  }
  VIEWS.orders_new = orderView("new");
  VIEWS.orders = orderView(null);

  /* ---- order ticket: plain black & white store receipt (58 / 80 / 85 mm thermal roll or A4) ----
     Real HTML text + table (no image). Shows the saved order values as they are: nothing is re-priced here. */
  const escH = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAPERS = { "58": { w: "58mm", font: 11, logo: 30 }, "80": { w: "80mm", font: 12.5, logo: 38 }, "85": { w: "85mm", font: 13, logo: 40 }, a4: { w: "A4", font: 14, logo: 40 } };
  const PAPER_KEY = "siymon_ticket_paper";
  const getPaper = () => { let k = ""; try { k = localStorage.getItem(PAPER_KEY) || ""; } catch (_e) {} return PAPERS[k] ? k : "85"; };
  const setPaper = (k) => { try { localStorage.setItem(PAPER_KEY, k); } catch (_e) {} };
  const mapsUrl = (c) => (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) && c.lat !== "" && c.lng !== "" && c.lat !== null && c.lng !== null ? `https://maps.google.com/?q=${Number(c.lat)},${Number(c.lng)}` : "");
  function ticketHtml(o, paperKey) {
    const st = S.me.store || {}, c = o.customer || {}, ar = lang === "ar", paper = PAPERS[paperKey] || PAPERS["85"], a4 = paperKey === "a4", narrow = paperKey === "58";
    const cur = o.currency || (ar ? "MAD" : "MAD");
    const amt = (n) => `${cur} ${Number(n || 0).toFixed(2)}`;
    const L = ar
      ? { order: "طلب", status: "الحالة", name: "الاسم", phone: "الهاتف", addr: "العنوان", place: "المدينة / المنطقة", notes: "ملاحظة", map: "الموقع على الخريطة", item: "المنتج", qty: "الكمية", unit: "سعر الوحدة", line: "المجموع", sub: "المجموع", disc: "خصم", fee: "التوصيل", extra: "رسوم إضافية", total: "الإجمالي", pay: "الدفع", cod: "عند الاستلام", thanks: "شكراً لثقتكم بنا", contact: "للتواصل" }
      : { order: "Commande", status: "Statut", name: "Nom", phone: "Tél", addr: "Adresse", place: "Ville / Zone", notes: "Note", map: "Position sur la carte", item: "Article", qty: "Qté", unit: "Prix unit.", line: "Total", sub: "Sous-total", disc: "Remise", fee: "Livraison", extra: "Frais supplémentaires", total: "TOTAL", pay: "Paiement", cod: "À la livraison", thanks: "Merci de votre confiance", contact: "Contact" };
    const items = Array.isArray(o.items) ? o.items : [];
    const rows = items.map((i) => { const q = Number(i.qty) || 0, pr = Number(i.price) || 0; return `<tr><td class="nm">${escH(i.name)}${narrow ? `<small>${pr.toFixed(2)}</small>` : ""}</td><td class="q">${q}</td>${narrow ? "" : `<td class="u">${pr.toFixed(2)}</td>`}<td class="a">${(q * pr).toFixed(2)}</td></tr>`; }).join("");
    // values come from the saved order; a leftover difference (discount / extra fee) is shown instead of being hidden
    const sub = o.subtotal != null ? Number(o.subtotal) : items.reduce((x, i) => x + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
    const fee = Number(o.deliveryFee) || 0;
    const explicitDisc = Number(o.discount) || 0, explicitExtra = Number(o.extraFees != null ? o.extraFees : o.serviceFee) || 0;
    const rest = Math.round((Number(o.total) - sub - fee + explicitDisc - explicitExtra) * 100) / 100; // unexplained remainder
    const disc = explicitDisc + (rest < 0 ? -rest : 0), extra = explicitExtra + (rest > 0 ? rest : 0);
    const pm = !o.paymentMethod || String(o.paymentMethod).toLowerCase() === "cod" ? L.cod : escH(o.paymentMethod);
    const payTxt = pm + (o.paymentStatus ? " — " + escH(o.paymentStatus) : "");
    const stage = o.stage && t("st_" + o.stage) !== "st_" + o.stage ? t("st_" + o.stage) : "";
    const place = [c.city, c.area].filter(Boolean).join(" / ");
    const map = mapsUrl(c);
    const noteHasMap = /maps\.google|goo\.gl\/maps|google\.com\/maps/i.test(c.notes || "");
    const f = (k, v, ltr) => (v ? `<div class="kv"><b>${k}:</b> <span${ltr ? ' class="ltr"' : ""}>${escH(v)}</span></div>` : "");
    const tot = (k, v, cls) => `<div class="tot ${cls || ""}"><span>${k}</span><b class="ltr">${v}</b></div>`;
    const contact = [st.phone, st.address].filter(Boolean).map(escH).join("  ·  ");
    return `<!doctype html><html lang="${lang}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escH(nm(st.name))} #${escH(o.id)}</title><style>
@page{size:${a4 ? "A4" : paper.w + " auto"};margin:${a4 ? "12mm" : "0"}}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:#fff;color:#000}
body{font-family:"Noto Sans Arabic",Tahoma,Roboto,"Segoe UI",Arial,sans-serif;font-size:${paper.font}px;line-height:1.55;${a4 ? "" : `width:${paper.w};padding:3mm 3.5mm 8mm`}}
.sheet{${a4 ? "max-width:110mm;margin:0 auto" : ""}}
.c{text-align:center}
.logo{display:block;margin:0 auto 2.5mm;width:${paper.logo}mm;height:${paper.logo}mm;object-fit:contain;filter:grayscale(1) contrast(1.35)}
.applogo{width:${paper.logo}mm;height:${paper.logo}mm;margin:0 auto 2.5mm;border-radius:50%;overflow:hidden;position:relative;background:#000;filter:grayscale(1) contrast(1.25)}
.applogo img{position:absolute;left:50%;top:50%;width:131%;transform:translate(-50%,-50%)}
.shop{font-size:${paper.font + 5}px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.oid{font-size:${paper.font + 2}px;font-weight:600;margin-top:1mm}
.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;max-width:100%}
.date{margin-top:.5mm}
.dash{border:0;border-top:1.5px dashed #000;margin:3mm 0}
.kv{padding:.5mm 0;overflow-wrap:anywhere}
.kv b{font-weight:700}
.note{padding:.5mm 0;overflow-wrap:anywhere}
.map{display:block;color:#000;overflow-wrap:anywhere;direction:ltr;text-align:start;font-size:${paper.font - 1}px;margin-top:.5mm}
table{width:100%;border-collapse:collapse}
th{font-weight:700;padding:1.2mm .8mm;text-align:start;border-bottom:1.5px solid #000;font-size:${paper.font - 0.5}px}
td{padding:1.4mm .8mm;vertical-align:top}
tbody tr+tr td{border-top:1px dotted #000}
td.nm{font-weight:600;overflow-wrap:anywhere;width:${narrow ? "50%" : "46%"}}
td.q,th:nth-child(2){text-align:center}
td.u,td.a,th:nth-child(3),th:last-child{text-align:end;white-space:nowrap}
td{font-size:${paper.font}px}
td.nm small{display:block;font-weight:400;font-size:${paper.font - 1.5}px}
td.a{font-weight:700}
.tot{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;padding:1mm 0;font-weight:600}
.tot b{white-space:nowrap}
.tot.grand{font-size:${paper.font + 4}px;font-weight:800;padding-top:1.6mm}
.pay{margin-top:1mm;font-size:${paper.font - 0.5}px}
.thanks{font-weight:800;font-size:${paper.font + 1}px}
.sub{font-size:${paper.font - 1}px;margin-top:.8mm;overflow-wrap:anywhere}
@media print{a{color:#000;text-decoration:none}}
</style></head><body><div class="sheet">
<div class="c"><div class="applogo"><img src="/icons/invoice-logo.png" alt="siymon"></div><div class="shop">${escH(nm(st.name))}</div>
<div class="oid">${L.order} <span class="ltr">#${escH(o.id)}</span></div><div class="date">${escH(when(o.createdAt))}${stage ? ` — ${L.status}: ${escH(stage)}` : ""}</div></div>
<hr class="dash">
${f(L.name, c.name)}${f(L.phone, c.phone, true)}${f(L.addr, c.addr)}${f(L.place, place)}${c.notes ? `<div class="note"><b>${L.notes}:</b> ${escH(c.notes)}</div>` : ""}${map && !noteHasMap ? `<div class="kv"><b>${L.map}:</b><a class="map" href="${escH(map)}" target="_blank" rel="noopener">${escH(map)}</a></div>` : ""}
<hr class="dash">
<table><thead><tr><th>${L.item}</th><th>${L.qty}</th>${narrow ? "" : `<th>${L.unit}</th>`}<th>${L.line}</th></tr></thead><tbody>${rows}</tbody></table>
<hr class="dash">
${tot(L.sub, amt(sub))}${disc > 0 ? tot(L.disc, "−" + amt(disc)) : ""}${tot(L.fee, amt(fee))}${extra > 0 ? tot(L.extra, amt(extra)) : ""}${tot(L.total, amt(o.total), "grand")}
<div class="pay"><b>${L.pay}:</b> ${payTxt}</div>
<hr class="dash">
<div class="c"><div class="thanks">${L.thanks}</div><div class="sub">${escH(nm(st.name))}</div>${contact ? `<div class="sub">${L.contact}: <span class="ltr">${contact}</span></div>` : ""}</div>
</div></body></html>`;
  }
  function printOrder(o) {
    const old = $("ticketFrame"); if (old) old.remove();
    const f = h("iframe", { id: "ticketFrame", "aria-hidden": "true", style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0" });
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open(); d.write(ticketHtml(o, getPaper())); d.close();
    const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_e) {} setTimeout(() => f.remove(), 60000); };
    const imgs = Array.from(d.images || []);
    if (!imgs.length || imgs.every((i) => i.complete)) setTimeout(go, 150);
    else { let done = false; const fin = () => { if (!done) { done = true; go(); } }; imgs.forEach((i) => { i.onload = i.onerror = () => imgs.every((x) => x.complete) && fin(); }); setTimeout(fin, 2000); }
  }

  function openOrder(o, reload) {
    const c = o.customer || {};
    const rows = (o.items || []).map((i) => h("tr", {}, h("td", {}, i.name), h("td", {}, i.qty), h("td", {}, money(i.price)), h("td", {}, money(i.qty * i.price))));
    const body = h("div", {},
      h("div", { class: "row", style: "margin-bottom:8px" }, h("span", { class: "pill " + pillCls(o.stage) }, t("st_" + o.stage)), h("span", { class: "muted" }, when(o.createdAt))),
      h("p", {}, h("b", {}, t("customer") + ": "), c.name || ""), c.phone ? h("p", {}, h("b", {}, t("phone") + ": "), h("span", { dir: "ltr" }, c.phone)) : null,
      c.addr ? h("p", {}, h("b", {}, t("address") + ": "), c.addr) : null, c.notes ? h("p", {}, h("b", {}, t("notes") + ": "), c.notes) : null,
      o.cancelReason ? h("p", { class: "pill bad" }, `${t("reason")}: ${o.cancelReason}`) : null,
      o.pickupCode ? h("p", {}, h("b", {}, t("pickupCode") + ": "), h("span", { dir: "ltr", style: "font-size:22px;letter-spacing:4px;font-weight:700" }, o.pickupCode)) : null,
      h("div", { class: "scroll-x" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, [t("items"), t("qty"), t("price"), t("total")].map((x) => h("th", {}, x)))), h("tbody", {}, rows))),
      h("p", {}, `${t("subtotal")}: ${money(o.subtotal)} · ${t("deliveryFee")}: ${money(o.deliveryFee)}${Number(o.discount) > 0 ? ` · ${lang === "ar" ? "خصم" : "Remise"}${o.promoCode ? " (" + o.promoCode + ")" : ""}: −${money(o.discount)}` : ""}`), h("h3", {}, `${t("total")}: ${money(o.total)}`),
      h("div", { class: "row", style: "margin-top:10px" }, h("span", { class: "muted" }, t("paper")),
        h("select", { class: "input", style: "max-width:150px", "aria-label": t("paper"), onchange: (e) => setPaper(e.target.value) },
          [["58", "58 mm"], ["80", "80 mm"], ["85", "85 mm"], ["a4", "A4"]].map(([k, l]) => h("option", { value: k, selected: getPaper() === k }, l)))));
    const act = async (action, msg, danger, close) => {
      let reason;
      if (action === "reject") { reason = await askReason(); if (!reason) return; } else if (!(await confirmBox(msg, danger))) return;
      try { await api("/api/store/orders/" + encodeURIComponent(o.id), { method: "PATCH", body: { action, reason } }); toast(t("saved")); close(); pollStats(); reload(); }
      catch (e) { toast(errText(e), true); }
    };
    const btns = [];
    if (can("orders.update")) {
      if (o.stage === "new") btns.push({ label: t("accept"), cls: "primary", run: (c2) => act("accept", t("confirmAccept"), false, c2) });
      if (o.stage === "new" || o.stage === "preparing") {
        btns.push({ label: t("ready"), cls: "primary", run: (c2) => act("ready", t("confirmReady"), false, c2) });
        btns.push({ label: t("reject"), cls: "danger", run: (c2) => act("reject", "", true, c2) });
      }
    }
    if (can("chat.use") && o.customerId) btns.push({ label: t("openChat"), run: (c2) => { c2(); openChatFor(o.id); } });
    btns.push({ label: t("printTicket"), run: () => printOrder(o) }, { label: t("close"), run: (c2) => c2() });
    modal(`${t("order")} #${String(o.id).slice(-6)}`, body, btns);
  }

  /* ------------------------------ products / pricing / inventory ------------------------------ */
  function productView(mode) {
    return async (root) => {
      const st = S.prod;
      const box = h("div", { class: "scroll-x" });
      let fields = [];
      const load = async () => {
        clear(box).appendChild(skeleton(3));
        try {
          const r = await api("/api/store/products", { query: { q: st.q, status: mode === "inventory" && !st.status ? "" : st.status, cat: st.cat } });
          fields = r.fields || [];
          clear(box);
          if (!r.items.length) return box.appendChild(emptyBox(ico("package"), t("noProducts"), "", can("products.write") ? h("button", { class: "btn primary", type: "button", onclick: () => editProduct(null, fields, load) }, t("addFirst")) : null));
          const head = mode === "pricing" ? [t("name"), t("price"), t("salePrice")] : mode === "inventory" ? [t("name"), t("stock"), t("available")] : [t("name"), t("category"), t("price"), t("stock"), ""];
          box.appendChild(h("table", { class: "tbl resp" }, h("thead", {}, h("tr", {}, head.map((x) => h("th", {}, x)))), h("tbody", {}, r.items.map((it) => productRow(it, mode, fields, load)))));
        } catch (e) { showErr(box, e); }
      };
      let qt;
      const q = h("input", { class: "input", type: "search", placeholder: t("search"), value: st.q, oninput: (e) => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 300); } });
      const sel = h("select", { class: "input", onchange: (e) => { st.status = e.target.value; load(); } },
        [["", t("all")], ["available", t("available")], ["unavailable", t("unavailable")], ["low", t("lowStock")], ["archived", t("archived")]].map(([v, l]) => h("option", { value: v, selected: st.status === v }, l)));
      if (mode === "inventory" && !st.status) { /* keep "all" */ }
      clear(root).appendChild(h("div", {}, h("div", { class: "row", style: "margin-bottom:12px" }, h("div", { style: "flex:2;min-width:160px" }, q), h("div", { style: "flex:1;min-width:140px" }, sel),
        mode === "products" && can("products.write") ? h("button", { class: "btn primary", type: "button", onclick: () => editProduct(null, fields, load) }, "＋ " + t("add")) : null), box));
      S.refresh = load;
      load();
    };
  }
  async function patchProduct(id, body) {
    try { const r = await api("/api/store/products/" + encodeURIComponent(id), { method: "PUT", body }); toast(t("saved")); return r.item; }
    catch (e) { toast(errText(e), true); return null; }
  }
  function numInput(val, onsave, ph) {
    const inp = h("input", { class: "input", type: "number", min: "0", step: "any", value: val === null || val === undefined ? "" : val, placeholder: ph || "", style: "max-width:130px" });
    inp.addEventListener("change", () => onsave(inp.value === "" ? null : Number(inp.value), inp));
    return inp;
  }
  function productRow(it, mode, fields, reload) {
    const name = nm(it.name);
    const thumb = safeImg(it.img) ? h("img", { class: "thumb", src: safeImg(it.img), alt: "", loading: "lazy" }) : h("div", { class: "thumb" }, ico("package"));
    const nameCell = h("td", { "data-l": t("name") }, h("div", { class: "row" }, thumb, h("div", {}, h("div", { style: "font-weight:700" }, name), it.archived ? h("span", { class: "pill" }, t("archived")) : null)));
    if (mode === "pricing") {
      return h("tr", {}, nameCell, h("td", { "data-l": t("price") }, numInput(it.price, async (v, inp) => { if (v === null) return; const r = await patchProduct(it.id, { price: v }); if (!r) reload(); })),
        h("td", { "data-l": t("salePrice") }, numInput(it.salePrice, async (v) => { const r = await patchProduct(it.id, { salePrice: v === null ? "" : v }); if (!r) reload(); })));
    }
    if (mode === "inventory") {
      const av = h("input", { type: "checkbox", checked: it.isAvailable !== false, "aria-label": t("available"), onchange: async (e) => { const r = await patchProduct(it.id, { isAvailable: e.target.checked }); if (!r || (e.target.checked && r.isAvailable === false)) reload(); } });
      return h("tr", {}, nameCell, h("td", { "data-l": t("stock") }, numInput(it.stock, async (v) => { const r = await patchProduct(it.id, { stock: v === null ? "" : v }); if (!r) reload(); }, "∞")), h("td", { "data-l": t("available") }, av));
    }
    const acts = h("div", { class: "row" });
    if (can("products.write")) {
      acts.appendChild(h("button", { class: "btn sm", type: "button", onclick: () => editProduct(it, fields, reload) }, t("edit")));
      if (it.archived) acts.appendChild(h("button", { class: "btn sm", type: "button", onclick: async () => { if (await patchProduct(it.id, { archived: false })) reload(); } }, t("restore")));
      else acts.appendChild(h("button", { class: "btn sm", type: "button", onclick: async () => { if (!(await confirmBox(t("confirmArchive")))) return; try { await api("/api/store/products/" + encodeURIComponent(it.id), { method: "DELETE" }); toast(t("saved")); reload(); } catch (e) { toast(errText(e), true); } } }, t("archive")));
      if (can("products.delete")) acts.appendChild(h("button", { class: "btn sm danger", type: "button", onclick: async () => { if (!(await confirmBox(t("confirmDelete"), true))) return; try { await api("/api/store/products/" + encodeURIComponent(it.id), { method: "DELETE", query: { hard: "1" } }); toast(t("saved")); reload(); } catch (e) { toast(errText(e), true); } } }, t("del")));
    }
    const priceTxt = it.salePrice != null && it.salePrice < it.price ? `${money(it.salePrice)} (${money(it.price)})` : money(it.price);
    return h("tr", {}, nameCell, h("td", { "data-l": t("category") }, nm(it.catLabel) || it.cat || ""), h("td", { "data-l": t("price") }, priceTxt),
      h("td", { "data-l": t("stock") }, it.stock === null || it.stock === undefined ? "∞" : String(it.stock)), h("td", {}, h("div", {}, it.isAvailable === false ? h("span", { class: "pill bad" }, t("unavailable")) : null), acts));
  }

  // Resize in the browser (max 1000px, JPEG) so phone photos stay small, then upload; returns the /uploads URL
  function fileToDataUrl(file, max = 1000) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("read"));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error("decode"));
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function imagePicker(initial) {
    let value = safeImg(initial) ? initial : "";
    const prev = h("div", { class: "thumb", style: "width:84px;height:84px" });
    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "hidden" });
    const pick = h("button", { class: "btn", type: "button" });
    const del = h("button", { class: "btn danger sm", type: "button" }, t("removeImage"));
    const msg = h("span", { class: "muted" });
    function paint() {
      clear(prev);
      if (value) prev.appendChild(h("img", { src: value, alt: "", style: "width:100%;height:100%;object-fit:cover;border-radius:10px" })); else prev.appendChild(ico("package"));
      pick.textContent = value ? t("changeImage") : t("uploadImage");
      del.classList.toggle("hidden", !value);
    }
    pick.addEventListener("click", () => file.click());
    del.addEventListener("click", () => { value = ""; paint(); });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0]; if (!f) return;
      pick.disabled = true; msg.textContent = t("uploading");
      try {
        const r = await api("/api/store/upload/image", { method: "POST", body: { image: await fileToDataUrl(f) } });
        value = r.url; msg.textContent = "";
      } catch (e) {
        msg.textContent = "";
        const st = e && e.status, why = st === 404 ? "404: " + (lang === "ar" ? "الخادم لم يُحدَّث (أعد رفع server.js وأعد تشغيله)" : "serveur non mis à jour")
          : st === 413 ? "413: " + (lang === "ar" ? "الصورة كبيرة على الخادم (client_max_body_size في nginx)" : "image trop lourde pour le serveur")
          : st === 403 ? t("err_forbidden") : e && e.message ? e.message : "";
        toast(t("imageFail") + (why ? " — " + why : ""), true);
      }
      pick.disabled = false; file.value = ""; paint();
    });
    paint();
    return { el: h("div", { class: "row" }, prev, h("div", { class: "grow" }, h("div", { class: "row" }, pick, del), msg), file), get: () => value };
  }

  function editProduct(it, fields, reload) {
    const isNew = !it;
    const v = (x, d) => (x === undefined || x === null ? d : x);
    const nameAr = h("input", { class: "input", value: v(it && it.name && it.name.ar, ""), maxlength: "120" });
    const nameFr = h("input", { class: "input", value: v(it && it.name && it.name.fr, ""), maxlength: "120" });
    const desc = h("textarea", { class: "input", maxlength: "600" }); desc.value = nm(it && it.desc);
    const cat = h("input", { class: "input", value: v(it && it.cat, "general"), maxlength: "60" });
    const price = h("input", { class: "input", type: "number", min: "0", step: "any", value: v(it && it.price, "") });
    const sale = h("input", { class: "input", type: "number", min: "0", step: "any", value: v(it && it.salePrice, "") });
    const stock = h("input", { class: "input", type: "number", min: "0", step: "1", value: v(it && it.stock, "") });
    const img = imagePicker(it && it.img);
    const avail = h("input", { type: "checkbox", checked: !it || it.isAvailable !== false });
    const attrInputs = {};
    const attrBox = fields.length ? h("div", { class: "card", style: "margin-bottom:12px" }, h("div", { class: "muted", style: "margin-bottom:8px" }, t("typeFields")),
      fields.map((f) => {
        const cur = it && it.attrs ? it.attrs[f.key] : undefined;
        let inp;
        if (f.kind === "bool") inp = h("input", { type: "checkbox", checked: cur === true });
        else if (f.kind === "select") inp = h("select", { class: "input" }, h("option", { value: "" }, "—"), (f.options || []).map((o) => h("option", { value: o, selected: cur === o }, o)));
        else inp = h("input", { class: "input", type: f.kind === "number" ? "number" : "text", step: "any", value: v(cur, ""), maxlength: f.max || "" });
        attrInputs[f.key] = { inp, f };
        return h("div", { class: "field" }, h("label", { class: "f" }, nm(f.label) || f.key), inp);
      }), fields.some((f) => f.key === "requiresPrescription") ? h("p", { class: "muted" }, t("rxNote")) : null) : null;
    const body = h("div", {}, h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { class: "f" }, t("nameAr")), nameAr), h("div", { class: "field" }, h("label", { class: "f" }, t("nameFr")), nameFr)),
      h("div", { class: "field" }, h("label", { class: "f" }, t("desc")), desc), h("div", { class: "field" }, h("label", { class: "f" }, t("category")), cat),
      h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { class: "f" }, t("price") + " (MAD)"), price), h("div", { class: "field" }, h("label", { class: "f" }, t("salePrice")), sale)),
      h("div", { class: "field" }, h("label", { class: "f" }, `${t("stock")} — ${t("stockHint")}`), stock), h("div", { class: "field" }, h("label", { class: "f" }, t("image")), img.el),
      attrBox, h("label", { class: "row" }, avail, t("available")));
    modal(isNew ? t("newProduct") : t("editProduct"), body, [
      { label: t("cancel"), run: (c) => c() },
      { label: t("save"), cls: "primary", run: async (close) => {
        const ar = nameAr.value.trim(), fr = nameFr.value.trim();
        if (!ar && !fr) return toast(t("nameAr"), true);
        if (price.value === "" || Number(price.value) < 0) return toast(t("price"), true);
        const attrs = {};
        for (const [k, { inp, f }] of Object.entries(attrInputs)) {
          if (f.kind === "bool") attrs[k] = inp.checked; else if (inp.value !== "") attrs[k] = inp.value;
        }
        const payload = { name: { ar: ar || fr, fr: fr || ar }, desc: desc.value.trim(), cat: cat.value.trim() || "general", price: Number(price.value),
          salePrice: sale.value === "" ? "" : Number(sale.value), stock: stock.value === "" ? "" : Number(stock.value), img: img.get(), isAvailable: avail.checked, attrs };
        try {
          await api(isNew ? "/api/store/products" : "/api/store/products/" + encodeURIComponent(it.id), { method: isNew ? "POST" : "PUT", body: payload });
          toast(t("saved")); close(); reload();
        } catch (e) { toast(errText(e), true); }
      } },
    ]);
  }
  VIEWS.products = productView("products");
  VIEWS.pricing = productView("pricing");
  VIEWS.inventory = productView("inventory");

  /* ------------------------------ categories ------------------------------ */
  VIEWS.categories = async (root) => {
    clear(root).appendChild(skeleton(3));
    const r = await api("/api/store/categories");
    if (!r.categories.length) return clear(root).appendChild(emptyBox(ico("folder"), t("noProducts")));
    clear(root).appendChild(h("div", { class: "list" }, r.categories.map((c) => h("div", { class: "item", style: "cursor:default" },
      h("div", { class: "grow" }, h("div", { class: "t" }, nm(c.label) || c.cat), h("div", { class: "muted" }, `${c.count} ${t("products_n")}`)),
      can("products.write") ? h("button", { class: "btn sm", type: "button", onclick: () => renameCat(c) }, t("edit")) : null))));
  };
  function renameCat(c) {
    const id = h("input", { class: "input", value: c.cat, maxlength: "60" }), lab = h("input", { class: "input", value: nm(c.label) || c.cat, maxlength: "60" });
    modal(t("renameCat"), h("div", {}, h("div", { class: "field" }, h("label", { class: "f" }, t("catId")), id), h("div", { class: "field" }, h("label", { class: "f" }, t("catLabel")), lab)), [
      { label: t("cancel"), run: (x) => x() },
      { label: t("save"), cls: "primary", run: async (x) => { try { await api("/api/store/categories/" + encodeURIComponent(c.cat), { method: "PUT", body: { cat: id.value.trim(), label: lab.value.trim() } }); toast(t("saved")); x(); renderView(); } catch (e) { toast(errText(e), true); } } },
    ]);
  }

  /* ------------------------------ customers ------------------------------ */
  VIEWS.customers = async (root) => {
    clear(root).appendChild(skeleton(3));
    const r = await api("/api/store/customers");
    if (!r.customers.length) return clear(root).appendChild(emptyBox(ico("users"), t("noCustomers")));
    clear(root).appendChild(h("div", { class: "scroll-x" }, h("table", { class: "tbl resp" },
      h("thead", {}, h("tr", {}, [t("customer"), t("phone"), t("ordersN"), t("spent"), t("lastOrder"), ""].map((x) => h("th", {}, x)))),
      h("tbody", {}, r.customers.map((c) => h("tr", {}, h("td", { "data-l": t("customer") }, c.name), h("td", { "data-l": t("phone") }, h("span", { dir: "ltr" }, c.phone || "—")), h("td", { "data-l": t("ordersN") }, c.orders),
        h("td", { "data-l": t("spent") }, money(c.spent)), h("td", { "data-l": t("lastOrder") }, when(c.lastOrderAt)),
        h("td", {}, can("chat.use") ? h("button", { class: "btn sm", type: "button", onclick: () => openChatFor(c.lastOrderId) }, [ico("message"), c.unread ? ` ${c.unread}` : ""]) : null)))))));
  };

  /* ------------------------------ chat ------------------------------ */
  function openChatFor(orderId) { S.chatOrder = String(orderId); if (S.view === "chat") renderView(); else go("chat"); }
  const narrow = () => window.matchMedia("(max-width:900px)").matches;

  VIEWS.chat = async (root) => {
    const listCol = h("div", { class: "card" }), threadCol = h("div", { class: "card" });
    const wrap = h("div", { class: "chat" }, listCol, threadCol);
    clear(root).appendChild(wrap);
    const showList = !(narrow() && S.chatOrder);
    listCol.classList.toggle("hidden", !showList);
    threadCol.classList.toggle("hidden", narrow() && !S.chatOrder);

    const loadList = async () => {
      try {
        const r = await api("/api/store/chats");
        clear(listCol);
        if (!r.chats.length) return listCol.appendChild(emptyBox(ico("message"), t("noChats")));
        listCol.appendChild(h("div", { class: "list" }, r.chats.map((c) => h("div", { class: "item", role: "button", tabindex: "0", onclick: () => { S.chatOrder = String(c.orderId); renderView(); } },
          h("div", { class: "grow" }, h("div", { class: "t" }, c.customerName || `#${String(c.orderId).slice(-6)}`), h("div", { class: "muted", style: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, c.last ? c.last.text : "")),
          c.unread ? h("span", { class: "badge" }, c.unread) : null))));
      } catch (e) { showErr(listCol, e); }
    };

    const msgs = h("div", { class: "msgs" });
    // local, de-duplicated list (by id / clientId); the server is asked only for what is new (?after=)
    const TH = { msgs: [], lastId: null, name: "", sig: "", busy: false };
    const newCid = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const paint = (scroll) => {
      const last = TH.msgs[TH.msgs.length - 1];
      const sig = TH.msgs.length + "|" + (last ? last.id : "") + "|" + (last && last.pending ? "p" : "");
      if (sig === TH.sig) return;
      TH.sig = sig;
      const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
      clear(msgs);
      if (!TH.msgs.length) msgs.appendChild(h("div", { class: "empty" }, t("typeMsg")));
      TH.msgs.forEach((m) => msgs.appendChild(h("div", { class: "msg" + (m.from === "store" ? " me" : "") + (m.pending ? " pending" : "") }, m.text, h("small", {}, `${m.from === "store" ? t("you") : TH.name} · ${m.pending ? "…" : when(m.at)}`))));
      if (scroll || atBottom) msgs.scrollTop = msgs.scrollHeight;
    };
    const merge = (r) => {
      TH.name = (r.order && r.order.customerName) || TH.name;
      const pend = TH.msgs.filter((m) => m.pending);
      const list = r.reset || !TH.lastId ? [] : TH.msgs.filter((m) => !m.pending);
      const have = new Set(list.map((m) => m.id));
      for (const m of r.messages || []) if (!have.has(m.id)) { list.push(m); have.add(m.id); }
      if (r.lastId) TH.lastId = r.lastId;
      const cids = new Set(list.map((m) => m.clientId).filter(Boolean));
      TH.msgs = list.concat(pend.filter((m) => !cids.has(m.clientId)));
    };
    const loadThread = async (scroll) => {
      if (!S.chatOrder || TH.busy) return;
      TH.busy = true;
      try {
        const r = await api("/api/store/chats/" + encodeURIComponent(S.chatOrder) + (TH.lastId ? "?after=" + encodeURIComponent(TH.lastId) : ""));
        merge(r);
        paint(scroll);
        pollStats();
        return r;
      } catch (e) { if (!TH.msgs.length) clear(msgs).appendChild(h("div", { class: "empty" }, errText(e))); }
      finally { TH.busy = false; }
    };
    let failed = null;

    if (S.chatOrder) {
      const input = h("input", { class: "input", maxlength: "1000", placeholder: t("typeMsg"), onkeydown: (e) => { if (e.key === "Enter") send(); } });
      const send = async () => {
        const text = input.value.trim(); if (!text || input.disabled) return;
        input.disabled = true;
        // optimistic bubble + idempotency key: a retry of the same text can never create a second message
        const cid = failed && failed.text === text ? failed.cid : newCid();
        TH.msgs = TH.msgs.filter((m) => m.clientId !== cid);
        TH.msgs.push({ id: "pending:" + cid, clientId: cid, from: "store", text, pending: true });
        paint(true);
        try {
          const r = await api("/api/store/chats/" + encodeURIComponent(S.chatOrder), { method: "POST", body: { text, clientId: cid } });
          failed = null; input.value = "";
          TH.msgs = TH.msgs.filter((m) => m.clientId !== cid);
          if (r.message && !TH.msgs.some((m) => m.id === r.message.id)) TH.msgs.push(r.message);
          TH.sig = ""; paint(true);
          loadThread(true); loadList();
        } catch (e) {
          failed = { text, cid };
          TH.msgs = TH.msgs.filter((m) => m.clientId !== cid); TH.sig = ""; paint(false);
          toast(errText(e), true);
        }
        input.disabled = false; input.focus();
      };
      clear(threadCol).appendChild(h("div", {}, h("div", { class: "row", style: "margin-bottom:8px" },
        narrow() ? h("button", { class: "btn sm", type: "button", onclick: () => { S.chatOrder = null; renderView(); } }, "← " + t("back")) : null,
        h("b", {}, `${t("chatOrder")} #${String(S.chatOrder).slice(-6)}`)), msgs, h("div", { class: "row", style: "margin-top:8px" }, h("div", { style: "flex:1" }, input), h("button", { class: "btn primary", type: "button", onclick: send }, t("send")))));
      loadThread(true);
      viewTimers.push(setInterval(() => { if (!document.hidden) { loadThread(false); loadList(); } }, 8000));
    } else clear(threadCol).appendChild(emptyBox(ico("message"), t("chat")));
    loadList();
  };

  /* ------------------------------ notifications (derived from real counts) ------------------------------ */
  /* ------------------------------ pharmacy requests ------------------------------ */
  // The pharmacist answers a customer's medicine request (availability + price). The customer then accepts or
  // refuses; only an accepted offer becomes a real order (it then appears under "orders" and goes through the
  // normal prepare -> ready -> driver flow).
  async function fetchBlobUrl(path) {
    const headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (storeId) headers["X-Store-Id"] = storeId;
    const r = await fetch(path, { headers });
    if (!r.ok) throw new ApiError("HTTP " + r.status, r.status, {});
    return URL.createObjectURL(await r.blob());
  }
  const PH_TABS = [["pending", "phNew"], ["quoted", "phQuoted"], ["accepted", "phAccepted"], ["closed", "phClosed"], ["", "phAll"]];
  const PH_CLOSED = ["unavailable", "declined", "canceled", "expired"];
  S.ph = { tab: "pending" };

  VIEWS.pharmacy = async (root) => {
    const tabs = h("div", { class: "row", style: "gap:6px;flex-wrap:wrap;margin-bottom:10px" });
    const box = h("div", {});
    clear(root).appendChild(h("div", {}, tabs, box));
    let data = { requests: [], counts: {} };
    const countOf = (k) => (k === "" ? Object.values(data.counts).reduce((a, b) => a + b, 0) : k === "closed" ? PH_CLOSED.reduce((a, c) => a + (data.counts[c] || 0), 0) : data.counts[k] || 0);
    const draw = () => {
      clear(tabs);
      PH_TABS.forEach(([k, lbl]) => tabs.appendChild(h("button", { class: "btn sm" + (S.ph.tab === k ? " primary" : ""), type: "button", onclick: () => { S.ph.tab = k; draw(); } }, `${t(lbl)} (${countOf(k)})`)));
      const rows = data.requests.filter((r) => (S.ph.tab === "" ? true : S.ph.tab === "closed" ? PH_CLOSED.includes(r.status) : r.status === S.ph.tab));
      clear(box);
      if (!rows.length) return box.appendChild(emptyBox(ico("pill"), t("phNone")));
      box.appendChild(h("div", { class: "list" }, rows.map((r) => h("div", { class: "item", role: "button", tabindex: "0", "data-ph": r.id, onclick: () => openRequest(r.id), onkeydown: (e) => { if (e.key === "Enter") openRequest(r.id); } },
        h("div", { class: "grow" },
          h("div", { class: "t" }, `${r.id} · ${r.customer.name}`),
          h("div", { class: "muted", style: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, (r.hasPrescription ? "📎 " : "") + (r.text || t("phRx")))),
        h("div", { class: "muted" }, when(r.createdAt)),
        h("span", { class: "pill " + (r.status === "pending" ? "new" : "") }, t("ph_" + r.status))))));
    };
    const load = async () => {
      try { data = await api("/api/store/pharmacy/requests"); draw(); }
      catch (e) { if (!data.requests.length) showErr(root, e); }
    };
    S.refresh = load;
    skeletonInto(box);
    await load();
    viewTimers.push(setInterval(() => { if (!document.hidden) load(); }, 10000));

    function skeletonInto(el) { clear(el).appendChild(skeleton(3)); }

    async function openRequest(id) {
      let req;
      try { req = (await api("/api/store/pharmacy/requests/" + encodeURIComponent(id))).request; } catch (e) { return toast(errText(e), true); }
      const rxBox = h("div", { class: "muted" }, req.hasPrescription ? t("phLoadingRx") : t("phRxMissing"));
      if (req.hasPrescription) fetchBlobUrl("/api/store/pharmacy/requests/" + encodeURIComponent(id) + "/prescription")
        .then((u) => { clear(rxBox).appendChild(h("a", { href: u, target: "_blank", rel: "noopener" }, h("img", { src: u, alt: t("phRx"), style: "max-width:100%;max-height:340px;border-radius:10px" }))); })
        .catch(() => { rxBox.textContent = t("err_generic"); });

      const open = ["pending", "quoted"].includes(req.status);
      const lines = (req.quote && req.quote.available ? req.quote.lines : []).map((l) => ({ ...l }));
      if (!lines.length) lines.push({ name: "", qty: 1, price: "", note: "" });
      let available = !(req.quote && req.quote.available === false);
      const total = h("b", {}, money(0));
      const linesBox = h("div", {});
      const reason = h("textarea", { class: "input", maxlength: "500", placeholder: t("phReason") }, req.quote && !req.quote.available ? req.quote.reason : "");
      const valid = h("input", { class: "input", type: "number", min: "5", max: "240", value: "30", style: "max-width:110px" });
      const note = h("textarea", { class: "input", maxlength: "500", placeholder: t("phNoteToCustomer") });
      const calc = () => { total.textContent = money(lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)); };
      const drawLines = () => {
        clear(linesBox);
        lines.forEach((l, i) => linesBox.appendChild(h("div", { class: "row", style: "gap:6px;margin-bottom:6px;flex-wrap:wrap", "data-line": i },
          h("input", { class: "input ph-name", style: "flex:2;min-width:140px", maxlength: "120", placeholder: t("phName"), value: l.name, oninput: (e) => { l.name = e.target.value; } }),
          h("input", { class: "input ph-qty", style: "width:70px", type: "number", min: "1", max: "20", placeholder: t("phQty"), value: l.qty, oninput: (e) => { l.qty = e.target.value; calc(); } }),
          h("input", { class: "input ph-price", style: "width:100px", type: "number", min: "0", step: "0.01", placeholder: t("phPrice"), value: l.price, oninput: (e) => { l.price = e.target.value; calc(); } }),
          lines.length > 1 ? h("button", { class: "btn sm", type: "button", "aria-label": t("del"), onclick: () => { lines.splice(i, 1); drawLines(); calc(); } }, "✕") : null)));
        calc();
      };
      const formWrap = h("div", {});
      const drawForm = () => {
        clear(formWrap);
        formWrap.appendChild(h("div", { class: "row", style: "gap:6px;margin:10px 0" },
          h("button", { class: "btn sm" + (available ? " primary" : ""), type: "button", id: "phAvail", onclick: () => { available = true; drawForm(); } }, t("phAvail")),
          h("button", { class: "btn sm" + (!available ? " danger" : ""), type: "button", id: "phUnavail", onclick: () => { available = false; drawForm(); } }, t("phUnavail"))));
        if (available) {
          drawLines();
          formWrap.appendChild(linesBox);
          formWrap.appendChild(h("button", { class: "btn sm", type: "button", id: "phAddLine", onclick: () => { if (lines.length < 30) { lines.push({ name: "", qty: 1, price: "", note: "" }); drawLines(); } } }, "+ " + t("phAddLine")));
          formWrap.appendChild(h("div", { class: "row", style: "margin-top:8px;gap:10px;align-items:center" }, h("span", {}, t("phTotal") + ": "), total));
          formWrap.appendChild(h("div", { class: "row", style: "margin-top:8px;gap:8px;align-items:center" }, h("span", { class: "muted" }, t("phValid")), valid));
          formWrap.appendChild(h("div", { style: "margin-top:8px" }, note));
        } else formWrap.appendChild(reason);
      };
      drawForm();

      const body = h("div", {},
        h("div", { class: "muted" }, `${t("phCustomer")}: ${req.customer.name} · ${req.customer.phone || ""}`),
        h("div", { class: "muted" }, `${t("phAddr")}: ${req.customer.addr}`),
        h("div", { style: "margin:10px 0" }, h("b", {}, t("phText") + ": "), req.text || "—"),
        h("div", { style: "margin:10px 0" }, h("b", {}, t("phRx") + ":"), rxBox),
        req.orderId ? h("div", { class: "muted" }, `${t("phOrder")}: #${String(req.orderId).slice(-6)}`) : null,
        req.quote && req.quote.expiresAt && req.status === "quoted" ? h("div", { class: "muted" }, `${t("phExpires")}: ${when(req.quote.expiresAt)}`) : null,
        open ? formWrap : h("div", { class: "pill" }, t("ph_" + req.status)));
      const buttons = [{ label: t("close"), run: (c) => c() }];
      if (can("chat.use")) buttons.unshift({ label: t("phOpenChat"), run: (c) => { c(); openChatFor(id); } });
      if (open) buttons.push({ label: t("phSend"), cls: "primary", run: async (c) => {
        const payload = available
          ? { available: true, lines: lines.map((l) => ({ name: l.name, qty: Number(l.qty), price: Number(l.price), note: l.note })), validMinutes: Number(valid.value) || 30, note: note.value }
          : { available: false, reason: reason.value };
        try { await api("/api/store/pharmacy/requests/" + encodeURIComponent(id) + "/quote", { method: "POST", body: payload }); toast(t("phSent")); c(); pollStats(); load(); }
        catch (e) { toast(phErr(e), true); }
      } });
      modal(`${id}`, body, buttons);
    }
    function phErr(e) {
      const code = e && e.data && e.data.code;
      const m = { LINES_REQUIRED: "phName", LINE_NAME: "phName", LINE_PRICE: "phPrice", LINE_QTY: "phQty", REASON_REQUIRED: "phReason" }[code];
      return m ? t(m) + " ✗" : errText(e);
    }
  };

  VIEWS.notifications = async (root) => {
    clear(root).appendChild(skeleton(2));
    const r = await api("/api/store/stats", { query: { days: S.days } });
    const s = r.stats;
    const rows = [
      [s.newOrders, ico("bell"), t("n_new"), () => go("orders_new")], [s.unreadMessages, ico("message"), t("n_unread"), () => go("chat")],
      [s.lowStockProducts, ico("down"), t("n_low"), () => { S.prod.status = "low"; go("inventory"); }], [s.unavailableProducts, ico("ban"), t("n_unavail"), () => { S.prod.status = "unavailable"; go("products"); }],
    ].filter((x) => x[0] > 0);
    clear(root).appendChild(rows.length ? h("div", { class: "list" }, rows.map(([n, ic, label, fn]) => h("div", { class: "item", role: "button", tabindex: "0", onclick: fn }, h("div", { class: "thumb" }, ic), h("div", { class: "grow" }, h("div", { class: "t" }, `${n} ${label}`))))) : emptyBox(ico("check"), t("notifEmpty")));
  };

  /* ------------------------------ settings / hours / delivery ------------------------------ */
  async function saveSettings(body) {
    try { const r = await api("/api/store/settings", { method: "PUT", body }); toast(t("saved")); S.me.store = r.store; return true; }
    catch (e) { toast(errText(e), true); return false; }
  }
  VIEWS.settings = async (root) => {
    const s = S.me.store;
    const nameAr = h("input", { class: "input", value: (s.name && s.name.ar) || "", maxlength: "80" }), nameFr = h("input", { class: "input", value: (s.name && s.name.fr) || "", maxlength: "80" });
    const phone = h("input", { class: "input", value: s.phone || "", maxlength: "25", inputmode: "tel" }), addr = h("input", { class: "input", value: s.address || "", maxlength: "200" });
    const desc = h("textarea", { class: "input", maxlength: "500" }); desc.value = nm(s.description);
    const status = String(s.status || (s.isActive === false ? "unpublished" : "active"));
    const canPause = status === "active" || status === "paused";
    clear(root).appendChild(h("div", { class: "card", style: "max-width:640px" },
      canPause ? h("div", { class: "row", style: "margin-bottom:14px" }, h("span", { class: "pill " + (status === "paused" ? "warn" : "new") }, status === "paused" ? t("paused") : t("open")),
        h("button", { class: "btn sm", type: "button", onclick: async () => { if (await saveSettings({ status: status === "paused" ? "active" : "paused" })) renderView(); } }, status === "paused" ? t("resume") : t("pause"))) : null,
      h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { class: "f" }, t("nameAr")), nameAr), h("div", { class: "field" }, h("label", { class: "f" }, t("nameFr")), nameFr)),
      h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { class: "f" }, t("phone")), phone), h("div", { class: "field" }, h("label", { class: "f" }, t("address")), addr)),
      h("div", { class: "field" }, h("label", { class: "f" }, t("desc")), desc),
      h("button", { class: "btn primary", type: "button", onclick: async () => { const ar = nameAr.value.trim(), fr = nameFr.value.trim(); if (!ar && !fr) return toast(t("nameAr"), true);
        await saveSettings({ name: { ar: ar || fr, fr: fr || ar }, phone: phone.value.trim(), address: addr.value.trim(), description: desc.value.trim() }); } }, t("save"))));
  };

  const DAYS = [[1, "mon"], [2, "tue"], [3, "wed"], [4, "thu"], [5, "fri"], [6, "sat"], [0, "sun"]];
  VIEWS.hours = async (root) => {
    const cur = (S.me.store.hours && S.me.store.hours.days) || {};
    const rows = DAYS.map(([d, key]) => {
      const x = cur[d] || cur[String(d)] || null;
      const closed = h("input", { type: "checkbox", checked: !!(x && x.closed) });
      const open = h("input", { class: "input", type: "time", value: (x && x.open) || "" }), close = h("input", { class: "input", type: "time", value: (x && x.close) || "" });
      return { d, closed, open, close, el: h("div", { class: "hours-row" }, h("b", {}, t(key)), open, close, h("label", { class: "row" }, closed, t("closed"))) };
    });
    clear(root).appendChild(h("div", { class: "card", style: "max-width:640px" }, h("p", { class: "muted" }, t("hoursHint")), rows.map((r) => r.el),
      h("button", { class: "btn primary", type: "button", onclick: async () => {
        const days = {};
        for (const r of rows) { if (r.closed.checked) days[r.d] = { closed: true }; else if (r.open.value && r.close.value) days[r.d] = { open: r.open.value, close: r.close.value }; }
        await saveSettings({ hours: Object.keys(days).length ? { days } : null });
      } }, t("save"))));
  };

  VIEWS.delivery = async (root) => {
    const s = S.me.store;
    const mk = (label, val, step) => { const i = h("input", { class: "input", type: "number", min: "0", step: step || "any", value: val === null || val === undefined ? "" : val }); return { i, el: h("div", { class: "field" }, h("label", { class: "f" }, label), i) }; };
    const a = mk(t("minOrder") + " (MAD)", s.minOrder), b = mk(t("deliveryFee") + " (MAD)", s.deliveryFee), c = mk(t("freeOver") + " (MAD)", s.freeDeliveryOver), d = mk(t("avgMin"), s.avgDeliveryMin, "1");
    clear(root).appendChild(h("div", { class: "card", style: "max-width:520px" }, a.el, b.el, c.el, d.el,
      h("button", { class: "btn primary", type: "button", onclick: () => saveSettings({ minOrder: a.i.value === "" ? 0 : Number(a.i.value), deliveryFee: b.i.value === "" ? 0 : Number(b.i.value), freeDeliveryOver: c.i.value === "" ? null : Number(c.i.value), avgDeliveryMin: d.i.value === "" ? 30 : Number(d.i.value) }) }, t("save"))));
  };

  VIEWS.members = async (root) => {
    clear(root).appendChild(skeleton(3));
    const r = await api("/api/store/members");
    const canWrite = S.me.role === "owner";
    const list = h("div", { class: "list" });
    const roleSel = (cur) => h("select", { class: "input" }, r.assignableRoles.map((k) => h("option", { value: k, selected: k === cur }, t("role_" + k))));
    const act = async (id, body) => { try { await api("/api/store/members/" + encodeURIComponent(id), { method: "PATCH", body }); toast(t("saved")); renderView(); } catch (e) { toast(errText(e), true); } };
    r.members.forEach((m) => {
      const protectedRow = !canWrite || m.role === "owner" || String(m.id) === String(S.me.userId || "");
      list.appendChild(h("div", { class: "item" },
        h("div", { class: "grow" }, h("div", { class: "t" }, m.email || m.phone || "—"), h("div", { class: "muted" }, `${t("role_" + m.role)}${m.isActive ? "" : " · " + t("memInactive")}`)),
        protectedRow ? null : h("div", { class: "row" },
          h("button", { class: "btn sm", type: "button", onclick: () => act(m.id, { isActive: !m.isActive }) }, m.isActive ? t("memDisable") : t("memEnable")),
          h("button", { class: "btn sm", type: "button", onclick: () => act(m.id, { role: m.role === "manager" ? "cashier" : "manager" }) }, t("role_" + (m.role === "manager" ? "cashier" : "manager"))),
          h("button", { class: "btn sm", type: "button", onclick: () => { const inp = h("input", { class: "input", type: "password", autocomplete: "new-password" }); modal(t("memReset"), h("div", { class: "field" }, inp), [
            { label: t("cancel"), run: (c) => c() },
            { label: t("save"), cls: "primary", run: async (c) => { if (inp.value.length < 8) return toast(t("memPass"), true); c(); act(m.id, { password: inp.value }); } }]); } }, t("memReset")))));
    });
    if (!r.members.length) list.appendChild(emptyBox(ico("users"), t("memNone")));
    const parts = [h("p", { class: "muted" }, t("memNote")), list];
    if (canWrite) {
      const email = h("input", { class: "input", type: "email", autocomplete: "off" });
      const phone = h("input", { class: "input", type: "tel", autocomplete: "off" });
      const pass = h("input", { class: "input", type: "password", autocomplete: "new-password" });
      const role = roleSel("cashier");
      parts.push(h("div", { class: "card", style: "max-width:520px;margin-top:16px" }, h("h3", { style: "margin:0 0 8px" }, t("memAdd")),
        h("div", { class: "field" }, h("label", { class: "f" }, t("memEmail")), email), h("div", { class: "field" }, h("label", { class: "f" }, t("memPhone")), phone),
        h("div", { class: "field" }, h("label", { class: "f" }, t("memPass")), pass), h("div", { class: "field" }, h("label", { class: "f" }, t("memRole")), role),
        h("button", { class: "btn primary", type: "button", onclick: async () => {
          if (!email.value.trim() && !phone.value.trim()) return toast(t("memNeedContact"), true);
          try { await api("/api/store/members", { method: "POST", body: { email: email.value.trim(), phone: phone.value.trim(), password: pass.value, role: role.value } }); toast(t("saved")); renderView(); } catch (e) { toast(errText(e), true); }
        } }, t("memAdd"))));
    }
    clear(root).appendChild(h("div", {}, parts));
  };

  VIEWS.feedback = async (root) => {
    // Ratings (stars + PUBLISHED comments only) and complaints routed to THIS store. The server filters everything by store.
    const FB = { open: null, busy: false };
    const list = h("div", { class: "list" }), top = h("div", { class: "card", style: "margin-bottom:12px" }), box = h("div", { class: "card" });
    clear(root).appendChild(h("div", { style: "max-width:760px" }, top, box));
    const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
    const drawTop = (r) => {
      clear(top).appendChild(h("h3", { style: "margin:0 0 6px" }, t("fb_rating")));
      top.appendChild(h("div", { id: "fbAvg", style: "font-size:1.4rem;font-weight:800" }, r.rating.count ? stars(r.rating.avg) + "  " + r.rating.avg + " / 5  (" + r.rating.count + " " + t("fb_count") + ")" : "—"));
      top.appendChild(h("h3", { style: "margin:14px 0 6px" }, t("fb_reviews")));
      if (!r.reviews.length) top.appendChild(h("div", { class: "muted" }, t("fb_noReviews")));
      r.reviews.forEach((v) => top.appendChild(h("div", { class: "item", style: "display:block" }, h("div", {}, stars(v.stars) + (v.name ? " • " + v.name : "")), v.comment ? h("div", {}, v.comment) : null, h("div", { class: "muted" }, when(v.at)))));
    };
    const drawList = (cs) => {
      clear(box).appendChild(h("h3", { style: "margin:0 0 8px" }, t("fb_complaints")));
      if (!cs.length) return box.appendChild(h("div", { class: "muted", id: "fbNone" }, t("fb_none")));
      box.appendChild(h("div", { class: "list" }, cs.map((c) => h("button", { class: "item", type: "button", "data-cp": c.id, style: "text-align:start;width:100%", onclick: () => showOne(c.id) },
        h("div", { class: "grow" }, h("div", { class: "t" }, c.id + " • " + t("fb_cat_" + c.category) + " • #" + c.orderId), h("div", { class: "muted" }, when(c.updatedAt))),
        h("span", { class: "pill" }, t("fb_st_" + c.status))))));
    };
    const load = async () => {
      const [fb, cp] = await Promise.all([api("/api/store/feedback"), api("/api/store/complaints")]);
      drawTop(fb); drawList(cp.complaints || []);
    };
    async function showOne(id) {
      const c = (await api("/api/store/complaints/" + encodeURIComponent(id))).complaint;
      clear(box).appendChild(h("button", { class: "btn sm", type: "button", onclick: () => load().catch(() => {}) }, "← " + t("fb_back")));
      box.appendChild(h("h3", { style: "margin:10px 0 4px" }, c.id + " • " + t("fb_st_" + c.status)));
      box.appendChild(h("div", { class: "muted" }, t("fb_cat_" + c.category) + " • #" + c.orderId));
      box.appendChild(h("p", {}, c.text));
      if (c.status === "with_party" && c.respondBy) box.appendChild(h("div", { class: "muted" }, t("fb_deadline") + " " + when(c.respondBy)));
      box.appendChild(h("h4", { style: "margin:10px 0 4px" }, t("fb_tl")));
      box.appendChild(h("div", { class: "list" }, (c.timeline || []).map((e) => h("div", { class: "item", style: "display:block" }, h("div", { class: "muted" }, t("fb_who_" + e.role) + " • " + when(e.at)), e.text && !["routed", "escalated", "auto_escalated"].includes(e.kind) ? h("div", {}, e.text) : null))));
      if (c.status === "with_party") {
        const ta = h("textarea", { class: "input", rows: "4", maxlength: "1000", placeholder: t("fb_answerHint"), id: "fbAnswer" });
        const btn = h("button", { class: "btn primary", type: "button", id: "fbSend", onclick: async () => {
          if (FB.busy) return; FB.busy = true; btn.disabled = true;
          try { await api("/api/store/complaints/" + encodeURIComponent(id) + "/respond", { method: "POST", body: { text: ta.value } }); toast(t("fb_sent")); await showOne(id); }
          catch (e) { toast(errText(e), true); } finally { FB.busy = false; btn.disabled = false; }
        } }, t("fb_send"));
        box.appendChild(h("div", { style: "margin-top:10px;display:grid;gap:8px" }, h("label", {}, t("fb_answer")), ta, btn));
      } else if (c.resolution) box.appendChild(h("p", { class: "muted" }, t("fb_closed") + ": " + c.resolution.outcome));
    }
    S.refresh = () => { if (!FB.busy && !box.querySelector("#fbAnswer")) load().catch(() => {}); };
    await load();
  };

  VIEWS.help = async (root) => {
    // Integrated support: approved contact channels (managed in the admin panel) + tickets with the admin team.
    const SP = { channels: [], tickets: [], open: null, TH: { msgs: [], lastId: null, status: "open", busy: false, sig: "" }, cid: null, failed: null };
    const chBox = h("div", { class: "card", style: "margin-bottom:12px" }), tkBox = h("div", { class: "card" });
    clear(root).appendChild(h("div", { style: "max-width:760px" }, h("p", { class: "muted", style: "margin:0 0 10px" }, t("helpText")), chBox, tkBox));
    const catLabel = (c) => t("sp_cat_" + c);
    const stLabel = (s) => t(s === "closed" ? "sp_closed" : s === "answered" ? "sp_answered" : "sp_open");
    const L = () => (lang === "fr" ? "fr" : "ar");
    const spErr = (e) => { const c = e && e.data && e.data.code; return c === "TOO_MANY_OPEN" ? t("sp_tooMany") : c === "SUBJECT_REQUIRED" || c === "TEXT_REQUIRED" ? t("sp_needSubject") : errText(e); };

    const drawChannels = () => {
      clear(chBox).appendChild(h("h3", { style: "margin:0 0 8px" }, t("sp_channels")));
      if (!SP.channels.length) return chBox.appendChild(h("div", { class: "muted", id: "spNoCh" }, t("sp_noChannels")));
      chBox.appendChild(h("div", { class: "list", id: "spChannels" }, SP.channels.map((c) => h("a", { class: "item", href: c.href, target: c.kind === "phone" || c.kind === "email" ? "_self" : "_blank", rel: "noopener noreferrer", "data-ch": c.id, style: "text-decoration:none;color:inherit" },
        h("div", { class: "grow" }, h("div", { class: "t" }, (c.label && (c.label[L()] || c.label.ar)) || c.value), h("div", { class: "muted", style: "direction:ltr;text-align:start" }, c.value + (c.hours ? " · " + t("sp_hours") + ": " + c.hours : ""))),
        h("span", { class: "pill" }, t("sp_kind_" + c.kind))))));
    };

    // The new-ticket form is built ONCE and re-attached, so the 8 s refresh never wipes what the user is typing.
    const subject = h("input", { class: "input", id: "spSubject", maxlength: "120", placeholder: t("sp_subject") });
    const cat = h("select", { class: "input", id: "spCat", "aria-label": t("sp_category") }, ["orders", "products", "payments", "technical", "account", "other"].map((c) => h("option", { value: c }, catLabel(c))));
    const text = h("textarea", { class: "input", id: "spText", maxlength: "2000", placeholder: t("sp_message"), style: "min-height:80px" });
    const createBtn = h("button", { class: "btn primary", type: "button", id: "spCreate" }, t("sp_send"));
    createBtn.addEventListener("click", async () => {
      if (createBtn.disabled) return;
      if (subject.value.trim().length < 3 || !text.value.trim()) return toast(t("sp_needSubject"), true);
      createBtn.disabled = true;
      SP.cid = SP.cid || "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);   // a retry after a lost answer never opens a second ticket
      try {
        const r = await api("/api/store/support/tickets", { method: "POST", body: { subject: subject.value, category: cat.value, text: text.value, clientId: SP.cid } });
        SP.cid = null; subject.value = ""; text.value = ""; toast(t("sp_sent")); SP.open = r.ticket.id; SP.TH = { msgs: [], lastId: null, status: "open", busy: false, sig: "" }; await loadList(); drawThread();
      } catch (e) { toast(spErr(e), true); }
      createBtn.disabled = false;
    });
    const listBox = h("div", {});
    const drawTickets = () => {
      clear(listBox);
      if (!SP.tickets.length) return listBox.appendChild(h("div", { class: "muted", id: "spNone" }, t("sp_none")));
      listBox.appendChild(h("div", { class: "list", id: "spTickets" }, SP.tickets.map((k) => h("div", { class: "item", role: "button", tabindex: "0", "data-tk": k.id,
        onclick: () => { SP.open = k.id; SP.TH = { msgs: [], lastId: null, status: k.status, busy: false, sig: "" }; drawThread(); },
        onkeydown: (e) => { if (e.key === "Enter") e.currentTarget.click(); } },
        h("div", { class: "grow" }, h("div", { class: "t" }, `${k.id} · ${k.subject}`), h("div", { class: "muted", style: "overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, k.preview)),
        k.unread ? h("span", { class: "badge" }, k.unread) : null, h("span", { class: "pill " + (k.status === "open" ? "new" : "") }, stLabel(k.status))))));
    };
    const drawList = () => {
      clear(tkBox);
      tkBox.appendChild(h("h3", { style: "margin:0 0 8px" }, t("sp_new")));
      tkBox.appendChild(h("div", { class: "field" }, subject)); tkBox.appendChild(h("div", { class: "field" }, cat)); tkBox.appendChild(h("div", { class: "field" }, text)); tkBox.appendChild(createBtn);
      tkBox.appendChild(h("h3", { style: "margin:16px 0 8px" }, t("sp_tickets")));
      tkBox.appendChild(listBox); drawTickets();
    };

    const msgsBox = h("div", { class: "msgs", id: "spMsgs" });
    const paint = (scroll) => {
      const TH = SP.TH, last = TH.msgs[TH.msgs.length - 1];
      const sig = TH.msgs.length + "|" + (last ? last.id : "") + "|" + (last && last.pending ? "p" : "");
      if (sig === TH.sig) return; TH.sig = sig;
      const atBottom = msgsBox.scrollHeight - msgsBox.scrollTop - msgsBox.clientHeight < 60;
      clear(msgsBox);
      TH.msgs.forEach((m) => msgsBox.appendChild(h("div", { class: "msg" + (m.from === "store" ? " me" : "") + (m.pending ? " pending" : "") }, m.text, h("small", {}, `${m.from === "store" ? t("sp_you") : t("sp_admin")} · ${m.pending ? "…" : when(m.at)}`))));
      if (scroll || atBottom) msgsBox.scrollTop = msgsBox.scrollHeight;
    };
    const merge = (r) => {
      const TH = SP.TH, pend = TH.msgs.filter((m) => m.pending);
      const list = r.reset || !TH.lastId ? [] : TH.msgs.filter((m) => !m.pending);
      const have = new Set(list.map((m) => m.id));
      for (const m of r.messages || []) if (!have.has(m.id)) { list.push(m); have.add(m.id); }
      if (r.lastId) TH.lastId = r.lastId;
      TH.status = r.ticket ? r.ticket.status : TH.status;
      TH.msgs = list.concat(pend.filter((m) => !list.some((x) => x.clientId && x.clientId === m.clientId)));
    };
    const loadThread = async (scroll) => {
      const TH = SP.TH, id = SP.open; if (!id || TH.busy) return; TH.busy = true;
      try {
        const r = await api("/api/store/support/tickets/" + encodeURIComponent(id) + (TH.lastId ? "?after=" + encodeURIComponent(TH.lastId) : ""));
        if (id !== SP.open) return;
        merge(r); paint(scroll); pollStats();
        if (statusEl) statusEl.textContent = stLabel(TH.status);
        if (composer) composer.style.display = TH.status === "closed" ? "none" : "";
        if (closedNote) closedNote.hidden = TH.status !== "closed";
      } catch (e) { if (!TH.msgs.length) clear(msgsBox).appendChild(h("div", { class: "empty" }, errText(e))); }
      finally { TH.busy = false; }
    };
    let statusEl = null, composer = null, closedNote = null;
    const drawThread = () => {
      if (!SP.open) { SP.TH.sig = ""; return drawList(); }
      clear(tkBox);
      const k = SP.tickets.find((x) => x.id === SP.open);
      statusEl = h("span", { class: "pill", id: "spStatus" }, stLabel(SP.TH.status));
      const input = h("input", { class: "input", id: "spInput", maxlength: "2000", placeholder: t("sp_typeMsg"), onkeydown: (e) => { if (e.key === "Enter") sendMsg(); } });
      const sendMsg = async () => {
        const text = input.value.trim(); if (!text || input.disabled) return; input.disabled = true;
        const cid = SP.failed && SP.failed.text === text ? SP.failed.cid : "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);   // optimistic bubble + idempotency key
        SP.TH.msgs = SP.TH.msgs.filter((m) => m.clientId !== cid); SP.TH.msgs.push({ id: "pending:" + cid, clientId: cid, from: "store", text, pending: true }); paint(true);
        try {
          const r = await api("/api/store/support/tickets/" + encodeURIComponent(SP.open) + "/messages", { method: "POST", body: { text, clientId: cid } });
          SP.failed = null; input.value = ""; SP.TH.msgs = SP.TH.msgs.filter((m) => m.clientId !== cid);
          if (r.message && !SP.TH.msgs.some((m) => m.id === r.message.id)) SP.TH.msgs.push(r.message);
          SP.TH.sig = ""; paint(true); loadThread(true);
        } catch (e) { SP.failed = { text, cid }; SP.TH.msgs = SP.TH.msgs.filter((m) => m.clientId !== cid); SP.TH.sig = ""; paint(false); toast(spErr(e), true); }
        input.disabled = false; input.focus();
      };
      composer = h("div", { class: "row", style: "margin-top:8px", id: "spComposer" }, h("div", { style: "flex:1" }, input), h("button", { class: "btn primary", type: "button", id: "spSend", onclick: sendMsg }, t("sp_send")));
      closedNote = h("div", { class: "muted", style: "margin-top:8px", id: "spClosedNote", hidden: "" }, t("sp_closedNote"));
      tkBox.appendChild(h("div", { class: "row", style: "margin-bottom:8px;gap:8px;flex-wrap:wrap" },
        h("button", { class: "btn sm", type: "button", id: "spBack", onclick: () => { SP.open = null; SP.TH.sig = ""; loadList().then(drawList); } }, "← " + t("sp_back")),
        h("b", { style: "flex:1" }, k ? `${k.id} · ${k.subject}` : SP.open), statusEl,
        h("button", { class: "btn sm", type: "button", id: "spCloseTk", onclick: async () => { try { await api("/api/store/support/tickets/" + encodeURIComponent(SP.open) + "/close", { method: "POST", body: {} }); SP.TH.sig = ""; await loadThread(false); loadList(); } catch (e) { toast(spErr(e), true); } } }, t("sp_close"))));
      tkBox.appendChild(msgsBox); tkBox.appendChild(composer); tkBox.appendChild(closedNote);
      SP.TH.sig = ""; clear(msgsBox); loadThread(true);
    };

    const loadList = async () => {
      try { const r = await api("/api/store/support/tickets"); SP.tickets = r.tickets || []; if (!SP.open) drawTickets(); }
      catch (e) { if (!SP.tickets.length && !SP.open) showErr(tkBox, e); }
    };
    S.refresh = async () => { await loadList(); if (SP.open) await loadThread(false); };
    try { SP.channels = (await api("/api/store/support/channels")).channels || []; } catch (_e) { SP.channels = []; }
    drawChannels(); drawList();
    await loadList();
    viewTimers.push(setInterval(() => { if (document.hidden) return; if (SP.open) loadThread(false); loadList(); }, 8000));
    viewTimers.push(setInterval(() => { if (document.hidden) return; api("/api/store/support/channels").then((r) => { const a = JSON.stringify(r.channels || []); if (a !== JSON.stringify(SP.channels)) { SP.channels = r.channels || []; drawChannels(); } }).catch(() => {}); }, 60000));
  };

  /* ------------------------------ theme / lang ------------------------------ */
  function applyTheme() { document.documentElement.setAttribute("data-theme", localStorage.getItem(THEME_KEY) || "dark"); }
  function toggleTheme() { localStorage.setItem(THEME_KEY, (localStorage.getItem(THEME_KEY) || "dark") === "dark" ? "light" : "dark"); applyTheme(); }
  function toggleLang() {
    lang = lang === "ar" ? "fr" : "ar"; localStorage.setItem(LANG_KEY, lang);
    if (S.me) renderShell(); else if (token) renderPicker(JSON.parse(localStorage.getItem(LIST_KEY) || "[]")); else renderLogin();
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) pollStats(); });
  document.addEventListener("click", () => { try { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); } catch (_e) {} }, { once: true });
  applyTheme();
  boot();
})();
