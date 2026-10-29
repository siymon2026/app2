/* global api, el, lang, toast, escapeHtml, adminRestaurants, adminItems, fileToDataUrl */
/* Dynamic stores/catalog management extensions for the existing admin dashboard. */
(function () {
  "use strict";

  const L = (ar, en, fr) =>
    lang === "ar" ? ar : lang === "fr" ? fr || en : en;
  const esc = (v) =>
    typeof escapeHtml === "function"
      ? escapeHtml(String(v ?? ""))
      : String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const STATUS = {
    active: ["نشط", "Active", "Actif"],
    paused: ["متوقف مؤقتاً", "Paused", "En pause"],
    unpublished: ["غير منشور", "Unpublished", "Non publié"],
    archived: ["مؤرشف", "Archived", "Archivé"],
  };
  const statusOf = (r) =>
    STATUS[r && r.status] ? r.status : r && r.isActive === false ? "unpublished" : "active";
  const statusLabel = (s) => L(...STATUS[s]);
  const DAYS = [
    ["الأحد", "Sunday", "Dimanche"],
    ["الاثنين", "Monday", "Lundi"],
    ["الثلاثاء", "Tuesday", "Mardi"],
    ["الأربعاء", "Wednesday", "Mercredi"],
    ["الخميس", "Thursday", "Jeudi"],
    ["الجمعة", "Friday", "Vendredi"],
    ["السبت", "Saturday", "Samedi"],
  ];
  let TYPES = [
    ["restaurant", "مطعم", "Restaurant", "Restaurant"],
    ["fastfood", "وجبات سريعة", "Fast food", "Fast-food"],
    ["pizza", "بيتزا", "Pizza", "Pizza"],
    ["cafe", "مقهى", "Café", "Café"],
    ["bakery", "حلويات ومخبز", "Bakery & sweets", "Pâtisserie"],
    ["grocery", "بقالة وسوبرماركت", "Grocery", "Épicerie"],
    ["clothing", "ملابس", "Clothing", "Vêtements"],
    ["electronics", "إلكترونيات", "Electronics", "Électronique"],
  ];

  /* ---------- business types (managed by the super admin, loaded from the server) ---------- */
  function refreshTypeControls() {
    const opt = (t) => `<option value="${esc(t[0])}">${esc(L(t[1], t[2], t[3]))}</option>`;
    const ft = el("stFt");
    if (ft) {
      const keep = ft.value;
      ft.innerHTML = `<option value="">${esc(L("كل الأنواع", "All types", "Tous les types"))}</option>${TYPES.map(opt).join("")}`;
      ft.value = keep;
    }
    const st = el("stType");
    if (st && st.tagName === "SELECT") {
      const keep = st.value;
      st.innerHTML = TYPES.map(opt).join("");
      if (keep && !TYPES.some((t) => t[0] === keep)) st.insertAdjacentHTML("beforeend", opt([keep, keep, keep, keep]));
      st.value = keep || "restaurant";
    }
  }
  let typesLoaded = false;
  let typesLoading = false;
  window.storesReloadTypes = async function () {
    if (typesLoading) return;
    if (window.adminPerms && !window.adminPerms.can("stores.read")) return; // role may not read store types: do not ask (it only logs a 403)
    typesLoading = true;
    try {
      const r = await api("/api/admin/store-types", { method: "GET" });
      const list = (r.types || []).filter((t) => t.enabled !== false);
      if (list.length) {
        typesLoaded = true;
        TYPES = list.map((t) => [t.id, `${t.icon || ""} ${(t.name && t.name.ar) || t.id}`.trim(), `${t.icon || ""} ${(t.name && (t.name.en || t.name.ar)) || t.id}`.trim(), `${t.icon || ""} ${(t.name && (t.name.fr || t.name.ar)) || t.id}`.trim()]);
      }
    } catch (e) {
      /* keep the built-in fallback list */
    }
    typesLoading = false;
    refreshTypeControls();
  };

  /* ---------- catalog cache ---------- */
  let CATALOG = { categories: [], banners: [], sections: [] };
  async function loadCatalog() {
    try {
      const c = await api("/api/admin/catalog", { method: "GET" });
      CATALOG = {
        categories: c.categories || [],
        banners: c.banners || [],
        sections: c.sections || [],
      };
    } catch (e) {
      /* keep previous */
    }
    return CATALOG;
  }

  /* ---------- restaurants list: filter + status + counts ---------- */
  const F = { q: "", status: "", type: "" };
  function filterBar() {
    const host = el("restListTitle");
    if (!host || el("storesFilterBar")) return;
    const bar = document.createElement("div");
    bar.id = "storesFilterBar";
    bar.className = "st-bar";
    bar.innerHTML = `
      <input id="stFq" type="search" placeholder="${esc(L("بحث بالاسم أو المدينة…", "Search name or city…", "Rechercher…"))}" aria-label="search" />
      <select id="stFs" aria-label="status"><option value="">${esc(L("كل الحالات", "All statuses", "Tous les statuts"))}</option>${Object.keys(STATUS).map((k) => `<option value="${k}">${esc(statusLabel(k))}</option>`).join("")}</select>
      <select id="stFt" aria-label="type"><option value="">${esc(L("كل الأنواع", "All types", "Tous les types"))}</option>${TYPES.map((t) => `<option value="${t[0]}">${esc(L(t[1], t[2], t[3]))}</option>`).join("")}</select>
      <button id="stTypesBtn" class="btn ghost small" type="button">🧩 ${esc(L("أنواع الأنشطة", "Business types", "Types d'activité"))}</button>`;
    host.insertAdjacentElement("afterend", bar);
    const apply = () => {
      F.q = el("stFq").value.trim().toLowerCase();
      F.status = el("stFs").value;
      F.type = el("stFt").value;
      if (typeof renderRestaurantsAdmin === "function") renderRestaurantsAdmin();
    };
    el("stFq").addEventListener("input", apply);
    el("stFs").addEventListener("change", apply);
    el("stFt").addEventListener("change", apply);
  }
  window.storesVisible = function (list) {
    if (!typesLoaded) window.storesReloadTypes(); // first render after admin login
    filterBar();
    return (list || []).filter((r) => {
      if (F.status && statusOf(r) !== F.status) return false;
      if (F.type && (r.type || "restaurant") !== F.type) return false;
      if (F.q) {
        const hay = [r.name && r.name.ar, r.name && r.name.en, r.name && r.name.fr, r.city, r.area, r.phone]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(F.q)) return false;
      }
      return true;
    });
  };
  window.storesStatusBadge = function (r) {
    const s = statusOf(r);
    return `<span class="st-badge ${s}">${esc(statusLabel(s))}</span>`;
  };
  window.storesItemCount = function (r) {
    const n = (adminItems || []).filter((i) => String(i.restaurantId) === String(r.id)).length;
    return `<small class="muted"> · ${n} ${esc(L("منتج", "items", "articles"))}</small>`;
  };
  window.storesSetStatus = async function (id, status) {
    try {
      await api(`/api/admin/restaurants/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      toast("✅ " + statusLabel(status));
      if (typeof refreshMenuData === "function") await refreshMenuData();
    } catch (e) {
      toast(e.message);
    }
  };

  /* ---------- restaurant edit: extra fields ---------- */
  let REST_BUILT = false;
  function buildRestExtra() {
    const host = el("storesExtraFields");
    if (!host || REST_BUILT) return;
    REST_BUILT = true;
    const old = el("restEditActive");
    if (old && old.closest(".input-row")) old.closest(".input-row").style.display = "none";
    const num = (id, label, attrs = "") =>
      `<div class="input-row"><label for="${id}">${esc(label)}</label><input id="${id}" type="number" step="0.01" min="0" ${attrs} /></div>`;
    host.innerHTML = `
      <div class="st-section"><h5>${esc(L("النشر والتصنيف", "Publishing & category", "Publication et catégorie"))}</h5>
        <div class="st-grid">
          <div class="input-row"><label for="stStatus">${esc(L("الحالة", "Status", "Statut"))}</label>
            <select id="stStatus">${Object.keys(STATUS).map((k) => `<option value="${k}">${esc(statusLabel(k))}</option>`).join("")}</select></div>
          <div class="input-row"><label for="stType">${esc(L("نوع النشاط", "Business type", "Type"))}</label>
            <select id="stType">${TYPES.map((t) => `<option value="${esc(t[0])}">${esc(L(t[1], t[2], t[3]))}</option>`).join("")}</select></div>
          <div class="input-row"><label for="stCity">${esc(L("المدينة", "City", "Ville"))}</label><input id="stCity" maxlength="80" /></div>
          <div class="input-row"><label for="stArea">${esc(L("المنطقة", "Area", "Zone"))}</label><input id="stArea" maxlength="80" /></div>
        </div>
        <div class="input-row" style="margin-top:8px"><label>${esc(L("التصنيفات", "Categories", "Catégories"))}</label><div class="st-chips" id="stCats"></div>
          <div class="st-hint">${esc(L("تُنشأ التصنيفات من تبويب «الرئيسية».", "Create categories in the “Home” tab.", "Créez les catégories dans l’onglet « Accueil »."))}</div></div>
      </div>
      <div class="st-section"><h5>${esc(L("الوصف", "Description", "Description"))}</h5>
        <div class="st-grid">
          <div class="input-row"><label for="stDescAr">AR</label><textarea id="stDescAr" rows="2" maxlength="400"></textarea></div>
          <div class="input-row"><label for="stDescEn">EN</label><textarea id="stDescEn" rows="2" maxlength="400"></textarea></div>
          <div class="input-row"><label for="stDescFr">FR</label><textarea id="stDescFr" rows="2" maxlength="400"></textarea></div>
        </div>
      </div>
      <div class="st-section"><h5>${esc(L("الطلب والتوصيل (د.م)", "Ordering & delivery (MAD)", "Commande et livraison (MAD)"))}</h5>
        <div class="st-grid">
          ${num("stMinOrder", L("الحد الأدنى للطلب", "Minimum order", "Commande minimum"))}
          ${num("stDelFee", L("رسوم التوصيل", "Delivery fee", "Frais de livraison"))}
          ${num("stFreeOver", L("توصيل مجاني فوق", "Free delivery over", "Livraison gratuite dès"))}
          ${num("stAvgMin", L("متوسط وقت التوصيل (دقيقة)", "Avg delivery (min)", "Délai moyen (min)"), 'step="1" max="600"')}
          ${num("stSort", L("الترتيب في الرئيسية", "Home order", "Ordre"), 'step="1" min="-100000"')}
          <div class="input-row"><label for="stOffer">${esc(L("شارة العرض (مثال: -15%)", "Offer badge (e.g. -15%)", "Badge offre"))}</label><input id="stOffer" maxlength="60" /></div>
        </div>
        <div class="st-row" style="margin-top:6px">
          <label class="st-check"><input id="stFeatured" type="checkbox" /> ${esc(L("ضمن المتاجر المميزة", "Featured", "À la une"))}</label>
          <label class="st-check"><input id="stTrending" type="checkbox" /> ${esc(L("ضمن الأكثر طلباً", "Trending", "Tendance"))}</label>
        </div>
      </div>
      <div class="st-section"><h5>${esc(L("ساعات العمل (بتوقيت المغرب)", "Opening hours (Morocco time)", "Horaires (heure du Maroc)"))}</h5>
        <div class="st-hours" id="stHours">${DAYS.map((d, i) => `
          <span>${esc(L(...d))}</span>
          <label class="st-check"><input type="checkbox" id="stClosed${i}" /> ${esc(L("عطلة", "Closed", "Fermé"))}</label>
          <input type="time" id="stOpen${i}" aria-label="open" /><input type="time" id="stClose${i}" aria-label="close" />`).join("")}
        </div>
        <div class="st-hint">${esc(L("اترك كل الأيام فارغة = مفتوح دائماً. إذا حددت بعض الأيام فاليوم الفارغ يُعدّ مغلقاً. إغلاق بعد منتصف الليل مدعوم (مثال 18:00 → 02:00).", "Leave all days empty = always open. If some days are set, an empty day counts as closed. Overnight hours supported (e.g. 18:00 → 02:00).", "Tous les jours vides = toujours ouvert. Si certains jours sont définis, un jour vide est fermé."))}</div>
      </div>
      <div class="st-section"><h5>${esc(L("مناطق التغطية", "Coverage areas", "Zones couvertes"))}</h5>
        <textarea id="stCoverage" rows="2" placeholder="${esc(L("منطقة في كل سطر", "One area per line", "Une zone par ligne"))}"></textarea>
      </div>
      <div class="st-section" id="stFinance"></div>`;
  }

  /* ---------- finance: commission, settlements, statement (own endpoints) ---------- */
  const money2 = (n) => (Number(n) || 0).toFixed(2);
  async function renderFinance(r) {
    const box = el("stFinance");
    if (!box) return;
    const head = `<h5>${esc(L("المالية والعمولة", "Finance & commission", "Finance et commission"))}</h5>`;
    if (!r || !r.id) {
      box.innerHTML = head + `<div class="st-hint">${esc(L("احفظ المتجر أولاً ثم عدّل العمولة والتسويات.", "Save the store first, then manage commission and settlements.", "Enregistrez d’abord le magasin."))}</div>`;
      return;
    }
    const id = encodeURIComponent(r.id);
    const monthStart = new Date(); monthStart.setDate(1);
    const from = monthStart.toISOString().slice(0, 10);
    let c, stmt, list;
    try {
      c = (await api(`/api/admin/stores/${id}/commission`)).commission;
      stmt = await api(`/api/admin/stores/${id}/statement?from=${from}`);
      list = (await api(`/api/admin/settlements?storeId=${id}`)).settlements || [];
    } catch (e) {
      box.innerHTML = head + `<div class="st-hint">${esc(e.message || "Error")}</div>`;
      return;
    }
    const rg = stmt.range || {}, at = stmt.allTime || {};
    box.innerHTML = head + `
      <div class="st-grid">
        <div class="input-row"><label for="fnType">${esc(L("نوع العمولة", "Commission type", "Type"))}</label>
          <select id="fnType"><option value="none">${esc(L("بدون", "None", "Aucune"))}</option><option value="percent">${esc(L("نسبة % من المنتجات", "Percent of goods", "Pourcentage"))}</option><option value="fixed">${esc(L("مبلغ ثابت لكل طلب", "Fixed per order", "Montant fixe"))}</option></select></div>
        <div class="input-row"><label for="fnValue">${esc(L("القيمة (نسبة 0–50 / مبلغ 0–1000)", "Value (percent 0–50 / amount 0–1000)", "Valeur"))}</label><input id="fnValue" type="number" step="0.01" min="0" max="1000" /></div>
        <div class="input-row"><label>&nbsp;</label><button type="button" class="btn" id="fnSaveComm">${esc(L("حفظ العمولة", "Save commission", "Enregistrer"))}</button></div>
      </div>
      <div class="st-hint">${esc(L("تُطبَّق على الطلبات الجديدة فقط؛ الطلبات السابقة تحتفظ بعمولتها.", "Applies to new orders only; past orders keep their commission.", "S’applique aux nouvelles commandes uniquement."))}</div>
      <h5 style="margin-top:12px">${esc(L("كشف الحساب", "Statement", "Relevé"))}</h5>
      <div class="st-hint">
        ${esc(L("هذا الشهر", "This month", "Ce mois"))}: ${rg.orders || 0} · ${esc(L("المنتجات", "goods", "produits"))} ${money2(rg.goods)} · ${esc(L("العمولة", "commission", "commission"))} ${money2(rg.commission)} · ${esc(L("صافي المتجر", "net", "net"))} ${money2(rg.net)}
        ${rg.legacyOrdersWithoutSnapshot ? ` · ${esc(L("طلبات قديمة بلا لقطة مالية", "legacy orders without snapshot", "anciennes commandes"))}: ${rg.legacyOrdersWithoutSnapshot}` : ""}<br>
        <b>${esc(L("المستحق للمتجر (إجمالاً)", "Balance owed to store (all time)", "Solde dû au magasin"))}: ${money2(at.balanceOwedToStore)}</b>
        (${esc(L("المستحقات", "entitlement", "droits"))} ${money2(at.netEntitlement)} − ${esc(L("المسوّى", "settled", "réglé"))} ${money2(at.settledNet)})
      </div>
      <h5 style="margin-top:12px">${esc(L("تسوية يدوية جديدة", "New manual settlement", "Nouveau règlement"))}</h5>
      <div class="st-grid">
        <div class="input-row"><label for="fnAmt">${esc(L("المبلغ", "Amount", "Montant"))}</label><input id="fnAmt" type="number" step="0.01" min="0.01" /></div>
        <div class="input-row"><label for="fnRef">${esc(L("المرجع (فريد)", "Reference (unique)", "Référence"))}</label><input id="fnRef" maxlength="60" /></div>
        <div class="input-row"><label for="fnDate">${esc(L("التاريخ", "Date", "Date"))}</label><input id="fnDate" type="date" /></div>
        <div class="input-row"><label for="fnDir">${esc(L("الاتجاه", "Direction", "Sens"))}</label>
          <select id="fnDir"><option value="to_store">${esc(L("دفع للمتجر", "Paid to store", "Payé au magasin"))}</option><option value="from_store">${esc(L("استلام من المتجر", "Received from store", "Reçu du magasin"))}</option></select></div>
        <div class="input-row"><label for="fnNote">${esc(L("ملاحظة", "Note", "Note"))}</label><input id="fnNote" maxlength="300" /></div>
        <div class="input-row"><label>&nbsp;</label><button type="button" class="btn" id="fnAddSettle">${esc(L("تسجيل التسوية", "Record settlement", "Enregistrer"))}</button></div>
      </div>
      <div id="fnList">${list.length ? list.map((x) => `<div class="st-hint" style="${x.status === "void" ? "text-decoration:line-through;opacity:.6" : ""}">
          ${esc(x.date)} · ${esc(x.reference)} · ${x.direction === "from_store" ? "−" : "+"}${money2(x.amount)} ${x.note ? "· " + esc(x.note) : ""}
          ${x.status === "void" ? "· " + esc(L("ملغاة", "void", "annulé")) + ": " + esc(x.voidReason || "") : `<button type="button" class="btn ghost small" data-void="${esc(x.id)}">${esc(L("إبطال", "Void", "Annuler"))}</button>`}</div>`).join("") : `<div class="st-hint">${esc(L("لا توجد تسويات", "No settlements", "Aucun règlement"))}</div>`}</div>`;
    el("fnType").value = (c && c.type) || "none";
    el("fnValue").value = c && c.type !== "none" ? String(c.value) : "";
    el("fnDate").value = new Date().toISOString().slice(0, 10);
    el("fnSaveComm").onclick = async () => {
      try {
        await api(`/api/admin/stores/${id}/commission`, { method: "PUT", body: JSON.stringify({ type: el("fnType").value, value: el("fnValue").value }) });
        toast("✅");
      } catch (e) { toast(e.message); }
    };
    el("fnAddSettle").onclick = async () => {
      try {
        await api("/api/admin/settlements", { method: "POST", body: JSON.stringify({ storeId: r.id, amount: el("fnAmt").value, reference: el("fnRef").value, date: el("fnDate").value, direction: el("fnDir").value, note: el("fnNote").value }) });
        toast("✅");
        renderFinance(r);
      } catch (e) { toast(e.message); }
    };
    box.querySelectorAll("[data-void]").forEach((b) => {
      b.onclick = async () => {
        const reason = (prompt(L("سبب الإبطال (إلزامي)", "Reason for voiding (required)", "Motif (obligatoire)")) || "").trim();
        if (reason.length < 3) return;
        try {
          await api(`/api/admin/settlements/${encodeURIComponent(b.getAttribute("data-void"))}/void`, { method: "POST", body: JSON.stringify({ reason }) });
          toast("✅");
          renderFinance(r);
        } catch (e) { toast(e.message); }
      };
    });
  }

  window.storesFillRest = async function (r) {
    buildRestExtra();
    el("stCats").dataset.ready = "";
    const v = (id, x) => { const n = el(id); if (n) n.value = x ?? ""; };
    const c = (id, x) => { const n = el(id); if (n) n.checked = !!x; };
    v("stStatus", statusOf(r));
    {
      const cur = (r && r.type) || "restaurant";
      const sel = el("stType");
      if (sel && sel.tagName === "SELECT" && !Array.from(sel.options).some((o) => o.value === cur)) {
        sel.insertAdjacentHTML("beforeend", `<option value="${esc(cur)}">${esc(cur)}</option>`);
      }
    }
    v("stType", (r && r.type) || "restaurant");
    v("stCity", r && r.city);
    v("stArea", r && r.area);
    v("stDescAr", r && r.description && r.description.ar);
    v("stDescEn", r && r.description && r.description.en);
    v("stDescFr", r && r.description && r.description.fr);
    v("stMinOrder", r && r.minOrder);
    v("stDelFee", r && r.deliveryFee);
    v("stFreeOver", r && r.freeDeliveryOver);
    v("stAvgMin", r && r.avgDeliveryMin);
    v("stSort", r && r.sortOrder);
    v("stOffer", r && r.offerLabel);
    c("stFeatured", r && r.featured);
    c("stTrending", r && r.trending);
    v("stCoverage", ((r && r.coverageAreas) || []).join("\n"));
    renderFinance(r);
    await loadCatalog();
    const ids = new Set((r && r.categoryIds) || []);
    const cats = (CATALOG.categories || []).filter((x) => x.kind !== "dish");
    el("stCats").innerHTML = cats.length
      ? cats.map((x) => `<label><input type="checkbox" value="${esc(x.id)}" ${ids.has(x.id) ? "checked" : ""}/> ${esc((x.name && (x.name[lang] || x.name.ar || x.name.en)) || x.id)}</label>`).join("")
      : `<span class="muted">${esc(L("لا توجد تصنيفات بعد", "No categories yet", "Aucune catégorie"))}</span>`;
    el("stCats").dataset.ready = "1";
    const days = (r && r.hours && r.hours.days) || {};
    for (let i = 0; i < 7; i++) {
      const d = days[i] || days[String(i)] || {};
      c("stClosed" + i, d.closed === true);
      v("stOpen" + i, d.open || "");
      v("stClose" + i, d.close || "");
    }
  };

  window.storesReadRest = function () {
    if (!REST_BUILT) return {};
    const g = (id) => (el(id) ? el(id).value.trim() : "");
    const n = (id) => { const x = g(id); return x === "" ? undefined : Number(x); };
    const days = {};
    let any = false;
    for (let i = 0; i < 7; i++) {
      if (el("stClosed" + i).checked) { days[i] = { closed: true }; any = true; }
      else if (g("stOpen" + i) && g("stClose" + i)) { days[i] = { open: g("stOpen" + i), close: g("stClose" + i) }; any = true; }
    }
    const out = {
      status: g("stStatus"),
      type: g("stType") || "restaurant",
      city: g("stCity"),
      area: g("stArea"),
      description: { ar: g("stDescAr"), en: g("stDescEn"), fr: g("stDescFr") },
      categoryIds: el("stCats").dataset.ready
        ? Array.from(document.querySelectorAll("#stCats input:checked")).map((x) => x.value)
        : undefined,
      minOrder: n("stMinOrder") ?? 0,
      deliveryFee: n("stDelFee") ?? 0,
      freeDeliveryOver: n("stFreeOver") ?? null,
      avgDeliveryMin: n("stAvgMin") ?? 30,
      sortOrder: n("stSort") ?? 0,
      offerLabel: g("stOffer"),
      featured: el("stFeatured").checked,
      trending: el("stTrending").checked,
      hours: any ? { days } : null,
      coverageAreas: g("stCoverage").split("\n").map((x) => x.trim()).filter(Boolean),
    };
    return out;
  };

  /* ---------- item edit: extra fields ---------- */
  let ITEM_BUILT = false;
  function buildItemExtra() {
    const host = el("itemsExtraFields");
    if (!host || ITEM_BUILT) return;
    ITEM_BUILT = true;
    host.innerHTML = `
      <div class="st-section"><h5>${esc(L("الأسعار والتوفر والعرض", "Pricing, stock & display", "Prix, stock et affichage"))}</h5>
        <div class="st-grid">
          <div class="input-row"><label for="stSale">${esc(L("السعر بعد الخصم (د.م)", "Sale price (MAD)", "Prix remisé (MAD)"))}</label><input id="stSale" type="number" step="0.01" min="0" /></div>
          <div class="input-row"><label for="stStock">${esc(L("المخزون (فارغ = غير محدود)", "Stock (empty = unlimited)", "Stock (vide = illimité)"))}</label><input id="stStock" type="number" step="1" min="0" /></div>
          <div class="input-row"><label for="stISort">${esc(L("الترتيب داخل المتجر", "Order in store", "Ordre"))}</label><input id="stISort" type="number" step="1" /></div>
        </div>
        <div class="st-row" style="margin-top:6px">
          <label class="st-check"><input id="stIFeat" type="checkbox" /> ${esc(L("منتج مميز", "Featured", "À la une"))}</label>
          <label class="st-check"><input id="stITrend" type="checkbox" /> ${esc(L("الأكثر طلباً", "Trending", "Tendance"))}</label>
          <label class="st-check"><input id="stIArch" type="checkbox" /> ${esc(L("أرشفة (إخفاء)", "Archive (hide)", "Archiver"))}</label>
        </div>
        <div class="st-hint" id="stSaleHint"></div>
      </div>`;
  }
  window.storesFillItem = function (it) {
    buildItemExtra();
    const v = (id, x) => { const n = el(id); if (n) n.value = x ?? ""; };
    v("stSale", it && it.salePrice);
    v("stStock", it && it.stock);
    v("stISort", it && it.sortOrder);
    el("stIFeat").checked = !!(it && it.featured);
    el("stITrend").checked = !!(it && it.trending);
    el("stIArch").checked = !!(it && it.archived);
  };
  window.storesReadItem = function () {
    if (!ITEM_BUILT) return {};
    const g = (id) => el(id).value.trim();
    const sale = g("stSale");
    const price = Number(el("itemEditPrice").value || 0);
    if (sale !== "" && !(Number(sale) < price)) {
      el("stSaleHint").textContent = L("سعر الخصم يجب أن يكون أقل من السعر الأصلي (وإلا يُتجاهل).", "Sale price must be lower than the price (otherwise ignored).", "Le prix remisé doit être inférieur au prix.");
    } else el("stSaleHint").textContent = "";
    return {
      salePrice: sale === "" ? null : Number(sale),
      stock: g("stStock") === "" ? null : Number(g("stStock")),
      sortOrder: g("stISort") === "" ? 0 : Number(g("stISort")),
      featured: el("stIFeat").checked,
      trending: el("stITrend").checked,
      archived: el("stIArch").checked,
    };
  };

  /* ---------- Home tab: categories / banners / sections ---------- */
  const SECTION_TYPES = {
    trending: ["الأكثر طلباً", "Trending", "Tendances"],
    featured: ["المميّز", "Featured", "À la une"],
    offers: ["العروض", "Offers", "Offres"],
    stores: ["كل المتاجر", "All stores", "Tous"],
    custom: ["مخصص (متاجر أختارها)", "Custom (pick stores)", "Personnalisé"],
  };
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split(".");
    const last = ks.pop();
    const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o);
    t[last] = v;
  }
  const i3 = (list, idx, path, label) =>
    ["ar", "en", "fr"].map((l) => `<div class="input-row"><label>${esc(label)} ${l.toUpperCase()}</label><input data-l="${list}" data-i="${idx}" data-p="${path}.${l}" value="${esc(getPath(CATALOG[list][idx], path + "." + l) || "")}" maxlength="120"/></div>`).join("");

  function renderHome() {
    const host = el("menuPanelHome");
    if (!host) return;
    const stores = adminRestaurants || [];
    const storeOpts = (sel) => `<option value="">—</option>` + stores.map((s) => `<option value="${esc(s.id)}" ${String(sel) === String(s.id) ? "selected" : ""}>${esc((s.name && (s.name[lang] || s.name.ar || s.name.en)) || s.id)}</option>`).join("");
    const cats = CATALOG.categories.map((c, i) => `
      <div class="st-card"><div class="st-grid">${i3("categories", i, "name", L("الاسم", "Name", "Nom"))}
        <div class="input-row"><label>${esc(L("النوع", "Kind", "Type"))}</label><select data-l="categories" data-i="${i}" data-p="kind"><option value="store" ${c.kind !== "dish" ? "selected" : ""}>${esc(L("متاجر", "Stores", "Boutiques"))}</option><option value="dish" ${c.kind === "dish" ? "selected" : ""}>${esc(L("أطباق/منتجات", "Dishes", "Plats"))}</option></select></div>
        <div class="input-row"><label>${esc(L("الترتيب", "Order", "Ordre"))}</label><input type="number" data-l="categories" data-i="${i}" data-p="sortOrder" data-num="1" value="${esc(c.sortOrder || 0)}"/></div></div>
        <div class="st-row"><img class="st-img" alt="" ${c.icon ? `src="${esc(c.icon)}"` : 'style="visibility:hidden"'} />
          <input type="file" accept="image/*" data-up="categories" data-i="${i}" data-f="icon" aria-label="icon"/>
          <label class="st-check"><input type="checkbox" data-l="categories" data-i="${i}" data-p="visible" ${c.visible !== false ? "checked" : ""}/> ${esc(L("ظاهر", "Visible", "Visible"))}</label>
          <button class="btn ghost small" type="button" data-del="categories" data-i="${i}">${esc(L("حذف", "Delete", "Supprimer"))}</button></div></div>`).join("");
    const banners = CATALOG.banners.map((b, i) => `
      <div class="st-card"><div class="st-grid">${i3("banners", i, "title", L("العنوان", "Title", "Titre"))}${i3("banners", i, "subtitle", L("نص فرعي", "Subtitle", "Sous-titre"))}
        <div class="input-row"><label>${esc(L("يفتح متجر", "Opens store", "Ouvre"))}</label><select data-l="banners" data-i="${i}" data-p="storeId">${storeOpts(b.storeId)}</select></div>
        <div class="input-row"><label>${esc(L("يبدأ", "Starts", "Début"))}</label><input type="date" data-l="banners" data-i="${i}" data-p="startsAt" data-date="1" value="${esc((b.startsAt || "").slice(0, 10))}"/></div>
        <div class="input-row"><label>${esc(L("ينتهي", "Ends", "Fin"))}</label><input type="date" data-l="banners" data-i="${i}" data-p="endsAt" data-date="1" value="${esc((b.endsAt || "").slice(0, 10))}"/></div>
        <div class="input-row"><label>${esc(L("الترتيب", "Order", "Ordre"))}</label><input type="number" data-l="banners" data-i="${i}" data-p="sortOrder" data-num="1" value="${esc(b.sortOrder || 0)}"/></div></div>
        <div class="st-row"><img class="st-img" alt="" ${b.image ? `src="${esc(b.image)}"` : 'style="visibility:hidden"'} />
          <input type="file" accept="image/*" data-up="banners" data-i="${i}" data-f="image" aria-label="image"/>
          <label class="st-check"><input type="checkbox" data-l="banners" data-i="${i}" data-p="active" ${b.active !== false ? "checked" : ""}/> ${esc(L("مفعّل", "Active", "Actif"))}</label>
          <button class="btn ghost small" type="button" data-del="banners" data-i="${i}">${esc(L("حذف", "Delete", "Supprimer"))}</button></div></div>`).join("");
    const secs = CATALOG.sections.map((s, i) => `
      <div class="st-card"><div class="st-grid">${i3("sections", i, "title", L("عنوان القسم", "Section title", "Titre"))}
        <div class="input-row"><label>${esc(L("النوع", "Type", "Type"))}</label><select data-l="sections" data-i="${i}" data-p="type">${Object.keys(SECTION_TYPES).map((k) => `<option value="${k}" ${s.type === k ? "selected" : ""}>${esc(L(...SECTION_TYPES[k]))}</option>`).join("")}</select></div>
        <div class="input-row"><label>${esc(L("الترتيب", "Order", "Ordre"))}</label><input type="number" data-l="sections" data-i="${i}" data-p="sortOrder" data-num="1" value="${esc(s.sortOrder || 0)}"/></div></div>
        <div class="input-row"><label>${esc(L("متاجر محددة (اختياري)", "Pinned stores (optional)", "Boutiques épinglées"))}</label>
          <div class="st-chips">${stores.map((x) => `<label><input type="checkbox" data-pin="${i}" value="${esc(x.id)}" ${(s.storeIds || []).includes(x.id) ? "checked" : ""}/> ${esc((x.name && (x.name[lang] || x.name.ar || x.name.en)) || x.id)}</label>`).join("")}</div></div>
        <div class="st-row"><label class="st-check"><input type="checkbox" data-l="sections" data-i="${i}" data-p="visible" ${s.visible !== false ? "checked" : ""}/> ${esc(L("ظاهر", "Visible", "Visible"))}</label>
          <button class="btn ghost small" type="button" data-del="sections" data-i="${i}">${esc(L("حذف", "Delete", "Supprimer"))}</button></div></div>`).join("");
    host.innerHTML = `
      <div class="panel-like"><h4 style="margin:0 0 8px">${esc(L("تصنيفات المتاجر والأطباق", "Categories", "Catégories"))}</h4>${cats || `<div class="muted">${esc(L("لا توجد تصنيفات", "No categories", "Aucune"))}</div>`}
        <button class="btn ghost" type="button" data-add="categories">＋ ${esc(L("إضافة تصنيف", "Add category", "Ajouter"))}</button></div>
      <div class="panel-like" style="margin-top:12px"><h4 style="margin:0 0 8px">${esc(L("البنرات والعروض", "Banners & offers", "Bannières"))}</h4>${banners || `<div class="muted">${esc(L("لا توجد بنرات", "No banners", "Aucune"))}</div>`}
        <button class="btn ghost" type="button" data-add="banners">＋ ${esc(L("إضافة بنر", "Add banner", "Ajouter"))}</button></div>
      <div class="panel-like" style="margin-top:12px"><h4 style="margin:0 0 8px">${esc(L("أقسام الصفحة الرئيسية", "Home sections", "Sections"))}</h4>${secs || `<div class="muted">${esc(L("لا توجد أقسام", "No sections", "Aucune"))}</div>`}
        <button class="btn ghost" type="button" data-add="sections">＋ ${esc(L("إضافة قسم", "Add section", "Ajouter"))}</button></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end;gap:10px"><span class="hint" id="stHomeHint"></span>
        <button class="btn good" type="button" id="stHomeSave">${esc(L("حفظ الصفحة الرئيسية", "Save home", "Enregistrer"))}</button></div>`;
  }

  function bindHome() {
    const host = el("menuPanelHome");
    if (!host || host.dataset.bound) return;
    host.dataset.bound = "1";
    const onEdit = (e) => {
      const t = e.target;
      if (t.dataset.pin !== undefined) {
        const s = CATALOG.sections[Number(t.dataset.pin)];
        s.storeIds = Array.from(host.querySelectorAll(`[data-pin="${t.dataset.pin}"]:checked`)).map((x) => x.value);
        return;
      }
      if (!t.dataset.l) return;
      const item = CATALOG[t.dataset.l][Number(t.dataset.i)];
      let val = t.type === "checkbox" ? t.checked : t.value;
      if (t.dataset.num) val = Number(val || 0);
      if (t.dataset.date) val = val ? new Date(val + "T00:00:00").toISOString() : null;
      setPath(item, t.dataset.p, val);
    };
    host.addEventListener("input", onEdit);
    host.addEventListener("change", async (e) => {
      onEdit(e);
      const t = e.target;
      if (t.dataset.up && t.files && t.files[0]) {
        const hint = el("stHomeHint");
        try {
          hint.textContent = "...";
          const dataUrl = await fileToDataUrl(t.files[0]);
          const r = await api("/api/admin/upload/banner-image", { method: "POST", body: JSON.stringify({ image: dataUrl }) });
          CATALOG[t.dataset.up][Number(t.dataset.i)][t.dataset.f] = r.url;
          hint.textContent = "";
          renderHome();
        } catch (err) {
          hint.textContent = L("فشل رفع الصورة", "Upload failed", "Échec") + ": " + err.message;
        }
      }
    });
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.add) {
        const k = b.dataset.add;
        const mk = { categories: { name: { ar: "", en: "", fr: "" }, kind: "store", visible: true, sortOrder: CATALOG.categories.length * 10 + 10 }, banners: { title: { ar: "", en: "", fr: "" }, subtitle: { ar: "", en: "", fr: "" }, image: "", storeId: "", active: true, sortOrder: CATALOG.banners.length * 10 + 10 }, sections: { type: "custom", title: { ar: "", en: "", fr: "" }, visible: true, storeIds: [], sortOrder: CATALOG.sections.length * 10 + 10 } }[k];
        CATALOG[k].push(mk);
        renderHome();
      } else if (b.dataset.del) {
        if (!confirm(L("حذف هذا العنصر؟", "Delete this item?", "Supprimer ?"))) return;
        CATALOG[b.dataset.del].splice(Number(b.dataset.i), 1);
        renderHome();
      } else if (b.id === "stHomeSave") {
        const hint = el("stHomeHint");
        try {
          const out = await api("/api/admin/catalog", { method: "PUT", body: JSON.stringify(CATALOG) });
          CATALOG = { categories: out.categories, banners: out.banners, sections: out.sections };
          renderHome();
          toast("✅ " + L("تم الحفظ", "Saved", "Enregistré"));
        } catch (err) {
          hint.textContent = err.message;
        }
      }
    });
  }

  window.storesRenderHome = async function () {
    await loadCatalog();
    renderHome();
    bindHome();
  };

  window.storesReloadTypes();

  const tabBtn = el("menuTabHome");
  if (tabBtn) {
    tabBtn.textContent = L("الرئيسية", "Home", "Accueil");
    tabBtn.addEventListener("click", () => setMenuTab("home"));
  }
})();
