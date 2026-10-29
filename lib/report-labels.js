"use strict";
/**
 * Report labels in Arabic / French / English, used by the JSON API (so every client shows the same wording) and by
 * the Excel / CSV / PDF / print exports. Each entry is [ar, fr, en]. An unknown code falls back to the raw code —
 * a label can never hide a value.
 */
const IDX = { ar: 0, fr: 1, en: 2 };
const pick = (tuple, lang) => tuple[IDX[lang] != null ? IDX[lang] : 2];

const TITLE = {
  sales: ["المبيعات والإيرادات", "Ventes et revenus", "Sales and revenue"],
  "order-financials": ["التفصيل المالي لكل طلب", "Détail financier par commande", "Per-order financial breakdown"],
  commissions: ["العمولات ومستحقات المتاجر", "Commissions et soldes des commerces", "Commissions and business balances"],
  settlements: ["تسويات المتاجر", "Règlements des commerces", "Business settlements"],
  payments: ["الدفع والمحفظة والاسترجاع", "Paiements, portefeuille et remboursements", "Payments, wallet and refunds"],
  drivers: ["أداء السائقين", "Performance des livreurs", "Driver performance"],
  "driver-earnings": ["أرباح السائقين", "Gains des livreurs", "Driver earnings"],
  exceptions: ["الطلبات الملغاة والمرفوضة والمتأخرة والفاشلة", "Commandes annulées, refusées, en retard ou échouées", "Cancelled, rejected, delayed and failed orders"],
  comparison: ["مقارنة المتاجر والسائقين", "Comparaison commerces et livreurs", "Stores and drivers comparison"],
  reconcile: ["مطابقة التقارير مع السجلات", "Rapprochement avec les enregistrements", "Reconciliation with source records"],
};

const TABLE = {
  sales: ["حسب الفترة", "Par période", "By period"],
  orders: ["الطلبات", "Commandes", "Orders"],
  commissions: ["حسب المتجر", "Par commerce", "By business"],
  settlements: ["التسويات", "Règlements", "Settlements"],
  byMethod: ["حسب طريقة الدفع", "Par moyen de paiement", "By payment method"],
  walletMovements: ["حركات المحافظ", "Mouvements des portefeuilles", "Wallet movements"],
  topups: ["طلبات الشحن بالتحويل", "Recharges par virement", "Transfer top-ups"],
  refunds: ["الاسترجاع", "Remboursements", "Refunds"],
  consistency: ["اتساق أرصدة المحافظ", "Cohérence des soldes", "Wallet balance consistency"],
  drivers: ["السائقون", "Livreurs", "Drivers"],
  driverEarnings: ["حسب الفترة", "Par période", "By period"],
  byCategory: ["حسب النوع", "Par catégorie", "By category"],
  byReason: ["حسب السبب", "Par motif", "By reason"],
  exceptionOrders: ["تفاصيل الطلبات", "Détail des commandes", "Order details"],
  cases: ["حالات مركز الاستثناءات", "Cas du centre d'exceptions", "Exception-center cases"],
  storesComparison: ["ترتيب المتاجر", "Classement des commerces", "Business ranking"],
  byStoreType: ["حسب نوع النشاط", "Par type d'activité", "By business type"],
  driversComparison: ["ترتيب السائقين", "Classement des livreurs", "Driver ranking"],
  checks: ["الفحوص", "Contrôles", "Checks"],
  issues: ["الحالات المخالفة", "Écarts détectés", "Detected issues"],
};

