/* Store support inside the admin panel: (1) tickets opened by stores (reply / close / reopen),
   (2) contact channels the admin publishes to the stores' dashboards (add / edit / enable / order / delete).
   The SERVER authorises every call (lib/admin-roles.js); permOk() here only hides what the role cannot use.
   Loaded after admin.js (uses: api, el, lang, toast, token, permOk, setNotify, showAuth). */
"use strict";
(function () {
  const T = {
    ar: { title: "دعم المتاجر", tickets: "تذاكر المتاجر", channels: "قنوات الاتصال", refresh: "تحديث", close: "إغلاق", back: "رجوع",
      all: "كل الحالات", open: "بانتظار ردّنا", answered: "تم الرد", closed: "مغلقة", search: "بحث بالمتجر أو الموضوع…", none: "لا توجد تذاكر", pick: "اختر تذكرة من القائمة",
      type: "اكتب ردّك…", send: "إرسال", closeTicket: "إغلاق التذكرة", reopen: "إعادة فتح", noMsgs: "لا رسائل", store: "المتجر", you: "الإدارة", sent: "تم الإرسال", failed: "تعذّر التنفيذ",
      chIntro: "هذه الأرقام والعناوين تظهر في لوحة المتاجر داخل قسم «المساعدة والدعم»، وكل تغيير يظهر لهم مباشرة.", add: "إضافة قناة", edit: "تعديل", del: "حذف", up: "أعلى", down: "أسفل",
      kind: "النوع", phone: "هاتف", whatsapp: "واتساب", email: "بريد إلكتروني", telegram: "تيليغرام", labelAr: "الاسم (عربي)", labelFr: "الاسم (فرنسي)", labelEn: "الاسم (إنجليزي)",
      value: "الرقم أو العنوان", hours: "ساعات العمل (اختياري)", audience: "تظهر لـ", stores: "المتاجر", drivers: "السائقين", customers: "الزبائن", enabled: "مفعّلة", save: "حفظ", cancel: "إلغاء",
      confirmDel: "حذف هذه القناة نهائياً؟", noCh: "لم تُضَف أي قناة بعد", disabled: "معطّلة", saved: "تم الحفظ", deleted: "تم الحذف", viewOnly: "عرض فقط: لا تملك صلاحية تعديل القنوات.",
      ph_phone: "+212612345678", ph_whatsapp: "+212612345678", ph_email: "support@siymon7.com", ph_telegram: "@siymon_support",
      INVALID_VALUE: "القيمة غير صحيحة لهذا النوع (رقم 8-15 رقماً، أو بريد صحيح، أو اسم تيليغرام).", LABEL_REQUIRED: "اكتب اسم القناة.", AUDIENCE_REQUIRED: "اختر لمن تظهر.", DUPLICATE: "هذه القناة موجودة مسبقاً.", TOO_MANY: "بلغتَ الحد الأقصى من القنوات.",
      TICKET_CLOSED: "التذكرة مغلقة", TEXT_REQUIRED: "اكتب رسالة", cat: { orders: "الطلبات", products: "المنتجات", payments: "المدفوعات", technical: "مشكلة تقنية", account: "الحساب", other: "أخرى" } },
    fr: { title: "Support boutiques", tickets: "Tickets des boutiques", channels: "Canaux de contact", refresh: "Actualiser", close: "Fermer", back: "Retour",
      all: "Tous les statuts", open: "À traiter", answered: "Répondu", closed: "Clos", search: "Chercher boutique ou sujet…", none: "Aucun ticket", pick: "Choisissez un ticket",
      type: "Votre réponse…", send: "Envoyer", closeTicket: "Clore le ticket", reopen: "Rouvrir", noMsgs: "Aucun message", store: "Boutique", you: "Équipe", sent: "Envoyé", failed: "Échec",
      chIntro: "Ces numéros et adresses s'affichent dans le tableau de bord des boutiques (Aide et support); chaque changement est visible aussitôt.", add: "Ajouter un canal", edit: "Modifier", del: "Supprimer", up: "Monter", down: "Descendre",
      kind: "Type", phone: "Téléphone", whatsapp: "WhatsApp", email: "E-mail", telegram: "Telegram", labelAr: "Nom (arabe)", labelFr: "Nom (français)", labelEn: "Nom (anglais)",
      value: "Numéro ou adresse", hours: "Horaires (facultatif)", audience: "Visible par", stores: "Boutiques", drivers: "Livreurs", customers: "Clients", enabled: "Activé", save: "Enregistrer", cancel: "Annuler",
      confirmDel: "Supprimer définitivement ce canal ?", noCh: "Aucun canal pour l'instant", disabled: "désactivé", saved: "Enregistré", deleted: "Supprimé", viewOnly: "Lecture seule : vous ne pouvez pas modifier les canaux.",
      ph_phone: "+212612345678", ph_whatsapp: "+212612345678", ph_email: "support@siymon7.com", ph_telegram: "@siymon_support",
      INVALID_VALUE: "Valeur invalide pour ce type (8-15 chiffres, e-mail valide ou nom Telegram).", LABEL_REQUIRED: "Saisissez le nom du canal.", AUDIENCE_REQUIRED: "Choisissez qui le voit.", DUPLICATE: "Ce canal existe déjà.", TOO_MANY: "Nombre maximum de canaux atteint.",
      TICKET_CLOSED: "Ticket clos", TEXT_REQUIRED: "Écrivez un message", cat: { orders: "Commandes", products: "Produits", payments: "Paiements", technical: "Technique", account: "Compte", other: "Autre" } },
    en: { title: "Store support", tickets: "Store tickets", channels: "Contact channels", refresh: "Refresh", close: "Close", back: "Back",
      all: "All statuses", open: "Awaiting us", answered: "Answered", closed: "Closed", search: "Search store or subject…", none: "No tickets", pick: "Pick a ticket from the list",
      type: "Type your reply…", send: "Send", closeTicket: "Close ticket", reopen: "Reopen", noMsgs: "No messages", store: "Store", you: "Admin", sent: "Sent", failed: "Failed",
      chIntro: "These numbers and addresses appear in the stores' dashboard under Help & support; every change shows up for them at once.", add: "Add channel", edit: "Edit", del: "Delete", up: "Up", down: "Down",
      kind: "Type", phone: "Phone", whatsapp: "WhatsApp", email: "Email", telegram: "Telegram", labelAr: "Name (Arabic)", labelFr: "Name (French)", labelEn: "Name (English)",
      value: "Number or address", hours: "Hours (optional)", audience: "Shown to", stores: "Stores", drivers: "Drivers", customers: "Customers", enabled: "Enabled", save: "Save", cancel: "Cancel",
      confirmDel: "Delete this channel for good?", noCh: "No channel yet", disabled: "disabled", saved: "Saved", deleted: "Deleted", viewOnly: "View only: you may not edit channels.",
      ph_phone: "+212612345678", ph_whatsapp: "+212612345678", ph_email: "support@siymon7.com", ph_telegram: "@siymon_support",
      INVALID_VALUE: "Invalid value for this type (8-15 digits, a valid email or a Telegram name).", LABEL_REQUIRED: "Enter the channel name.", AUDIENCE_REQUIRED: "Choose who sees it.", DUPLICATE: "This channel already exists.", TOO_MANY: "Channel limit reached.",
      TICKET_CLOSED: "Ticket is closed", TEXT_REQUIRED: "Write a message", cat: { orders: "Orders", products: "Products", payments: "Payments", technical: "Technical", account: "Account", other: "Other" } },
  };
  const t = () => T[typeof lang !== "undefined" && T[lang] ? lang : "ar"];
  const L = () => (typeof lang !== "undefined" && T[lang] ? lang : "ar");
  const $ = (id) => document.getElementById(id);
  const ICON = { phone: "📞", whatsapp: "💬", email: "✉️", telegram: "✈️" };
  const nm = (o) => (o && (o[L()] || o.ar || o.en || o.fr)) || "";
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const can = (p) => (typeof permOk === "function" ? permOk(p) : true);
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(L() === "ar" ? "ar-MA" : L(), { dateStyle: "short", timeStyle: "short" }); } catch (_e) { return ""; } };
  const hint = (m, ok) => { const h = $("ssHint"); if (h) { h.textContent = m || ""; h.classList.toggle("ok", !!ok); } };
  const errText = (e) => { const c = e && e.body && e.body.code; return (c && t()[c]) || (e && e.message) || t().failed; };

  const S = { tab: "tickets", tickets: [], active: null, lastId: null, msgs: [], channels: [], editing: null, timer: null, badgeTimer: null, cid: null, busy: false };

  /* ---------------- text ---------------- */
  function applyText() {
    const x = t();
    $("ssTitle").textContent = x.title; if ($("storeSupportText")) $("storeSupportText").textContent = x.title;
    document.querySelectorAll("#storeSupportModal [data-ssl]").forEach((n) => { const v = x[n.getAttribute("data-ssl")]; if (v) n.textContent = v; });
    const kindSel = $("ssfKind"); if (kindSel) Array.from(kindSel.options).forEach((o) => { if (x[o.value]) o.textContent = x[o.value]; }); $("ssTabTickets").firstChild.textContent = x.tickets; $("ssTabChannels").textContent = x.channels;
    $("ssRefresh").title = x.refresh; $("ssRefresh").setAttribute("aria-label", x.refresh); $("ssClose").title = x.close; $("ssClose").setAttribute("aria-label", x.close);
    const sel = $("ssStatus"); const cur = sel.value; sel.replaceChildren();
    [["", x.all], ["open", x.open], ["answered", x.answered], ["closed", x.closed]].forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; sel.appendChild(o); });
    sel.value = cur; $("ssSearch").placeholder = x.search; $("ssInput").placeholder = x.type; $("ssSend").textContent = x.send;
    $("ssBackBtn").title = x.back; $("ssBackBtn").setAttribute("aria-label", x.back);
  }

  /* ---------------- tickets ---------------- */
  async function loadTickets() {
    if (!can("support.use")) return;
    const qs = new URLSearchParams(); if ($("ssStatus").value) qs.set("status", $("ssStatus").value); if ($("ssSearch").value.trim()) qs.set("q", $("ssSearch").value.trim());
    const r = await api("/api/admin/store-support/tickets?" + qs.toString());
    S.tickets = r.tickets || []; renderList(); setBadge(r.unread || 0);
  }
  function renderList() {
    const box = $("ssItems"); box.replaceChildren();
    if (!S.tickets.length) { box.appendChild(mk("div", "ss-empty", t().none)); return; }
    S.tickets.forEach((k) => {
      const b = mk("button", "ss-item" + (S.active === k.id ? " on" : "")); b.type = "button"; b.dataset.id = k.id;
      const top = mk("b"); top.appendChild(mk("span", "", nm(k.storeName) || k.storeId));
      const right = mk("span"); if (k.unread) right.appendChild(mk("span", "ss-b", String(k.unread))); right.appendChild(mk("span", "ss-pill " + k.status, t()[k.status]));
      top.appendChild(right);
      b.appendChild(top); b.appendChild(mk("span", "", k.subject));
      b.appendChild(mk("small", "", (k.lastFrom === "store" ? "← " : "→ ") + k.preview + " · " + fmt(k.lastMessageAt)));
      b.addEventListener("click", () => openTicket(k.id));
      box.appendChild(b);
    });
  }
  async function openTicket(id) {
    S.active = id; S.lastId = null; S.msgs = []; S.cid = null; hint("");
    $("ssBody").classList.add("open"); renderList();
    try { await pollThread(true); } catch (e) { hint(errText(e)); }
  }
  async function pollThread(full) {
    if (!S.active) return;
    const id = S.active;
    const r = await api("/api/admin/store-support/tickets/" + encodeURIComponent(id) + (full || !S.lastId ? "" : "?after=" + encodeURIComponent(S.lastId)));
    if (id !== S.active) return; // switched while waiting
    if (full || r.reset) S.msgs = r.messages || []; else S.msgs = S.msgs.concat(r.messages || []);
    S.lastId = r.lastId; renderThread(r.ticket);
  }
  function renderThread(k) {
    $("ssEmpty").hidden = true; $("ssThreadBox").hidden = false;
    $("ssWho").textContent = nm(k.storeName) || k.storeId; $("ssSubj").textContent = k.id + " · " + k.subject + " · " + (t().cat[k.category] || k.category);
    const st = $("ssStatusBtn"); st.textContent = k.status === "closed" ? t().reopen : t().closeTicket; st.dataset.to = k.status === "closed" ? "open" : "closed";
    $("ssInput").disabled = k.status === "closed" && false;
    const box = $("ssMsgs"), atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || !box.children.length;
    box.replaceChildren();
    if (!S.msgs.length) box.appendChild(mk("div", "ss-empty", t().noMsgs));
    S.msgs.forEach((m) => { const d = mk("div", "ss-m " + (m.from === "admin" ? "admin" : "store"), m.text); d.appendChild(mk("small", "", (m.from === "admin" ? t().you : nm(k.storeName) || t().store) + " · " + fmt(m.at))); box.appendChild(d); });
    if (atEnd) box.scrollTop = box.scrollHeight;
    const i = S.tickets.findIndex((x) => x.id === k.id); if (i >= 0) { S.tickets[i] = k; renderList(); }
  }
  async function sendReply() {
    if (S.busy || !S.active) return;
    const inp = $("ssInput"), text = inp.value.trim(); if (!text) return;
    S.busy = true; $("ssSend").disabled = true; hint("");
    S.cid = S.cid || "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);   // a retry after a lost answer reuses it => never posted twice
    try {
      await api("/api/admin/store-support/tickets/" + encodeURIComponent(S.active) + "/messages", { method: "POST", body: JSON.stringify({ text, clientId: S.cid }) });
      inp.value = ""; S.cid = null; await pollThread(false); loadTickets().catch(() => {});
    } catch (e) { hint(errText(e)); } finally { S.busy = false; $("ssSend").disabled = false; }
  }
  async function toggleStatus() {
    const b = $("ssStatusBtn"); if (!S.active || b.disabled) return; b.disabled = true;
    try { await api("/api/admin/store-support/tickets/" + encodeURIComponent(S.active) + "/status", { method: "POST", body: JSON.stringify({ status: b.dataset.to }) }); await pollThread(true); await loadTickets(); }
    catch (e) { hint(errText(e)); } finally { b.disabled = false; }
  }

  /* ---------------- channels ---------------- */
  async function loadChannels() {
    if (!can("support.use")) return;
    const r = await api("/api/admin/support-channels"); S.channels = r.channels || []; renderChannels();
  }
  function renderChannels() {
    const box = $("ssChList"); box.replaceChildren();
    const w = can("support.manage");
    $("ssChNote").textContent = t().chIntro + (w ? "" : " " + t().viewOnly);
    $("ssAddCh").hidden = !w;
    if (!S.channels.length) box.appendChild(mk("div", "ss-empty", t().noCh));
    S.channels.forEach((c, i) => {
      const row = mk("div", "ss-ch" + (c.enabled === false ? " off" : "")); row.dataset.id = c.id;
      row.appendChild(mk("span", "ico", ICON[c.kind] || "•"));
      const mid = mk("div"); mid.appendChild(mk("b", "", nm(c.label))); mid.appendChild(mk("span", "val", c.value));
      mid.appendChild(mk("small", "", [t()[c.kind], (c.audience || []).map((a) => t()[a]).join(" / "), c.hours, c.enabled === false ? t().disabled : ""].filter(Boolean).join(" · ")));
      row.appendChild(mid);
      if (w) {
        const a = mk("div", "ss-acts");
        const btn = (txt, fn, cls, label) => { const b = mk("button", "ss-btn" + (cls ? " " + cls : ""), txt); b.type = "button"; if (label) b.setAttribute("aria-label", label); b.addEventListener("click", fn); a.appendChild(b); return b; };
        if (i > 0) btn("↑", () => move(i, -1), "", t().up); if (i < S.channels.length - 1) btn("↓", () => move(i, 1), "", t().down);
        btn(c.enabled === false ? "○" : "●", () => saveChannel(c.id, { ...c, enabled: c.enabled === false }), "", t().enabled);
        btn(t().edit, () => openForm(c)); btn(t().del, () => delChannel(c), "bad");
        row.appendChild(a);
      }
      box.appendChild(row);
    });
  }
  function openForm(c) {
    S.editing = c ? c.id : null; const f = $("ssForm"); f.hidden = false; hint("");
    $("ssfKind").value = c ? c.kind : "phone"; $("ssfAr").value = c ? c.label.ar || "" : ""; $("ssfFr").value = c ? c.label.fr || "" : ""; $("ssfEn").value = c ? c.label.en || "" : "";
    $("ssfValue").value = c ? c.value : ""; $("ssfHours").value = c ? c.hours || "" : ""; $("ssfEnabled").checked = c ? c.enabled !== false : true;
    ["stores", "drivers", "customers"].forEach((a) => { $("ssfA_" + a).checked = c ? (c.audience || []).includes(a) : a === "stores"; });
    kindHint(); f.scrollIntoView({ block: "nearest" }); $("ssfAr").focus();
  }
  function kindHint() { $("ssfValue").placeholder = t()["ph_" + $("ssfKind").value] || ""; }
  function formData() {
    const label = { ar: $("ssfAr").value.trim(), fr: $("ssfFr").value.trim(), en: $("ssfEn").value.trim() };
    return { kind: $("ssfKind").value, label, value: $("ssfValue").value.trim(), hours: $("ssfHours").value.trim(), enabled: $("ssfEnabled").checked,
      audience: ["stores", "drivers", "customers"].filter((a) => $("ssfA_" + a).checked) };
  }
  async function saveChannel(id, body) {
    hint("");
    try {
      await api(id ? "/api/admin/support-channels/" + encodeURIComponent(id) : "/api/admin/support-channels", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      $("ssForm").hidden = true; S.editing = null; await loadChannels(); hint(t().saved, true);
    } catch (e) { hint(errText(e)); }
  }
  async function delChannel(c) {
    if (!window.confirm(t().confirmDel)) return;
    try { await api("/api/admin/support-channels/" + encodeURIComponent(c.id), { method: "DELETE" }); await loadChannels(); hint(t().deleted, true); } catch (e) { hint(errText(e)); }
  }
  async function move(i, d) {
    const ids = S.channels.map((c) => c.id); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api("/api/admin/support-channels/reorder", { method: "POST", body: JSON.stringify({ ids }) }); await loadChannels(); } catch (e) { hint(errText(e)); }
  }

  /* ---------------- page + badge ---------------- */
  function setTab(tab) {
    S.tab = tab; $("ssTabTickets").classList.toggle("on", tab === "tickets"); $("ssTabChannels").classList.toggle("on", tab === "channels");
    $("ssBody").hidden = tab !== "tickets"; $("ssChannels").hidden = tab !== "channels"; hint("");
    (tab === "tickets" ? loadTickets() : loadChannels()).catch((e) => hint(errText(e)));
  }
  function setBadge(n) {
    const b = $("ssTicketBadge"); if (b) { b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n); }
    const base = t().title; if ($("storeSupportText")) $("storeSupportText").textContent = n ? base + " (" + n + ")" : base;
    if (typeof setNotify === "function") setNotify("storeSupportBtn", n > 0);
  }
  async function refreshBadge() {
    if (typeof token === "undefined" || !token || document.hidden || !can("support.use")) return;
    try { const r = await api("/api/admin/store-support/summary"); if (!$("storeSupportModal").classList.contains("show")) setBadge(r.unread || 0); } catch (_e) {}
  }
  function showStoreSupport(show) {
    const m = $("storeSupportModal"); m.classList.toggle("show", !!show);
    clearInterval(S.timer); S.timer = null;
    if (!show) return;
    S.timer = setInterval(() => {
      if (document.hidden) return;
      (S.tab === "tickets" ? Promise.all([loadTickets(), S.active ? pollThread(false) : null]) : Promise.resolve()).catch(() => {});
    }, 8000);
  }
  window.showStoreSupport = showStoreSupport;

  function init() {
    if (!$("storeSupportModal")) return;
    applyText();
    $("storeSupportBtn").addEventListener("click", async () => {
      if (typeof token === "undefined" || !token) return showAuth(true);
      try { S.active = null; $("ssEmpty").hidden = false; $("ssThreadBox").hidden = true; $("ssBody").classList.remove("open"); applyText(); setTab("tickets"); showStoreSupport(true); }
      catch (e) { toast(e.message); }
    });
    $("ssClose").addEventListener("click", () => showStoreSupport(false));
    $("ssRefresh").addEventListener("click", () => { (S.tab === "tickets" ? Promise.all([loadTickets(), S.active ? pollThread(true) : null]) : loadChannels()).catch((e) => hint(errText(e))); });
    $("ssTabTickets").addEventListener("click", () => setTab("tickets")); $("ssTabChannels").addEventListener("click", () => setTab("channels"));
    $("ssStatus").addEventListener("change", () => loadTickets().catch((e) => hint(errText(e))));
    let qt = null; $("ssSearch").addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => loadTickets().catch(() => {}), 300); });
    $("ssSend").addEventListener("click", sendReply);
    $("ssInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } });
    $("ssStatusBtn").addEventListener("click", toggleStatus);
    $("ssBackBtn").addEventListener("click", () => { $("ssBody").classList.remove("open"); S.active = null; renderList(); });
    $("ssAddCh").addEventListener("click", () => openForm(null));
    $("ssfKind").addEventListener("change", kindHint);
    $("ssfCancel").addEventListener("click", () => { $("ssForm").hidden = true; });
    $("ssfSave").addEventListener("click", () => saveChannel(S.editing, formData()));
    new MutationObserver(applyText).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    S.badgeTimer = setInterval(refreshBadge, 20000); setTimeout(refreshBadge, 2500);
  }
  init();
})();
