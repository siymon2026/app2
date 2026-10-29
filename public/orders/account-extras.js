/* Customer account extras (spec section 15): reorder, receipts, profile editing.
   Everything goes through the real authenticated APIs; nothing is stored or priced client-side.
   Relies on orders.js globals: api, el, lang, escapeHtml, loadMeAndOrders. */
(function () {
  "use strict";
  const T = (ar, fr, en) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
  const CART_KEY = "siymon_cart_v5";
  const REST_KEY = "siymon_selected_rest_v1";
  const money = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const REASONS = {
    removed: () => T("لم يعد موجودًا", "n'existe plus", "no longer exists"),
    unavailable: () => T("غير متاح حاليًا", "indisponible", "unavailable"),
    out_of_stock: () => T("نفد من المخزون", "en rupture de stock", "out of stock"),
  };

  /* ---------------- reorder ---------------- */
  async function reorder(orderId, btn) {
    btn.disabled = true;
    try {
      const r = await api(`/api/customer/orders/${encodeURIComponent(orderId)}/reorder`, { method: "POST", body: JSON.stringify({ lang }) });
      const notes = [];
      r.items.filter((i) => i.priceChanged).forEach((i) =>
        notes.push(`• ${i.name}: ${money(i.oldPrice)} → ${money(i.price)}`));
      r.items.filter((i) => i.qtyReduced).forEach((i) =>
        notes.push(`• ${i.name}: ${T("الكمية المتاحة", "quantité disponible", "available quantity")} ${i.qty}`));
      (r.unavailable || []).forEach((u) => notes.push(`• ${u.name}: ${(REASONS[u.reason] || REASONS.unavailable)()}`));
      if (notes.length && !confirm(T("تغيّرت بعض التفاصيل منذ طلبك السابق:\n", "Certains détails ont changé depuis votre dernière commande :\n", "Some details changed since your last order:\n") + notes.join("\n") + "\n\n" + T("متابعة؟", "Continuer ?", "Continue?"))) return;
      // Put the proposal into the normal cart; checkout re-validates price, stock and hours on the server.
      let obj = {};
      try { obj = JSON.parse(localStorage.getItem(CART_KEY) || "{}") || {}; } catch (_e) { obj = {}; }
      obj.items = r.items.map((i) => [i.id, i.qty]);
      localStorage.setItem(CART_KEY, JSON.stringify(obj));
      localStorage.setItem(REST_KEY, String(r.restaurantId));
      window.location.href = "/";
    } catch (e) {
      const m = {
        STORE_UNAVAILABLE: T("المتجر غير متاح حاليًا.", "Le magasin n'est pas disponible.", "This store is not available right now."),
        NOTHING_AVAILABLE: T("لا توجد منتجات من هذا الطلب متاحة الآن.", "Aucun article de cette commande n'est disponible.", "None of this order's items are available now."),
      }[e.code];
      alert(m || e.message);
    } finally { btn.disabled = false; }
  }

  /* ---------------- receipt ---------------- */
  function receiptHtml(r) {
    const rows = r.items.map((i) => `<tr><td>${escapeHtml(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.lineTotal)}</td></tr>`).join("");
    const line = (label, v, strong) => `<tr class="${strong ? "rc-total" : ""}"><td colspan="3">${escapeHtml(label)}</td><td>${money(v)} ${escapeHtml(r.currency)}</td></tr>`;
    return `<div class="rc" dir="${lang === "ar" ? "rtl" : "ltr"}">
      <h3>${escapeHtml(T("إيصال الطلب", "Reçu de commande", "Order receipt"))} #${escapeHtml(r.number)}</h3>
      <p>${escapeHtml(r.store)}<br><small>${escapeHtml(r.issuedAt ? new Date(r.issuedAt).toLocaleString() : "")}</small></p>
      <table><thead><tr><th>${escapeHtml(T("المنتج", "Article", "Item"))}</th><th>${escapeHtml(T("الكمية", "Qté", "Qty"))}</th><th>${escapeHtml(T("السعر", "Prix", "Price"))}</th><th>${escapeHtml(T("المجموع", "Total", "Total"))}</th></tr></thead>
      <tbody>${rows}
      ${line(T("المجموع الفرعي", "Sous-total", "Subtotal"), r.subtotal)}
      ${line(T("التوصيل", "Livraison", "Delivery"), r.deliveryFee)}
      ${r.discount ? line(T("خصم", "Remise", "Discount") + (r.promoCode ? ` (${r.promoCode})` : ""), -r.discount) : ""}
      ${line(T("الإجمالي", "Total", "Total"), r.total, true)}</tbody></table>
      <p><small>${escapeHtml(T("طريقة الدفع", "Paiement", "Payment"))}: ${escapeHtml(r.paymentMethod || "—")}${r.paidFromWallet ? ` · ${escapeHtml(T("من المحفظة", "portefeuille", "wallet"))} ${money(r.paidFromWallet)}` : ""}</small></p>
      <p class="rc-actions"><button class="btn small" id="rcPrint">${escapeHtml(T("طباعة", "Imprimer", "Print"))}</button> <button class="btn ghost small" id="rcClose">${escapeHtml(T("إغلاق", "Fermer", "Close"))}</button></p>
    </div>`;
  }
  async function showReceipt(orderId, btn) {
    btn.disabled = true;
    try {
      const out = await api(`/api/customer/orders/${encodeURIComponent(orderId)}/receipt`);
      let box = document.getElementById("receiptOverlay");
      if (!box) {
        box = document.createElement("div");
        box.id = "receiptOverlay";
        box.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto";
        document.body.appendChild(box);
      }
      box.innerHTML = `<div style="background:var(--card,#fff);color:var(--text,#111);border-radius:14px;padding:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto">${receiptHtml(out.receipt)}</div>`;
      box.style.display = "flex";
      box.querySelector("#rcClose").onclick = () => { box.style.display = "none"; };
      box.querySelector("#rcPrint").onclick = () => window.print();
      box.onclick = (ev) => { if (ev.target === box) box.style.display = "none"; };
    } catch (e) {
      alert(e.code === "NOT_DELIVERED" ? T("الإيصال متاح بعد التسليم.", "Le reçu est disponible après la livraison.", "The receipt is available after delivery.") : e.message);
    } finally { btn.disabled = false; }
  }

  const list = document.getElementById("ordersList");
  if (list) {
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (action === "reorder" && id) reorder(id, btn);
      else if (action === "receipt" && id) showReceipt(id, btn);
    });
  }

  /* ---------------- profile editing ---------------- */
  window.siymonProfileEdit = function (me) {
    const btn = document.getElementById("pfEditBtn");
    const host = document.getElementById("profileBox");
    if (!btn || !host) return;
    btn.addEventListener("click", () => {
      let f = document.getElementById("pfEditForm");
      if (f) { f.remove(); return; }
      f = document.createElement("form");
      f.id = "pfEditForm";
      f.style.cssText = "display:grid;gap:8px;margin-top:10px;width:100%";
      const inp = (name, label, val, type) => `<label style="display:grid;gap:3px"><small>${escapeHtml(label)}</small><input name="${name}" type="${type || "text"}" value="${escapeHtml(val || "")}" maxlength="120" style="padding:8px;border-radius:8px;border:1px solid var(--line,#ccc)"></label>`;
      f.innerHTML = inp("firstName", T("الاسم", "Prénom", "First name"), me.firstName) +
        inp("lastName", T("اللقب", "Nom", "Last name"), me.lastName) +
        inp("email", T("البريد الإلكتروني", "E-mail", "Email"), me.email, "email") +
        inp("phone", T("الهاتف", "Téléphone", "Phone"), me.phone, "tel") +
        `<small id="pfEditHint" style="color:var(--bad,#c0392b)"></small>
         <div><button class="btn small" type="submit">${escapeHtml(T("حفظ", "Enregistrer", "Save"))}</button></div>`;
      host.appendChild(f);
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const hint = f.querySelector("#pfEditHint");
        hint.textContent = "";
        const body = {};
        for (const k of ["firstName", "lastName", "email", "phone"]) {
          const v = String(f.elements[k].value || "").trim();
          if (v !== String(me[k] || "")) body[k] = v;
        }
        if (!Object.keys(body).length) { f.remove(); return; }
        try {
          await api("/api/customer/me", { method: "PATCH", body: JSON.stringify(body) });
          await loadMeAndOrders();
        } catch (err) {
          hint.textContent = {
            DUPLICATE_EMAIL: T("هذا البريد مستخدم بحساب آخر.", "Cet e-mail est déjà utilisé.", "This email is already used by another account."),
            DUPLICATE_PHONE: T("هذا الهاتف مستخدم بحساب آخر.", "Ce numéro est déjà utilisé.", "This phone is already used by another account."),
            INVALID_EMAIL: T("بريد غير صالح.", "E-mail invalide.", "Invalid email."),
            INVALID_PHONE: T("رقم هاتف غير صالح.", "Numéro invalide.", "Invalid phone number."),
          }[err.code] || err.message;
        }
      });
    });
  };
  try {
    if (document.getElementById("pfEditBtn")) window.siymonProfileEdit(JSON.parse(localStorage.getItem("siymon_customer_profile_v1") || "{}") || {});
  } catch (_e) {}
})();