const COLUMN = {
  period: ["الفترة", "Période", "Period"], placed: ["الطلبات المقدّمة", "Commandes passées", "Orders placed"],
  delivered: ["المسلّمة", "Livrées", "Delivered"], canceled: ["الملغاة", "Annulées", "Canceled"],
  goods: ["قيمة البضاعة", "Marchandises", "Goods"], deliveryFees: ["رسوم التوصيل", "Frais de livraison", "Delivery fees"],
  discounts: ["الخصومات", "Remises", "Discounts"], total: ["إجمالي الفاتورة", "Total facturé", "Total billed"],
  avgOrder: ["متوسط الطلب", "Panier moyen", "Average order"], commission: ["العمولة", "Commission", "Commission"],
  businessNet: ["صافي مستحق المتجر", "Net dû au commerce", "Business net"], driverEarnings: ["أرباح السائقين", "Gains livreurs", "Driver earnings"],
  platformNet: ["صافي المنصة", "Net plateforme", "Platform net"], orderId: ["رقم الطلب", "N° commande", "Order ID"],
  date: ["التاريخ", "Date", "Date"], store: ["المتجر", "Commerce", "Business"], status: ["الحالة", "Statut", "Status"],
  paymentMethod: ["طريقة الدفع", "Paiement", "Payment"], subtotal: ["البضاعة", "Marchandises", "Goods"],
  deliveryFee: ["رسوم التوصيل", "Livraison", "Delivery fee"], discount: ["الخصم", "Remise", "Discount"],
  walletPaid: ["مدفوع من المحفظة", "Payé par portefeuille", "Paid from wallet"], cashDue: ["نقداً عند التسليم", "Espèces à la livraison", "Cash on delivery"],
  driverEarning: ["حصة السائق", "Part du livreur", "Driver share"], margin: ["هامش التوصيل", "Marge livraison", "Delivery margin"],
  basis: ["مصدر الأرقام", "Source des chiffres", "Figures basis"], finStatus: ["الحالة المالية", "Statut financier", "Financial status"],
  rule: ["قاعدة العمولة الحالية", "Règle de commission actuelle", "Current commission rule"], orders: ["الطلبات", "Commandes", "Orders"],
  cashOrders: ["طلبات نقدية", "Commandes en espèces", "Cash orders"], settled: ["صافي المدفوع (تسويات)", "Réglé (net)", "Settled (net)"],
  balance: ["الرصيد المستحق للمتجر", "Solde dû au commerce", "Balance owed to business"], legacyOrders: ["طلبات قديمة بلا لقطة", "Anciennes commandes sans instantané", "Legacy orders (no snapshot)"],
  reference: ["المرجع", "Référence", "Reference"], direction: ["الاتجاه", "Sens", "Direction"], amount: ["المبلغ", "Montant", "Amount"],
  voidReason: ["سبب الإلغاء", "Motif d'annulation", "Void reason"], note: ["ملاحظة", "Note", "Note"], method: ["طريقة الدفع", "Moyen de paiement", "Method"],
  walletType: ["نوع المحفظة", "Type de portefeuille", "Wallet"], type: ["نوع الحركة", "Type de mouvement", "Entry type"],
  entries: ["عدد الحركات", "Mouvements", "Entries"], credits: ["دائن", "Crédits", "Credits"], debits: ["مدين", "Débits", "Debits"], net: ["الصافي", "Net", "Net"],
  requests: ["الطلبات", "Demandes", "Requests"], kind: ["النوع", "Type", "Kind"], count: ["العدد", "Nombre", "Count"],
  wallets: ["المحافظ", "Portefeuilles", "Wallets"], mismatched: ["غير متطابقة", "Écarts", "Mismatched"], diff: ["الفرق", "Écart", "Difference"],
  rank: ["الترتيب", "Rang", "Rank"], driver: ["السائق", "Livreur", "Driver"], driverStatus: ["حالة الحساب", "Statut du compte", "Account status"],
  km: ["كم", "Km", "Km"], avgDeliveryMin: ["متوسط التوصيل (د)", "Livraison moy. (min)", "Avg delivery (min)"],
  avgRating: ["متوسط التقييم", "Note moyenne", "Avg rating"], ratings: ["عدد التقييمات", "Évaluations", "Ratings"],
  earnings: ["الأرباح", "Gains", "Earnings"], cash: ["النقد المحصَّل", "Espèces encaissées", "Cash collected"], walletBalance: ["رصيد المحفظة", "Solde portefeuille", "Wallet balance"],
  deliveries: ["التوصيلات", "Livraisons", "Deliveries"], avgEarning: ["متوسط الربح", "Gain moyen", "Avg earning"],
  category: ["النوع", "Catégorie", "Category"], share: ["النسبة", "Part", "Share"], reason: ["السبب", "Motif", "Reason"], detail: ["تفصيل", "Détail", "Detail"],
  caseType: ["نوع الحالة", "Type de cas", "Case type"], caseStatus: ["حالة المعالجة", "Statut du cas", "Case status"],
  storeType: ["نوع النشاط", "Activité", "Business type"], cancelRate: ["نسبة الإلغاء", "Taux d'annulation", "Cancel rate"],
  avgPrepMin: ["متوسط التحضير (د)", "Préparation moy. (min)", "Avg prep (min)"], stores: ["المتاجر", "Commerces", "Businesses"],
  check: ["الفحص", "Contrôle", "Check"], expected: ["المتوقع", "Attendu", "Expected"], actual: ["الفعلي", "Réel", "Actual"], ref: ["المرجع", "Référence", "Reference"],
};

