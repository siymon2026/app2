/* Service-zone manager (spec section 18).
   Supervisors draw each zone as a polygon on the map, set an optional maximum ROAD distance, activate/deactivate it and dry-run
   an address. Service zones decide WHERE we deliver; H3 rings (driver search) and road routing (fee/navigation) are separate
   and are not touched here.
   The SERVER is the authority: it validates the polygon and limits, checks the permission (zones.read to view, zones.manage to
   change), refuses stale edits (revision) and asks for confirmation before the last active zone is removed. This page only
   mirrors those rules so a role never sees controls it cannot use. All server text goes through textContent. */
"use strict";
(function () {
  const TOKEN_KEY = "siymon_admin_token_v2", LANG_KEY = "siymon_admin_lang_v1";
  const T = {
    ar: { title: "مناطق الخدمة", back: "← لوحة الإدارة", zones: "المناطق", add: "منطقة جديدة", none: "لا توجد مناطق. أضف منطقة وإلا لن يُقبل أي طلب.",
      active: "نشطة", inactive: "معطّلة", road: "حد المسافة الطرقية", noLimit: "الحد العام", km: "كم", area: "المساحة",
      nameAr: "الاسم بالعربية", nameFr: "الاسم بالفرنسية", nameEn: "الاسم بالإنجليزية", city: "المدينة", maxRoad: "أقصى مسافة طرقية (كم)",
      maxHelp: "اتركه فارغاً لاستعمال الحد العام. تُحسب المسافة بالطريق الفعلي لا بالخط المستقيم.",
      isActive: "المنطقة نشطة (تقبل الطلبات)", note: "ملاحظة داخلية", vertices: "عدد النقاط", save: "حفظ", cancel: "إلغاء", del: "حذف المنطقة",
      draw: "رسم النقاط", drawing: "إيقاف الرسم", undo: "تراجع", clear: "مسح الشكل", fit: "عرض المنطقة",
      hintView: "اختر منطقة لعرضها.", hintEdit: "فعّل «رسم النقاط» ثم انقر على الخريطة لإضافة نقاط. اسحب النقطة لتحريكها، وانقر عليها لحذفها.",
      hintTest: "انقر على الخريطة لاختبار عنوان.", formNew: "منطقة جديدة", formEdit: "تعديل المنطقة",
      testTitle: "اختبار عنوان", testHelp: "يحاكي ما سيراه الزبون عند الطلب من هذا الموقع، دون تغيير أي بيانات.", testBtn: "اختبار نقطة على الخريطة", testStop: "إيقاف الاختبار",
      inside: "داخل منطقة الخدمة", outside: "خارج منطقة الخدمة", testing: "جارٍ التحقق…",
      seeded: "هذه الحدود ابتدائية (دائرة تقريبية حول برشيد). ارسم الحدود الفعلية للمدينة ثم احفظ.",
      readOnly: "صلاحيتك تسمح بالعرض والاختبار فقط. تعديل المناطق لمدير النظام.", needLogin: "سجّل الدخول من لوحة الإدارة أولاً.",
      saved: "تم الحفظ", deleted: "تم الحذف", failed: "تعذّر التنفيذ", offline: "تعذّر الاتصال بالخادم. حاول مجدداً.", loading: "جارٍ التحميل…", retry: "إعادة المحاولة",
      confirmDel: "حذف هذه المنطقة نهائياً؟ الطلبات القادمة من عناوين داخلها سترفض إن لم توجد منطقة أخرى تغطيها.",
      confirmLast: "هذا سيترك النظام بلا أي منطقة نشطة، وسيتوقف قبول كل الطلبات. هل أنت متأكد؟",
      stale: "تغيّرت المناطق من مشرف آخر. تم تحديث القائمة، راجع التعديل ثم احفظ مجدداً.",
      needPoints: "ارسم 3 نقاط على الأقل.", needName: "اكتب اسم المنطقة والمدينة.", unsaved: "لديك تغييرات غير محفوظة. تجاهلها؟",
      POLYGON_TOO_SMALL: "الشكل يحتاج 3 نقاط مختلفة على الأقل.", POLYGON_TOO_LARGE: "عدد النقاط كبير جداً (الحد 200).", POLYGON_SELF_INTERSECTS: "حواف الشكل تتقاطع. أعد ترتيب النقاط.",
      POLYGON_AREA_TOO_SMALL: "المساحة صغيرة جداً.", POLYGON_AREA_TOO_LARGE: "المساحة كبيرة جداً.", POLYGON_INVALID_POINT: "إحداثيات غير صالحة.", POLYGON_REQUIRED: "ارسم المنطقة على الخريطة.",
      MAX_ROAD_KM_OUT_OF_RANGE: "المسافة يجب أن تكون بين 1 و60 كم.", NAME_REQUIRED: "الاسم مطلوب.", CITY_REQUIRED: "المدينة مطلوبة.", TOO_MANY_ZONES: "بلغت الحد الأقصى لعدد المناطق.", NOT_FOUND: "المنطقة غير موجودة.", Forbidden: "ليست لديك صلاحية لهذا الإجراء." },
    fr: { title: "Zones de service", back: "← Administration", zones: "Zones", add: "Nouvelle zone", none: "Aucune zone. Ajoutez-en une, sinon aucune commande ne sera acceptée.",
      active: "Active", inactive: "Désactivée", road: "Limite routière", noLimit: "Limite globale", km: "km", area: "Surface",
      nameAr: "Nom en arabe", nameFr: "Nom en français", nameEn: "Nom en anglais", city: "Ville", maxRoad: "Distance routière maximale (km)",
      maxHelp: "Laisser vide pour utiliser la limite globale. La distance est mesurée par la route réelle, pas en ligne droite.",
      isActive: "Zone active (accepte les commandes)", note: "Note interne", vertices: "Points", save: "Enregistrer", cancel: "Annuler", del: "Supprimer la zone",
      draw: "Dessiner les points", drawing: "Arrêter le dessin", undo: "Annuler le dernier", clear: "Effacer la forme", fit: "Cadrer la zone",
      hintView: "Choisissez une zone pour l'afficher.", hintEdit: "Activez « Dessiner les points » puis cliquez sur la carte. Glissez un point pour le déplacer, cliquez dessus pour le supprimer.",
      hintTest: "Cliquez sur la carte pour tester une adresse.", formNew: "Nouvelle zone", formEdit: "Modifier la zone",
      testTitle: "Tester une adresse", testHelp: "Simule ce que verrait le client en commandant depuis ce point, sans rien modifier.", testBtn: "Tester un point sur la carte", testStop: "Arrêter le test",
      inside: "Dans la zone de service", outside: "Hors de la zone de service", testing: "Vérification…",
      seeded: "Ces limites sont provisoires (cercle approximatif autour de Berrechid). Dessinez les vraies limites puis enregistrez.",
      readOnly: "Votre rôle permet seulement de consulter et tester. La modification est réservée à l'administrateur système.", needLogin: "Connectez-vous d'abord à l'administration.",
      saved: "Enregistré", deleted: "Supprimé", failed: "Échec", offline: "Serveur injoignable. Réessayez.", loading: "Chargement…", retry: "Réessayer",
      confirmDel: "Supprimer définitivement cette zone ? Les commandes depuis ses adresses seront refusées si aucune autre zone ne les couvre.",
      confirmLast: "Plus aucune zone active : toutes les commandes seront bloquées. Confirmer ?",
      stale: "Les zones ont été modifiées par un autre superviseur. Liste actualisée : vérifiez puis enregistrez à nouveau.",
      needPoints: "Dessinez au moins 3 points.", needName: "Saisissez le nom de la zone et la ville.", unsaved: "Modifications non enregistrées. Les abandonner ?",
      POLYGON_TOO_SMALL: "La forme exige au moins 3 points distincts.", POLYGON_TOO_LARGE: "Trop de points (max 200).", POLYGON_SELF_INTERSECTS: "Les côtés se croisent. Réorganisez les points.",
      POLYGON_AREA_TOO_SMALL: "Surface trop petite.", POLYGON_AREA_TOO_LARGE: "Surface trop grande.", POLYGON_INVALID_POINT: "Coordonnées invalides.", POLYGON_REQUIRED: "Dessinez la zone sur la carte.",
      MAX_ROAD_KM_OUT_OF_RANGE: "La distance doit être entre 1 et 60 km.", NAME_REQUIRED: "Nom requis.", CITY_REQUIRED: "Ville requise.", TOO_MANY_ZONES: "Nombre maximal de zones atteint.", NOT_FOUND: "Zone introuvable.", Forbidden: "Action non autorisée pour votre rôle." },
    en: { title: "Service zones", back: "← Admin panel", zones: "Zones", add: "New zone", none: "No zones. Add one, otherwise no order will be accepted.",
      active: "Active", inactive: "Inactive", road: "Road limit", noLimit: "Global limit", km: "km", area: "Area",
      nameAr: "Name (Arabic)", nameFr: "Name (French)", nameEn: "Name (English)", city: "City", maxRoad: "Maximum road distance (km)",
      maxHelp: "Leave empty to use the global limit. Distance is measured along the real road, not in a straight line.",
      isActive: "Zone is active (accepts orders)", note: "Internal note", vertices: "Points", save: "Save", cancel: "Cancel", del: "Delete zone",
      draw: "Draw points", drawing: "Stop drawing", undo: "Undo last", clear: "Clear shape", fit: "Fit zone",
      hintView: "Pick a zone to view it.", hintEdit: "Turn on “Draw points”, then click the map. Drag a point to move it, click it to remove it.",
      hintTest: "Click the map to test an address.", formNew: "New zone", formEdit: "Edit zone",
      testTitle: "Test an address", testHelp: "Simulates what a customer would get ordering from that point. Nothing is changed.", testBtn: "Test a point on the map", testStop: "Stop testing",
      inside: "Inside the service area", outside: "Outside the service area", testing: "Checking…",
      seeded: "These limits are a placeholder (a rough circle around Berrechid). Draw the real city boundary and save.",
      readOnly: "Your role can view and test only. Editing zones is for the system administrator.", needLogin: "Please sign in from the admin panel first.",
      saved: "Saved", deleted: "Deleted", failed: "Action failed", offline: "Cannot reach the server. Try again.", loading: "Loading…", retry: "Retry",
      confirmDel: "Delete this zone permanently? Orders from addresses inside it will be refused unless another zone covers them.",
      confirmLast: "This leaves NO active zone and blocks every order. Are you sure?",
      stale: "The zones were changed by another supervisor. The list was refreshed: review, then save again.",
      needPoints: "Draw at least 3 points.", needName: "Enter the zone name and the city.", unsaved: "You have unsaved changes. Discard them?",
      POLYGON_TOO_SMALL: "The shape needs at least 3 distinct points.", POLYGON_TOO_LARGE: "Too many points (max 200).", POLYGON_SELF_INTERSECTS: "Edges cross each other. Reorder the points.",
      POLYGON_AREA_TOO_SMALL: "Area is too small.", POLYGON_AREA_TOO_LARGE: "Area is too large.", POLYGON_INVALID_POINT: "Invalid coordinates.", POLYGON_REQUIRED: "Draw the zone on the map.",
      MAX_ROAD_KM_OUT_OF_RANGE: "Distance must be between 1 and 60 km.", NAME_REQUIRED: "Name is required.", CITY_REQUIRED: "City is required.", TOO_MANY_ZONES: "Maximum number of zones reached.", NOT_FOUND: "Zone not found.", Forbidden: "Your role may not do this." },
  };
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let lang = "ar";
  try { lang = localStorage.getItem(LANG_KEY) || "ar"; } catch (_e) { /* private mode */ }
  if (!T[lang]) lang = "ar";
  const t = () => T[lang];
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (_e) { return ""; } };

  const S = { ready: false, zones: [], revision: 0, canManage: false, selectedId: null, draft: null, dirty: false, draw: false, test: false, busy: false, map: null, layers: null, edit: null, testMarker: null, tiles: null };

  /* ---------- API ---------- */
  async function api(path, opts = {}) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    let res;
    try {
      res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", "X-Admin-Token": token() }, signal: ctl.signal });
    } catch (_e) { const e = new Error(t().offline); e.network = true; throw e; } finally { clearTimeout(tm); }
    let body = null;
    try { body = await res.json(); } catch (_e) { /* empty */ }
    if (res.status === 401) { const e = new Error(t().needLogin); e.status = 401; throw e; }
    if (!res.ok) { const e = new Error((body && (t()[body.code] || t()[body.error])) || (body && body.error) || t().failed); e.status = res.status; e.body = body; throw e; }
    return body;
  }

  /* ---------- small UI helpers ---------- */
  let toastTimer = null;
  function toast(msg, bad) {
    const el = $("znToast"); el.textContent = msg; el.classList.toggle("err", !!bad); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 6000 : 2800);
  }
  function setBusy(v) { S.busy = v; for (const id of ["znSave", "znDelete", "znNew"]) { const b = $(id); if (b) b.disabled = v; } }
  const nameOf = (z) => (z.name && (z.name[lang] || z.name.en || z.name.fr || z.name.ar)) || "";

  /* ---------- labels ---------- */
  function applyLabels() {
    const s = t();
    document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = "SIYMON — " + s.title;
    $("znTitle").textContent = s.title; $("znBack").textContent = s.back; $("znListTitle").textContent = s.zones; $("znNew").textContent = s.add;
    $("znTestTitle").textContent = s.testTitle; $("znTestHelp").textContent = s.testHelp;
    $("lNameAr").textContent = s.nameAr; $("lNameFr").textContent = s.nameFr; $("lNameEn").textContent = s.nameEn; $("lCity").textContent = s.city;
    $("lMax").textContent = s.maxRoad; $("lMaxHelp").textContent = s.maxHelp; $("lActive").textContent = s.isActive; $("lNote").textContent = s.note;
    $("znSave").textContent = s.save; $("znCancel").textContent = s.cancel; $("znDelete").textContent = s.del;
    $("znUndo").textContent = s.undo; $("znClear").textContent = s.clear; $("znFit").textContent = s.fit;
    $("znEmpty").textContent = s.none; $("znLang").value = lang;
    $("znRoleNote").textContent = s.readOnly; $("znRoleNote").hidden = S.canManage || !S.ready;
    $("znNew").hidden = !S.canManage;
    drawLabels(); renderList(); renderHint(); renderForm();
  }
  function drawLabels() {
    $("znDraw").textContent = S.draw ? t().drawing : t().draw; $("znDraw").classList.toggle("on", S.draw);
    $("znTestBtn").textContent = S.test ? t().testStop : t().testBtn; $("znTestBtn").classList.toggle("on", S.test);
    $("znMap").classList.toggle("drawing", S.draw); $("znMap").classList.toggle("testing", S.test);
  }
  function renderHint() { $("znMapHint").textContent = S.test ? t().hintTest : S.draft ? t().hintEdit : t().hintView; }

  /* ---------- list ---------- */
  function renderList() {
    const ul = $("znList"); ul.textContent = "";
    $("znEmpty").hidden = S.zones.length > 0;
    for (const z of S.zones) {
      const li = mk("li"), b = mk("button", "zn-item"); b.type = "button";
      if (z.id === S.selectedId) b.setAttribute("aria-current", "true");
      const head = mk("b"); head.appendChild(mk("span", null, nameOf(z)));
      head.appendChild(mk("span", "zn-pill " + (z.active !== false ? "on" : "off"), z.active !== false ? t().active : t().inactive));
      b.appendChild(head);
      b.appendChild(mk("small", null, `${z.city} · ${t().road}: ${z.maxRoadKm != null ? z.maxRoadKm + " " + t().km : t().noLimit}`));
      b.addEventListener("click", () => select(z.id));
      li.appendChild(b); ul.appendChild(li);
    }
    $("znSeedNote").hidden = !S.zones.some((z) => z.seeded);
    $("znSeedNote").textContent = t().seeded;
  }

  /* ---------- map ---------- */
  function initMap(cfg) {
    S.map = L.map("znMap", { zoomControl: true }).setView([33.2655, -7.5875], 12);
    L.tileLayer(cfg.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: cfg.attribution || "© OpenStreetMap contributors" }).addTo(S.map);
    S.layers = L.layerGroup().addTo(S.map);
    S.edit = L.layerGroup().addTo(S.map);
    S.map.on("click", onMapClick);
  }
  const style = (z, sel) => ({ color: z.active !== false ? "#337418" : "#7a7a7a", weight: sel ? 3 : 2, fillColor: z.active !== false ? "#5DD62C" : "#9a9a9a", fillOpacity: sel ? 0.12 : 0.18, dashArray: z.active !== false ? null : "6 6" });
  function drawZones() {
    S.layers.clearLayers();
    for (const z of S.zones) {
      if (S.draft && S.draft.id === z.id) continue; // the one being edited is drawn by the editor
      const p = L.polygon(z.polygon, style(z, z.id === S.selectedId)).addTo(S.layers);
      p.on("click", (ev) => { if (!S.draw && !S.test) { L.DomEvent.stopPropagation(ev); select(z.id); } });
    }
  }
  function drawEditor() {
    S.edit.clearLayers();
    if (!S.draft) return;
    const pts = S.draft.polygon;
    if (pts.length >= 3) L.polygon(pts, { color: "#5DD62C", weight: 3, fillColor: "#5DD62C", fillOpacity: 0.15 }).addTo(S.edit);
    else if (pts.length === 2) L.polyline(pts, { color: "#5DD62C", weight: 3 }).addTo(S.edit);
    pts.forEach((p, i) => {
      const m = L.marker(p, { draggable: S.canManage, icon: L.divIcon({ className: "", html: '<div class="zn-vtx"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), keyboard: false }).addTo(S.edit);
      m.on("drag", () => { S.draft.polygon[i] = [m.getLatLng().lat, m.getLatLng().lng]; S.dirty = true; redrawShapeOnly(); });
      m.on("dragend", () => { drawEditor(); renderForm(); });
      m.on("click", (ev) => { L.DomEvent.stopPropagation(ev); if (!S.canManage) return; if (S.draft.polygon.length <= 3) { toast(t().needPoints, true); return; } S.draft.polygon.splice(i, 1); S.dirty = true; drawEditor(); renderForm(); });
    });
  }
  let shape = null;
  function redrawShapeOnly() {
    S.edit.eachLayer((l) => { if (l instanceof L.Polyline) shape = l; });
    if (shape && S.draft.polygon.length >= 3) { try { shape.setLatLngs(S.draft.polygon); } catch (_e) { /* redrawn on dragend */ } }
  }
  function fit() {
    const pts = S.draft ? S.draft.polygon : (S.zones.find((z) => z.id === S.selectedId) || {}).polygon || S.zones.flatMap((z) => z.polygon);
    if (pts && pts.length) S.map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
  }
  async function onMapClick(ev) {
    if (S.test) return runTest(ev.latlng);
    if (S.draw && S.draft && S.canManage) {
      if (S.draft.polygon.length >= 200) return toast(t().POLYGON_TOO_LARGE, true);
      S.draft.polygon.push([round6(ev.latlng.lat), round6(ev.latlng.lng)]); S.dirty = true; drawEditor(); renderForm();
    }
  }
  const round6 = (n) => Math.round(n * 1e6) / 1e6;

  /* ---------- dry run ---------- */
  async function runTest(ll) {
    const out = $("znTestOut"); out.className = "zn-testout"; out.textContent = t().testing;
    if (S.testMarker) S.map.removeLayer(S.testMarker);
    S.testMarker = L.circleMarker(ll, { radius: 8, color: "#0F0F0F", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(S.map);
    try {
      const r = await api("/api/admin/service-zones/test", { method: "POST", body: JSON.stringify({ lat: ll.lat, lng: ll.lng }) });
      out.className = "zn-testout " + (r.inside ? "ok" : "no");
      out.textContent = r.inside ? `${t().inside} — ${r.zone.city}${r.zone.maxRoadKm != null ? " · " + t().road + " " + r.zone.maxRoadKm + " " + t().km : ""}` : `${t().outside} — ${(r.message && r.message[lang]) || ""}`;
    } catch (e) { out.className = "zn-testout no"; out.textContent = e.message; }
  }

  /* ---------- selection / form ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function confirmDiscard() { return !S.dirty || window.confirm(t().unsaved); }
  function select(id) {
    if (S.draft && S.draft.id !== id && !confirmDiscard()) return;
    const z = S.zones.find((x) => x.id === id); if (!z) return;
    S.selectedId = id; S.draft = clone(z); S.dirty = false; S.draw = false; stopTest();
    refreshAll(); fit();
  }
  function startNew() {
    if (!S.map || !confirmDiscard()) return;
    const c = S.map.getCenter();
    S.selectedId = null; S.draw = true; stopTest();
    S.draft = { id: null, name: { ar: "", fr: "", en: "" }, city: S.zones[0] ? S.zones[0].city : "", active: true, maxRoadKm: null, note: "", polygon: [] };
    S.dirty = false; refreshAll(); S.map.setView(c);
  }
  function stopTest() { S.test = false; if (S.testMarker) { S.map.removeLayer(S.testMarker); S.testMarker = null; } $("znTestOut").textContent = ""; $("znTestOut").className = "zn-testout"; }
  function refreshAll() { drawZones(); drawEditor(); renderList(); renderForm(); drawLabels(); renderHint(); }

  function renderForm() {
    const f = $("znForm"), d = S.draft, show = !!d && S.canManage;
    f.hidden = !show; $("znTools").hidden = !show; document.querySelector(".zn-main").classList.toggle("no-form", !show);
    if (!show) return;
    $("znFormTitle").textContent = d.id ? t().formEdit : t().formNew;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v == null ? "" : v; };
    set("fNameAr", d.name.ar); set("fNameFr", d.name.fr); set("fNameEn", d.name.en); set("fCity", d.city); set("fMax", d.maxRoadKm); set("fNote", d.note);
    $("fActive").checked = d.active !== false;
    $("znPolyInfo").textContent = `${t().vertices}: ${d.polygon.length}`;
    $("znDelete").hidden = !d.id; $("znErr").hidden = true;
  }
  function readForm() {
    const d = S.draft;
    d.name = { ar: $("fNameAr").value.trim(), fr: $("fNameFr").value.trim(), en: $("fNameEn").value.trim() };
    d.city = $("fCity").value.trim(); d.note = $("fNote").value.trim(); d.active = $("fActive").checked;
    const m = $("fMax").value.trim(); d.maxRoadKm = m === "" ? null : Number(m);
  }
  function showErr(msg) { const e = $("znErr"); e.textContent = msg; e.hidden = !msg; }

  async function load(keepSelection) {
    const r = await api("/api/admin/service-zones");
    S.zones = r.zones; S.revision = r.revision;
    if (!keepSelection || !S.zones.some((z) => z.id === S.selectedId)) { S.selectedId = null; S.draft = null; S.dirty = false; }
    else if (S.draft && !S.dirty) S.draft = clone(S.zones.find((z) => z.id === S.selectedId));
  }

  async function save(ev) {
    ev.preventDefault(); if (S.busy || !S.draft) return;
    readForm(); showErr("");
    const d = S.draft;
    if (d.polygon.length < 3) return showErr(t().needPoints);
    if (!(d.name.ar || d.name.fr || d.name.en) || !d.city) return showErr(t().needName);
    const body = { name: d.name, city: d.city, active: d.active, maxRoadKm: d.maxRoadKm, note: d.note, polygon: d.polygon, revision: S.revision };
    await send(d.id ? "PUT" : "POST", d.id ? "/api/admin/service-zones/" + encodeURIComponent(d.id) : "/api/admin/service-zones", body, async (r) => {
      toast(t().saved); S.dirty = false; S.selectedId = r.zone.id; await load(true); S.draft = clone(S.zones.find((z) => z.id === r.zone.id)); S.draw = false; refreshAll();
    });
  }
  async function remove() {
    if (S.busy || !S.draft || !S.draft.id) return;
    if (!window.confirm(t().confirmDel)) return;
    await send("DELETE", "/api/admin/service-zones/" + encodeURIComponent(S.draft.id), { revision: S.revision }, async () => {
      toast(t().deleted); S.selectedId = null; S.draft = null; S.dirty = false; await load(false); refreshAll();
    });
  }
  /** One request; handles stale revision and the "last active zone" confirmation the server demands. */
  async function send(method, url, body, onOk) {
    setBusy(true);
    try {
      let r;
      try { r = await api(url, { method, body: JSON.stringify(body) }); }
      catch (e) {
        if (e.body && e.body.code === "LAST_ACTIVE_ZONE") {
          if (!window.confirm(t().confirmLast)) throw Object.assign(new Error(""), { silent: true });
          r = await api(url, { method, body: JSON.stringify({ ...body, confirmBlockAll: true }) });
        } else throw e;
      }
      await onOk(r);
    } catch (e) {
      if (e.silent) { /* declined */ }
      else if (e.body && e.body.code === "STALE_REVISION") { toast(t().stale, true); const keep = S.draft; await load(true).catch(() => {}); if (keep) { S.draft = keep; S.dirty = true; } refreshAll(); }
      else if (e.status === 401) { showErr(t().needLogin); }
      else { showErr(e.message || t().failed); toast(e.message || t().failed, true); }
    } finally { setBusy(false); }
  }

  /* ---------- boot ---------- */
  function wire() {
    // When embedded, the existing Back link returns to Orders in the parent shell.
    if (window.parent !== window && new URLSearchParams(location.search).get("embedded") === "1") {
      $("znBack").addEventListener("click", (e) => {
        e.preventDefault();
        if (window.parent.adminNav) window.parent.adminNav.go("home");
      });
      window.addEventListener("message", (e) => {
        if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.type !== "siymon:zones-visible") return;
        if (S.map && typeof S.map.invalidateSize === "function") S.map.invalidateSize();
      });
      window.addEventListener("storage", (e) => {
        if (e.key !== LANG_KEY || !T[e.newValue] || e.newValue === lang) return;
        if (S.draft) readForm();
        lang = e.newValue; applyLabels();
      });
    }
    $("znLang").addEventListener("change", (e) => { lang = e.target.value; try { localStorage.setItem(LANG_KEY, lang); } catch (_e) { /* ignore */ } if (S.draft) readForm(); applyLabels(); });
    $("znNew").addEventListener("click", startNew);
    $("znForm").addEventListener("submit", save);
    $("znForm").addEventListener("input", () => { if (S.draft) { S.dirty = true; } });
    $("znCancel").addEventListener("click", () => { if (!confirmDiscard()) return; S.draft = null; S.selectedId = null; S.dirty = false; S.draw = false; refreshAll(); });
    $("znDelete").addEventListener("click", remove);
    $("znDraw").addEventListener("click", () => { S.draw = !S.draw; if (S.draw) stopTest(); drawLabels(); renderHint(); });
    $("znUndo").addEventListener("click", () => { if (S.draft && S.draft.polygon.length) { S.draft.polygon.pop(); S.dirty = true; drawEditor(); renderForm(); } });
    $("znClear").addEventListener("click", () => { if (S.draft && S.draft.polygon.length) { S.draft.polygon = []; S.dirty = true; drawEditor(); renderForm(); } });
    $("znFit").addEventListener("click", fit);
    $("znTestBtn").addEventListener("click", () => { if (S.test) stopTest(); else { S.test = true; S.draw = false; } drawLabels(); renderHint(); });
    window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
  }

  async function boot() {
    applyLabels(); wire();
    if (!token()) { $("znRoleNote").hidden = false; $("znRoleNote").textContent = t().needLogin; $("znMap").textContent = ""; return; }
    try {
      const [me, cfg] = await Promise.all([api("/api/admin/me"), fetch("/api/map-config").then((r) => r.json()).catch(() => ({}))]);
      const perms = me.permissions || [];
      S.canManage = perms.includes("*") || perms.includes("zones.manage"); S.ready = true;
      initMap(cfg);
      await load(false);
      applyLabels(); refreshAll();
      if (S.zones.length) { S.map.fitBounds(L.latLngBounds(S.zones.flatMap((z) => z.polygon)), { padding: [30, 30] }); }
    } catch (e) {
      const n = $("znRoleNote"); n.hidden = false; n.textContent = e.status === 403 ? t().Forbidden : e.message || t().failed;
      if (!S.map && window.L) initMap({});
    }
  }
  boot();
})();
