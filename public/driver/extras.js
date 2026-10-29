/* Driver extras: "Customer ratings" card in the profile tab. */
(function () {
  "use strict";
  const TX = {
    ar: { title: "تقييمات الزبناء", none: "لا توجد تقييمات بعد", based: "من", rates: "تقييم", recent: "آخر التعليقات", err: "تعذّر تحميل التقييمات" },
    en: { title: "Customer ratings", none: "No ratings yet", based: "from", rates: "ratings", recent: "Recent comments", err: "Couldn't load ratings" },
    fr: { title: "Avis des clients", none: "Pas encore d'avis", based: "sur", rates: "avis", recent: "Derniers commentaires", err: "Chargement impossible" },
  };
  const T = () => TX[typeof lang !== "undefined" ? lang : "ar"] || TX.ar;
  const $ = (id) => document.getElementById(id);
  const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  function mk(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  async function loadRatings() {
    const box = $("ratingsCard"); if (!box) return;
    const t = T(); box.hidden = false; box.textContent = "";
    box.appendChild(mk("div", "rt-title", t.title));
    try {
      const r = await api("/api/driver/ratings");
      if (!r.count) { box.appendChild(mk("p", "muted", t.none)); return; }
      const top = mk("div", "rt-top");
      top.appendChild(mk("b", "rt-avg", r.avg.toFixed(1)));
      const side = mk("div", "rt-side");
      side.appendChild(mk("div", "rt-stars", stars(r.avg)));
      side.appendChild(mk("div", "muted", `${t.based} ${r.count} ${t.rates}`));
      top.appendChild(side); box.appendChild(top);
      const dist = mk("div", "rt-dist");
      for (let i = 5; i >= 1; i--) {
        const row = mk("div", "rt-row"); row.appendChild(mk("span", null, String(i)));
        const bar = mk("div", "rt-bar"), fill = mk("i"); fill.style.width = Math.round(((r.dist[i] || 0) / r.count) * 100) + "%";
        bar.appendChild(fill); row.appendChild(bar); row.appendChild(mk("span", "muted", String(r.dist[i] || 0))); dist.appendChild(row);
      }
      box.appendChild(dist);
      const withText = (r.reviews || []).filter((x) => x.comment);
      if (withText.length) {
        box.appendChild(mk("div", "rt-sub", t.recent));
        withText.slice(0, 10).forEach((x) => {
          const it = mk("div", "rt-rev");
          it.appendChild(mk("span", "rt-stars", stars(x.stars)));
          it.appendChild(mk("p", null, x.comment));
          if (x.at) it.appendChild(mk("span", "muted", new Date(x.at).toLocaleDateString()));
          box.appendChild(it);
        });
      }
    } catch (_e) { box.appendChild(mk("p", "muted", t.err)); }
  }
  /* ---------------- complaints about THIS driver (spec 16) ----------------
     The server returns only complaints routed to the signed-in driver, with no customer identity.
     The driver answers once while the complaint waits for them; unanswered ones escalate to the supervisor by themselves. */
  const CX = {
    ar: { title: "شكاوى الزبناء", none: "لا توجد شكاوى", reply: "ردّك", hint: "اكتب ردّك (توضيح أو اعتذار أو حل)", send: "إرسال الرد", sent: "تم إرسال ردّك", deadline: "الرد قبل", err: "تعذّر الإرسال", back: "إغلاق",
      st: { with_party: "تنتظر ردّك", party_responded: "تم ردّك", escalated: "عند المشرف", in_review: "قيد المراجعة", resolved: "مغلقة" },
      cat: { food_quality: "جودة الطعام", missing_items: "أصناف ناقصة", wrong_order: "طلب خاطئ", late_delivery: "تأخر التوصيل", driver_behavior: "سلوك السائق", extra_charge: "مبلغ إضافي", payment: "الدفع", other: "أخرى" },
      who: { customer: "الزبون", driver: "أنت", supervisor: "الدعم", system: "النظام", store: "المتجر" } },
    en: { title: "Customer complaints", none: "No complaints", reply: "Your answer", hint: "Write your answer (explanation, apology or solution)", send: "Send answer", sent: "Answer sent", deadline: "Answer before", err: "Couldn't send", back: "Close",
      st: { with_party: "Waiting for you", party_responded: "Answered", escalated: "With supervisor", in_review: "Under review", resolved: "Closed" },
      cat: { food_quality: "Food quality", missing_items: "Missing items", wrong_order: "Wrong order", late_delivery: "Late delivery", driver_behavior: "Driver behaviour", extra_charge: "Extra charge", payment: "Payment", other: "Other" },
      who: { customer: "Customer", driver: "You", supervisor: "Support", system: "System", store: "Store" } },
    fr: { title: "Réclamations clients", none: "Aucune réclamation", reply: "Votre réponse", hint: "Votre réponse (explication, excuses ou solution)", send: "Envoyer", sent: "Réponse envoyée", deadline: "Répondre avant", err: "Envoi impossible", back: "Fermer",
      st: { with_party: "Attend votre réponse", party_responded: "Répondu", escalated: "Chez le superviseur", in_review: "En examen", resolved: "Clôturée" },
      cat: { food_quality: "Qualité des plats", missing_items: "Articles manquants", wrong_order: "Mauvaise commande", late_delivery: "Livraison en retard", driver_behavior: "Comportement", extra_charge: "Montant en plus", payment: "Paiement", other: "Autre" },
      who: { customer: "Client", driver: "Vous", supervisor: "Support", system: "Système", store: "Magasin" } },
  };
  const CT = () => CX[typeof lang !== "undefined" ? lang : "ar"] || CX.ar;
  const when = (iso) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); } catch (_e) { return ""; } };
  let cpBusy = false;

  async function loadComplaints() {
    let box = $("complaintsCard");
    if (!box) { const r = $("ratingsCard"); if (!r) return; box = mk("section"); box.id = "complaintsCard"; box.setAttribute("aria-live", "polite"); r.parentNode.insertBefore(box, r.nextSibling); }
    const c = CT(); box.textContent = "";
    let list;
    try { list = (await api("/api/driver/complaints")).complaints || []; } catch (_e) { box.hidden = true; return; }
    box.hidden = false; box.className = "rt-card";
    box.appendChild(mk("div", "rt-title", c.title));
    if (!list.length) { box.appendChild(mk("p", "muted", c.none)); return; }
    list.forEach((x) => {
      const it = mk("button", "rt-rev"); it.type = "button"; it.style.cssText = "display:block;width:100%;text-align:start;background:none;border-width:1px 0 0;color:inherit;font:inherit";
      it.append(mk("b", null, x.id + " • " + (c.cat[x.category] || x.category)), mk("div", "muted", (c.st[x.status] || x.status) + " • " + when(x.updatedAt)));
      it.addEventListener("click", () => openOne(box, x.id));
      box.appendChild(it);
    });
  }

  async function openOne(box, id) {
    const c = CT(); let x;
    try { x = (await api("/api/driver/complaints/" + encodeURIComponent(id))).complaint; } catch (_e) { return; }
    box.textContent = "";
    const close = mk("button", "offer-btn reject", c.back); close.type = "button"; close.addEventListener("click", loadComplaints);
    box.append(close, mk("div", "rt-title", x.id + " • " + (c.st[x.status] || x.status)), mk("div", "muted", (c.cat[x.category] || x.category) + " • #" + x.orderId), mk("p", null, x.text));
    if (x.status === "with_party" && x.respondBy) box.appendChild(mk("div", "muted", c.deadline + " " + when(x.respondBy)));
    (x.timeline || []).forEach((e) => {
      const r = mk("div", "rt-rev"); r.appendChild(mk("span", "muted", (c.who[e.role] || e.role) + " • " + when(e.at)));
      if (e.text && !["routed", "escalated", "auto_escalated"].includes(e.kind)) r.appendChild(mk("p", null, e.text));
      box.appendChild(r);
    });
    if (x.status === "with_party") {
      const ta = mk("textarea"); ta.rows = 4; ta.maxLength = 1000; ta.placeholder = c.hint; ta.style.cssText = "width:100%;box-sizing:border-box;margin-top:8px";
      const send = mk("button", "offer-btn accept", c.send); send.type = "button";
      const msg = mk("div", "muted"); msg.setAttribute("role", "alert");
      send.addEventListener("click", async () => {
        if (cpBusy) return; cpBusy = true; send.disabled = true; msg.textContent = "";
        try { await api("/api/driver/complaints/" + encodeURIComponent(id) + "/respond", { method: "POST", body: JSON.stringify({ text: ta.value }) }); await openOne(box, id); }
        catch (_e) { msg.textContent = c.err; } finally { cpBusy = false; send.disabled = false; }
      });
      box.append(ta, send, msg);
    }
  }

  const _lr = loadRatings;
  async function loadAll() { await _lr(); await loadComplaints(); }
  window.SiymonDriverExtras = { loadRatings: loadAll, loadComplaints };
})();