const ENUM = {
  status: {
    new: ["جديد", "Nouvelle", "New"], admin_accepted: ["مقبول من الإدارة", "Acceptée (plateforme)", "Accepted by platform"], restaurant_ready: ["جاهز", "Prête", "Ready"],
    accepted: ["مع السائق", "Prise en charge", "Driver assigned"], picked_up: ["تم الاستلام", "Récupérée", "Picked up"], on_the_way: ["في الطريق", "En route", "On the way"],
    sent: ["أُرسل", "Envoyée", "Sent"], delivered: ["مُسلَّم", "Livrée", "Delivered"], done: ["منتهٍ", "Terminée", "Done"], canceled: ["ملغى", "Annulée", "Canceled"],
    cancelled: ["ملغى", "Annulée", "Cancelled"], failed_delivery: ["فشل التسليم", "Livraison échouée", "Failed delivery"],
  },
  method: { cod: ["نقداً عند التسليم", "Espèces à la livraison", "Cash on delivery"], wallet: ["محفظة سيمون", "Portefeuille SIYMON", "SIYMON wallet"], card: ["بطاقة", "Carte", "Card"], transfer: ["تحويل", "Virement", "Transfer"] },
  basis: { snapshot: ["لقطة وقت الطلب", "Instantané à la commande", "Order-time snapshot"], legacy: ["طلب قديم (بلا لقطة)", "Ancienne commande", "Legacy (no snapshot)"] },
  finStatus: { open: ["مفتوح", "Ouvert", "Open"], final: ["نهائي", "Final", "Final"], void: ["ملغى", "Annulé", "Void"], "": ["—", "—", "—"] },
  direction: { to_store: ["للمتجر", "Vers le commerce", "To business"], from_store: ["من المتجر", "Du commerce", "From business"] },
  settlementStatus: { recorded: ["مسجّلة", "Enregistré", "Recorded"], void: ["ملغاة", "Annulé", "Void"] },
  walletType: { customer: ["زبون", "Client", "Customer"], driver: ["سائق", "Livreur", "Driver"] },
  entry: {
    topup: ["شحن", "Recharge", "Top-up"], order_payment: ["دفع طلب", "Paiement de commande", "Order payment"], order_refund: ["استرجاع طلب", "Remboursement", "Order refund"],
    order_deduct: ["خصم طلب (سائق)", "Prélèvement commande", "Order charge (driver)"], adjustment: ["تعديل إداري", "Ajustement", "Adjustment"], reward: ["مكافأة", "Récompense", "Reward"],
  },
  topupStatus: { pending: ["قيد المراجعة", "En attente", "Pending"], approved: ["مقبول", "Approuvé", "Approved"], rejected: ["مرفوض", "Rejeté", "Rejected"], failed: ["فاشل", "Échoué", "Failed"] },
  refundKind: { completed: ["مكتمل (في الدفتر)", "Effectué (au registre)", "Completed (in ledger)"], pending: ["مستحق ولم يُرد بعد", "Dû, pas encore remboursé", "Owed, not yet refunded"] },
  driverStatus: { pending: ["قيد المراجعة", "En attente", "Pending"], approved: ["معتمد", "Approuvé", "Approved"], rejected: ["مرفوض", "Rejeté", "Rejected"], suspended: ["موقوف", "Suspendu", "Suspended"], "": ["—", "—", "—"] },
  category: {
    canceled_customer: ["إلغاء من الزبون", "Annulée par le client", "Canceled by customer"], rejected_store: ["رفض المتجر", "Refusée par le commerce", "Rejected by business"],
    canceled_admin: ["إلغاء من الإدارة", "Annulée par la plateforme", "Canceled by platform"], canceled_driver: ["إلغاء من السائق", "Annulée par le livreur", "Canceled by driver"],
    canceled_other: ["إلغاء (جهة غير مسجّلة)", "Annulée (auteur inconnu)", "Canceled (actor not recorded)"], delayed_preparation: ["تأخر التحضير", "Préparation en retard", "Delayed preparation"],
    failed_delivery: ["فشل التسليم", "Livraison échouée", "Failed delivery"],
  },
  caseType: {
    delayed_preparation: ["تأخر التحضير", "Préparation en retard", "Delayed preparation"], rejected_order: ["طلب مرفوض", "Commande refusée", "Rejected order"], unassigned_order: ["طلب بلا سائق", "Sans livreur", "Unassigned order"],
    driver_failure: ["تعثّر السائق", "Défaillance livreur", "Driver failure"], failed_delivery: ["فشل التسليم", "Livraison échouée", "Failed delivery"], cancel_refund_request: ["طلب إلغاء/استرجاع", "Annulation/remboursement", "Cancel / refund request"],
    complaint_dispute: ["شكوى/نزاع", "Réclamation/litige", "Complaint / dispute"], payment_error: ["خطأ دفع/مطابقة", "Erreur de paiement", "Payment / reconciliation error"],
  },
  caseStatus: { open: ["مفتوحة", "Ouvert", "Open"], in_progress: ["قيد المعالجة", "En cours", "In progress"], escalated: ["مُصعَّدة", "Escaladé", "Escalated"], resolved: ["محلولة", "Résolu", "Resolved"] },
  storeType: { restaurant: ["مطعم", "Restaurant", "Restaurant"], grocery: ["بقالة", "Épicerie", "Grocery"], pharmacy: ["صيدلية", "Pharmacie", "Pharmacy"] },
  check: {
    totalVsPerOrder: ["إجمالي الفواتير = مجموع الطلبات", "Total facturé = somme des commandes", "Billed total = sum of orders"],
    totalVsPeriods: ["إجمالي الفواتير = مجموع الفترات", "Total facturé = somme des périodes", "Billed total = sum of periods"],
    goodsVsStores: ["البضاعة = مجموع المتاجر", "Marchandises = somme des commerces", "Goods = sum of businesses"],
    commissionVsStores: ["العمولات = مجموع المتاجر", "Commissions = somme des commerces", "Commission = sum of businesses"],
    orderIntegrity: ["سلامة أرقام كل طلب ولقطته", "Cohérence de chaque commande et instantané", "Each order and its snapshot are consistent"],
    walletVsOrders: ["مدفوعات المحفظة موجودة في الدفتر", "Paiements portefeuille présents au registre", "Wallet payments exist in the ledger"],
    refundsPending: ["استرجاعات مستحقة لم تُنفَّذ", "Remboursements dus non effectués", "Refunds owed but not executed"],
    walletBalances: ["رصيد كل محفظة = مجموع حركاتها", "Solde = somme des mouvements", "Balance = sum of ledger entries"],
  },
  checkStatus: { ok: ["سليم", "OK", "OK"], fail: ["مخالفة", "Échec", "Failed"], warn: ["تنبيه", "Alerte", "Warning"] },
  issue: {
    total_mismatch: ["الإجمالي ≠ البضاعة + التوصيل − الخصم", "Total ≠ marchandises + livraison − remise", "Total ≠ goods + fee − discount"],
    snapshot_subtotal: ["لقطة البضاعة تخالف الطلب", "Instantané : marchandises ≠ commande", "Snapshot goods differ from order"],
    snapshot_fee: ["لقطة التوصيل تخالف الطلب", "Instantané : livraison ≠ commande", "Snapshot fee differs from order"],
    snapshot_total: ["لقطة الإجمالي تخالف الطلب", "Instantané : total ≠ commande", "Snapshot total differs from order"],
    net_plus_commission: ["الصافي + العمولة ≠ البضاعة", "Net + commission ≠ marchandises", "Net + commission ≠ goods"],
    snapshot_not_final: ["طلب مُسلَّم وسجله المالي غير نهائي", "Livrée mais enregistrement non final", "Delivered but financial record not final"],
    wallet_payment_missing: ["دفع المحفظة بلا قيد في الدفتر", "Paiement portefeuille absent du registre", "Wallet payment missing from ledger"],
    wallet_payment_amount: ["مبلغ الدفتر يخالف الطلب", "Montant du registre ≠ commande", "Ledger amount differs from order"],
    wallet_refund_missing: ["استرجاع مسجّل بلا قيد في الدفتر", "Remboursement sans écriture", "Refund marked done without ledger entry"],
    driver_charge_missing: ["خصم السائق بلا قيد في الدفتر", "Prélèvement livreur sans écriture", "Driver charge missing from ledger"],
    wallet_balance: ["الرصيد المخزَّن ≠ مجموع الحركات", "Solde ≠ somme des mouvements", "Stored balance ≠ ledger sum"],
  },
};

