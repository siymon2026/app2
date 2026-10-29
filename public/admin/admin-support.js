/* Support chat UI (list, bubbles, header, new-chat picker, emoji, mobile back).
   Data/API logic (loading, polling, sending) lives in admin.js; this file only renders and wires the UI.
   Loaded after admin.js; relies on its globals: api, el, lang, toast, token, SUPPORT_CONVOS, SUPPORT_ACTIVE_ID, openSupportChat. */
"use strict";

const SC_T = {
  ar: { search: "بحث في المحادثات…", newChat: "محادثة جديدة", refresh: "تحديث", close: "إغلاق", back: "رجوع", call: "اتصال", emoji: "إيموجي",
        send: "إرسال", type: "اكتب رسالة…", pick: "اختر محادثة من القائمة أو ابدأ محادثة جديدة", empty: "لا توجد محادثات بعد",
        emptyHint: "اضغط + لبدء محادثة مع زبون", none: "لا نتائج", noMsgs: "لا رسائل بعد — ابدأ المحادثة", failed: "تعذّر تحميل الرسائل",
        retry: "إعادة المحاولة", today: "اليوم", yesterday: "أمس", you: "أنت", findCustomer: "ابحث عن زبون بالاسم أو الهاتف…",
        loadingCustomers: "جاري تحميل الزبائن…", noCustomers: "لا يوجد زبائن", conversations: "المحادثات", unread: "غير مقروءة" },
  fr: { search: "Rechercher une conversation…", newChat: "Nouvelle conversation", refresh: "Actualiser", close: "Fermer", back: "Retour", call: "Appeler", emoji: "Emoji",
        send: "Envoyer", type: "Écrire un message…", pick: "Choisissez une conversation ou démarrez-en une nouvelle", empty: "Aucune conversation",
        emptyHint: "Appuyez sur + pour écrire à un client", none: "Aucun résultat", noMsgs: "Aucun message — lancez la conversation", failed: "Impossible de charger les messages",
        retry: "Réessayer", today: "Aujourd’hui", yesterday: "Hier", you: "Vous", findCustomer: "Chercher un client (nom ou téléphone)…",
        loadingCustomers: "Chargement des clients…", noCustomers: "Aucun client", conversations: "Conversations", unread: "non lus" },
  en: { search: "Search chats…", newChat: "New chat", refresh: "Refresh", close: "Close", back: "Back", call: "Call", emoji: "Emoji",
        send: "Send", type: "Type a message…", pick: "Select a conversation or start a new one", empty: "No conversations yet",
        emptyHint: "Tap + to message a customer", none: "No results", noMsgs: "No messages yet — say hello", failed: "Couldn’t load messages",
        retry: "Retry", today: "Today", yesterday: "Yesterday", you: "You", findCustomer: "Find a customer by name or phone…",
        loadingCustomers: "Loading customers…", noCustomers: "No customers", conversations: "Conversations", unread: "unread" },
};
function scT() { return SC_T[lang] || SC_T.en; }

let SC_FILTER = "";
const SC_EXTRA = {};      // conversations started from the picker that do not exist on the server yet
let SC_SIG = "";          // signature of the rendered messages (skip identical re-renders from polling)
let SC_CHAT_ID = null;
let SC_CUSTOMERS = null;  // cache for the new-chat picker