/** Short definitions printed under each report so a reader knows what a number means. */
const NOTE = {
  sales: [
    "المسلَّمة تُؤرَّخ بوقت التسليم والملغاة بوقت الإلغاء. صافي المنصة = العمولة + (رسوم التوصيل − حصة السائق) − الخصومات التي تتحملها المنصة.",
    "Les livrées sont datées à la livraison, les annulées à l'annulation. Net plateforme = commission + (frais de livraison − part livreur) − remises financées par la plateforme.",
    "Delivered orders are dated by delivery time, canceled ones by cancellation time. Platform net = commission + (delivery fee − driver share) − platform-funded discounts.",
  ],
  "order-financials": [
    "الأرقام من لقطة الطلب المحفوظة وقت إنشائه، فلا تتغيّر بتغيّر الإعدادات لاحقاً.",
    "Les chiffres viennent de l'instantané pris à la commande ; ils ne changent pas si les réglages changent.",
    "Figures come from the snapshot stored at order time; later setting changes never rewrite them.",
  ],
  commissions: [
    "العمولة المعروضة من لقطات الطلبات؛ «القاعدة الحالية» للعرض فقط. الرصيد المستحق تراكمي منذ البداية = صافي المسلَّم − التسويات.",
    "Les commissions viennent des instantanés ; la « règle actuelle » est indicative. Solde dû = cumul depuis le début = net livré − règlements.",
    "Commission comes from order snapshots; the current rule is for reference only. Balance owed is cumulative = delivered net − settlements.",
  ],
  settlements: [
    "التسويات تُدخل يدوياً من مشرف مخوَّل ولا تُحذف؛ الملغاة تبقى ظاهرة ولا تدخل في الصافي.",
    "Les règlements sont saisis manuellement et jamais supprimés ; les annulés restent visibles mais hors net.",
    "Settlements are entered manually and never deleted; voided ones stay visible but are excluded from the net.",
  ],
  payments: [
    "لا توجد بوابة دفع إلكتروني مفعّلة حالياً؛ المال «الإلكتروني» هنا هو طلبات الشحن بالتحويل. لا يُعدّ شحن ناجحاً إلا بعد موافقة مشرف.",
    "Aucune passerelle de paiement en ligne n'est active ; l'argent « électronique » correspond aux recharges par virement, validées par un superviseur.",
    "No online payment gateway is enabled; electronic money here means transfer top-ups, which only count once a supervisor approves them.",
  ],
  drivers: [
    "الأرباح من لقطة كل طلب. النقد المحصَّل = المبلغ المستحق عند التسليم في الطلبات المسلَّمة.",
    "Gains issus de l'instantané de chaque commande. Espèces = montant dû à la livraison sur les commandes livrées.",
    "Earnings come from each order's snapshot. Cash collected = amount due on delivery for delivered orders.",
  ],
  "driver-earnings": [
    "الأرباح من لقطة كل طلب مسلَّم، مؤرَّخة بوقت التسليم.",
    "Gains issus de l'instantané des commandes livrées, datés à la livraison.",
    "Earnings come from the snapshot of each delivered order, dated by delivery time.",
  ],
  exceptions: [
    "التأخر: مدة التحضير تتجاوز الوقت المتوقع + المهلة المضبوطة في مركز الاستثناءات. الطلب الذي لا يزال قيد التحضير ويتجاوز المهلة يُحسب متأخراً.",
    "Retard : préparation > durée prévue + tolérance du centre d'exceptions. Une commande encore en préparation hors délai est comptée en retard.",
    "Delayed: preparation exceeds expected time + the exception-center tolerance. An order still being prepared past the limit counts as delayed.",
  ],
  comparison: [
    "الترتيب حسب قيمة البضاعة المسلَّمة. متوسط التحضير والتوصيل من الطلبات التي تحمل الأختام الزمنية الكاملة فقط.",
    "Classement par valeur des marchandises livrées. Les durées moyennes n'utilisent que les commandes ayant tous les horodatages.",
    "Ranked by delivered goods value. Average times use only orders that carry every timestamp.",
  ],
  reconcile: [
    "تُحسب كل فحوصات المطابقة من السجلات الأصلية (الطلبات ودفاتر المحافظ) بمسارات تجميع مستقلة؛ أي فرق يظهر كمخالفة.",
    "Chaque contrôle est recalculé à partir des enregistrements d'origine (commandes, registres) par des chemins d'agrégation distincts ; tout écart est signalé.",
    "Every check is recomputed from the source records (orders, wallet ledgers) through independent aggregation paths; any difference is flagged.",
  ],
  legacy: [
    "طلبات قديمة بلا لقطة مالية: العمولة تُعدّ صفراً وصافي المتجر = قيمة البضاعة (كما في كشف الحساب).",
    "Anciennes commandes sans instantané : commission = 0, net commerce = marchandises (comme le relevé).",
    "Legacy orders without a financial snapshot: commission counts as 0 and business net = goods (same as the statement).",
  ],
};

const UI = {
  period: ["الفترة", "Période", "Period"], generated: ["أُنشئ في", "Généré le", "Generated"], totals: ["الإجمالي", "Total", "Total"],
  page: ["صفحة", "Page", "Page"], of: ["من", "sur", "of"], currency: ["العملة", "Devise", "Currency"], scope: ["النطاق", "Périmètre", "Scope"],
  granularity: ["التجميع", "Regroupement", "Grouping"], day: ["يومي", "Jour", "Daily"], week: ["أسبوعي", "Semaine", "Weekly"], month: ["شهري", "Mois", "Monthly"],
  statusFilter: ["الطلبات", "Commandes", "Orders"], delivered: ["المسلَّمة", "Livrées", "Delivered"], canceled: ["الملغاة", "Annulées", "Canceled"],
  admin: ["كل المنصة", "Toute la plateforme", "Whole platform"], store: ["هذا المتجر فقط", "Ce commerce uniquement", "This business only"], driver: ["السائق", "Livreur", "Driver"],
  timezone: ["المنطقة الزمنية", "Fuseau horaire", "Time zone"], noRows: ["لا توجد بيانات في هذه الفترة", "Aucune donnée sur cette période", "No data in this period"],
  truncated: ["عُرض جزء من الصفوف؛ استخدم التصدير للحصول على الكل", "Lignes tronquées ; exportez pour tout obtenir", "Rows truncated; export to get them all"],
  pdfLatin: ["النصوص غير اللاتينية قد تظهر «?» في PDF؛ استخدم Excel أو الطباعة للعربية", "Les textes non latins peuvent apparaître « ? » dans le PDF", "Non-Latin text may appear as “?” in the PDF; use Excel or print for Arabic"],
};