/* ---------- small helpers ---------- */
function scName(c) { return (c && (c.customerName || c.customerPhone || c.customerEmail || c.customerId)) || "—"; }
function scLocale() { return lang === "ar" ? "ar-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-US"; }
function scTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(scLocale(), { hour: "2-digit", minute: "2-digit", hour12: lang === "en" });
}
function scDayKey(d) { return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
function scListTime(ts) {
  const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  if (scDayKey(d) === scDayKey(new Date())) return scTime(ts);
  return d.toLocaleDateString(scLocale(), { day: "2-digit", month: "2-digit" });
}
function scDayLabel(d) {
  const now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
  if (scDayKey(d) === scDayKey(now)) return scT().today;
  if (scDayKey(d) === scDayKey(y)) return scT().yesterday;
  return d.toLocaleDateString(scLocale(), { day: "numeric", month: "long", year: "numeric" });
}
function scAvatar(c, cls) {
  const a = document.createElement("span");
  a.className = "sc-avatar" + (cls ? " " + cls : "");
  const name = scName(c);
  const ini = document.createElement("span");
  ini.className = "sc-ini";
  ini.textContent = (Array.from(String(name).trim())[0] || "?").toUpperCase();
  a.appendChild(ini);
  const pic = c && c.customerPicture;
  if (pic) {
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.src = pic;
    img.addEventListener("load", () => a.classList.add("has-img"));
    img.addEventListener("error", () => img.remove());
    a.appendChild(img);
  }
  return a;
}
function scNode(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
const SC_ICONS = {
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  hello: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
};
function scState(icon, title, hint, actionLabel, onAction) {
  const w = scNode("div", "sc-state");
  const ic = scNode("div", "sc-state-ico");
  ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (SC_ICONS[icon] || SC_ICONS.chat) + "</svg>";
  w.appendChild(ic);
  w.appendChild(scNode("b", "", title));
  if (hint) w.appendChild(scNode("span", "muted", hint));
  if (actionLabel) { const b = scNode("button", "sc-retry", actionLabel); b.type = "button"; b.addEventListener("click", onAction); w.appendChild(b); }
  return w;
}

/* ---------- conversation list ---------- */
function scConvoItem(c) {
  const id = String(c.customerId);
  const unread = Number(c.unreadForAdmin || 0);
  const it = scNode("button", "sc-item" + (id === SUPPORT_ACTIVE_ID ? " active" : "") + (unread ? " unread" : ""));
  it.type = "button"; it.setAttribute("role", "listitem");
  if (id === SUPPORT_ACTIVE_ID) it.setAttribute("aria-current", "true");
  it.appendChild(scAvatar(c));
  const main = scNode("span", "sc-item-main");
  main.appendChild(scNode("b", "sc-item-name", scName(c)));
  main.appendChild(scNode("span", "sc-item-last", c.lastText || ""));
  it.appendChild(main);
  const meta = scNode("span", "sc-item-meta");
  meta.appendChild(scNode("time", "sc-item-time", scListTime(c.lastAt)));
  if (unread) { const b = scNode("span", "sc-badge", unread > 99 ? "99+" : String(unread)); b.title = unread + " " + scT().unread; meta.appendChild(b); }
  it.appendChild(meta);
  it.addEventListener("click", () => openSupportChat(id).catch((e) => toast(e.message)).finally(() => { if (matchMedia("(min-width:861px)").matches) el("supportMsgInput")?.focus(); }));
  return it;
}
function scRenderConvoList(body, list) {
  const q = SC_FILTER.trim().toLowerCase();
  const shown = !q ? list : list.filter((c) => [scName(c), c.customerPhone, c.customerEmail, c.lastText].join(" ").toLowerCase().includes(q));
  const frag = document.createDocumentFragment();
  if (!list.length) frag.appendChild(scState("chat", scT().empty, scT().emptyHint));
  else if (!shown.length) frag.appendChild(scState("search", scT().none));
  else shown.forEach((c) => frag.appendChild(scConvoItem(c)));
  const top = body.scrollTop;
  body.replaceChildren(frag);
  body.scrollTop = top;
}

/* ---------- chat header / messages ---------- */
function scApplyChatHeader(conv, id) {
  const c = conv || { customerId: id };
  el("supportChatWith").textContent = conv ? scName(conv) : id;
  const meta = conv ? [conv.customerPhone, conv.customerEmail].filter(Boolean).join(" · ") : "";
  el("supportChatMeta").textContent = meta;
  const av = scAvatar(c);
  const old = el("scChatAvatar");
  av.id = "scChatAvatar"; av.setAttribute("aria-hidden", "true");
  old.replaceWith(av);
  const call = el("scCall"), phone = String((conv && conv.customerPhone) || "").replace(/[^\d+]/g, "");
  call.hidden = !phone;
  call.href = phone ? "tel:" + phone : "#";
}
function scChatLoading() {
  SC_SIG = "";
  const box = el("supportChatBox");
  const sk = scNode("div", "sc-skel");
  for (let i = 0; i < 4; i++) sk.appendChild(scNode("span", "sc-skel-b " + (i % 2 ? "me" : "")));
  box.replaceChildren(sk);
}
function scChatError(e) {
  SC_SIG = "";
  el("supportChatBox").replaceChildren(scState("alert", scT().failed, e && e.message, scT().retry, () => { if (SUPPORT_ACTIVE_ID) { scChatLoading(); openSupportChat(SUPPORT_ACTIVE_ID).catch(() => {}); } }));
}
function scRenderMessages(box, list) {
  if (!SUPPORT_ACTIVE_ID) {
    SC_SIG = ""; SC_CHAT_ID = null;
    box.replaceChildren(scState("chat", scT().pick));
    return;
  }
  const last = list[list.length - 1];
  const sig = SUPPORT_ACTIVE_ID + "|" + list.length + "|" + (last ? last.id || last.createdAt : "") + "|" + lang;
  if (sig === SC_SIG) return;                       // nothing new (polling): keep scroll + selection
  const sameChat = SC_CHAT_ID === SUPPORT_ACTIVE_ID;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  SC_SIG = sig; SC_CHAT_ID = SUPPORT_ACTIVE_ID;
  const frag = document.createDocumentFragment();
  if (!list.length) frag.appendChild(scState("hello", scT().noMsgs));
  let day = "";
  for (const m of list) {
    const d = m.createdAt ? new Date(m.createdAt) : null;
    if (d && !isNaN(d.getTime()) && scDayKey(d) !== day) {
      day = scDayKey(d);
      frag.appendChild(scNode("div", "sc-day", scDayLabel(d)));
    }
    const me = String(m.from || "") === "admin";
    const row = scNode("div", "chat-msg " + (me ? "me" : ""));
    const bubble = scNode("div", "chat-bubble");
    bubble.appendChild(scNode("span", "sc-text", m.text || ""));
    bubble.appendChild(scNode("time", "sc-time", scTime(m.createdAt)));
    row.appendChild(bubble);
    frag.appendChild(row);
  }
  box.replaceChildren(frag);
  if (!sameChat || nearBottom) box.scrollTop = box.scrollHeight;
}

/* ---------- reset when the modal closes ---------- */
function scResetUi() {
  SC_FILTER = ""; SC_SIG = ""; SC_CHAT_ID = null;
  const s = el("scSearch"); if (s) s.value = "";
  scToggleNew(false); scToggleEmoji(false);
  el("supportModal")?.classList.remove("sc-chat-open");
}

/* ---------- new chat picker ---------- */
function scToggleNew(open) {
  const p = el("scNewPanel"), b = el("scNewBtn"); if (!p || !b) return;
  const want = open === undefined ? p.hidden : !!open;
  p.hidden = !want; b.setAttribute("aria-expanded", String(want)); b.classList.toggle("on", want);
  if (want) { el("scNewSearch").value = ""; scRenderCustomers(); el("scNewSearch").focus(); }
}
async function scRenderCustomers() {
  const box = el("scNewList"), q = (el("scNewSearch").value || "").trim().toLowerCase();
  if (!SC_CUSTOMERS) {
    box.replaceChildren(scState("clock", scT().loadingCustomers));
    try { const r = await api("/api/admin/customers"); SC_CUSTOMERS = Array.isArray(r.customers) ? r.customers : []; }
    catch (e) { box.replaceChildren(scState("alert", scT().failed, e.message, scT().retry, scRenderCustomers)); return; }
  }
  const norm = SC_CUSTOMERS.map((c) => ({
    customerId: String(c.id), customerPhone: c.phone || "", customerEmail: c.email || "", customerPicture: c.googlePicture || "",
    customerName: c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ").trim(),
  }));
  const shown = norm.filter((c) => !q || [scName(c), c.customerPhone, c.customerEmail].join(" ").toLowerCase().includes(q)).slice(0, 50);
  const frag = document.createDocumentFragment();
  if (!shown.length) frag.appendChild(scState("search", norm.length ? scT().none : scT().noCustomers));
  for (const c of shown) {
    const it = scNode("button", "sc-item sc-item-sm"); it.type = "button";
    it.appendChild(scAvatar(c));
    const main = scNode("span", "sc-item-main");
    main.appendChild(scNode("b", "sc-item-name", scName(c)));
    main.appendChild(scNode("span", "sc-item-last", [c.customerPhone, c.customerEmail].filter(Boolean).join(" · ")));
    it.appendChild(main);
    it.addEventListener("click", () => {
      SC_EXTRA[c.customerId] = c;
      scToggleNew(false);
      openSupportChat(c.customerId).then(() => el("supportMsgInput")?.focus()).catch((e) => toast(e.message));
    });
    frag.appendChild(it);
  }
  box.replaceChildren(frag);
}

/* ---------- emoji ---------- */
const SC_EMOJI = ["😀","😂","😊","😍","🙏","👍","👌","🙌","🎉","❤️","🔥","😉","😅","🤝","😢","😮","😎","🤔","👋","✅","⚠️","⏳","🍔","🍕","🛵","📦","📍","⭐","💯","🙂","😇","😴"];
function scToggleEmoji(open) {
  const p = el("scEmojiPop"), b = el("scEmojiBtn"); if (!p || !b) return;
  const want = open === undefined ? p.hidden : !!open;
  p.hidden = !want; b.setAttribute("aria-expanded", String(want));
}
function scInsert(text) {
  const i = el("supportMsgInput"), s = i.selectionStart ?? i.value.length, e = i.selectionEnd ?? s;
  i.value = i.value.slice(0, s) + text + i.value.slice(e);
  const pos = s + text.length; i.focus(); i.setSelectionRange(pos, pos);
}

/* ---------- labels (language aware) ---------- */
function scApplyLabels() {
  const t = scT();
  const set = (id, attr, v) => { const n = el(id); if (n) n.setAttribute(attr, v); };
  set("scSearch", "placeholder", t.search); set("scSearch", "aria-label", t.search);
  set("scNewSearch", "placeholder", t.findCustomer); set("scNewSearch", "aria-label", t.findCustomer);
  set("supportMsgInput", "placeholder", t.type); set("supportMsgInput", "aria-label", t.type);
  [["scNewBtn", t.newChat], ["refreshSupportBtn", t.refresh], ["closeSupportBtn", t.close], ["scBack", t.back], ["scCall", t.call], ["scEmojiBtn", t.emoji], ["supportSendBtn", t.send]]
    .forEach(([id, v]) => { set(id, "aria-label", v); set(id, "title", v); });
  const ct = el("supportConvosTitle"); if (ct) ct.textContent = t.conversations;
  SC_SIG = "";
  if (SUPPORT_ACTIVE_ID === null || SUPPORT_ACTIVE_ID === undefined) scRenderMessages(el("supportChatBox"), []);
  renderSupportConvos();
}

/* ---------- wiring ---------- */
(function init() {
  const modal = el("supportModal"); if (!modal) return;
  const pop = el("scEmojiPop");
  SC_EMOJI.forEach((em) => { const b = scNode("button", "", em); b.type = "button"; b.setAttribute("role", "option"); b.addEventListener("click", () => { scInsert(em); }); pop.appendChild(b); });
  el("scEmojiBtn").addEventListener("click", () => scToggleEmoji());
  el("scNewBtn").addEventListener("click", () => scToggleNew());
  el("scNewSearch").addEventListener("input", scRenderCustomers);
  el("scSearch").addEventListener("input", (e) => { SC_FILTER = e.target.value || ""; renderSupportConvos(); });
  el("scBack").addEventListener("click", () => {
    SUPPORT_ACTIVE_ID = null; SC_SIG = ""; SC_CHAT_ID = null;
    modal.classList.remove("sc-chat-open");
    renderSupportChat([]); renderSupportConvos();
  });
  el("supportSendBtn").addEventListener("click", () => scToggleEmoji(false));
  document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest("#scEmojiPop, #scEmojiBtn")) scToggleEmoji(false); });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!pop.hidden) { scToggleEmoji(false); e.stopPropagation(); }
    else if (!el("scNewPanel").hidden) { scToggleNew(false); e.stopPropagation(); }
  });
  // closing by any route (X button, admin.js) resets the UI state; opening refreshes the customer cache
  let wasShown = modal.classList.contains("show");
  new MutationObserver(() => {
    const now = modal.classList.contains("show");
    if (now === wasShown) return;
    wasShown = now;
    if (!now) scResetUi(); else SC_CUSTOMERS = null;
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(scApplyLabels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  scApplyLabels();
})();