function labelsFor(report, lang) {
  const l = IDX[lang] != null ? lang : "en";
  const out = { title: pick(TITLE[report.type] || [report.type, report.type, report.type], l), tables: {}, columns: {}, enums: {}, notes: [], ui: {} };
  const enumsUsed = new Set();
  for (const t of report.tables) {
    out.tables[t.id] = pick(TABLE[t.id] || [t.id, t.id, t.id], l);
    for (const c of t.columns) {
      out.columns[c.key] = pick(COLUMN[c.key] || [c.key, c.key, c.key], l);
      if (c.enum) enumsUsed.add(c.enum);
    }
  }
  for (const e of enumsUsed) {
    out.enums[e] = {};
    for (const [code, tuple] of Object.entries(ENUM[e] || {})) out.enums[e][code] = pick(tuple, l);
  }
  if (NOTE[report.type]) out.notes.push(pick(NOTE[report.type], l));
  if (report.meta && report.meta.legacyOrders) out.notes.push(`${pick(NOTE.legacy, l)} (${report.meta.legacyOrders})`);
  for (const [k, tuple] of Object.entries(UI)) out.ui[k] = pick(tuple, l);
  return out;
}

module.exports = { TITLE, TABLE, COLUMN, ENUM, NOTE, UI, labelsFor, pick };
