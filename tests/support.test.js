"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const X = require("../lib/support");

test("channel values are validated per kind and links are built from the normalised value", () => {
  assert.equal(X.normalizeValue("phone", "+212 6 12-34 56 78"), "+212612345678");
  assert.equal(X.normalizeValue("phone", "0612345678"), "0612345678");
  assert.equal(X.normalizeValue("phone", "12ab"), null);
  assert.equal(X.normalizeValue("phone", "javascript:alert(1)"), null);
  assert.equal(X.normalizeValue("email", "Help@Siymon7.com"), "help@siymon7.com");
  assert.equal(X.normalizeValue("email", "a b@c.d"), null);
  assert.equal(X.normalizeValue("telegram", "https://t.me/siymon_help"), "@siymon_help");
  assert.equal(X.normalizeValue("telegram", "ab"), null);
  assert.equal(X.hrefFor("whatsapp", "+212612345678"), "https://wa.me/212612345678");
  assert.equal(X.hrefFor("phone", "+212612345678"), "tel:+212612345678");
  assert.equal(X.hrefFor("telegram", "@siymon_help"), "https://t.me/siymon_help");
  assert.equal(X.hrefFor("email", "a@b.co"), "mailto:a@b.co");
});

test("validateChannel: label, kind, audience, hours; hostile text stripped", () => {
  assert.equal(X.validateChannel({ kind: "fax", label: "x", value: "123" }).code, "INVALID_KIND");
  assert.equal(X.validateChannel({ kind: "phone", label: "", value: "0612345678" }).code, "LABEL_REQUIRED");
  assert.equal(X.validateChannel({ kind: "phone", label: "x", value: "abc" }).code, "INVALID_VALUE");
  assert.equal(X.validateChannel({ kind: "phone", label: "x", value: "0612345678", audience: ["nobody"] }).code, "AUDIENCE_REQUIRED");
  const ok = X.validateChannel({ kind: "whatsapp", label: { ar: "دعم <b>المتاجر</b>" }, value: "0612345678", hours: "9-18" });
  assert.ok(ok.ok); assert.deepEqual(ok.value.audience, ["stores"]); assert.equal(ok.value.label.ar, "دعم bالمتاجر/b".replace("/b", "/b")); // tags stripped, text kept
  assert.ok(!JSON.stringify(ok.value).includes("<"));
  assert.equal(ok.value.label.fr, ok.value.label.ar, "missing languages fall back to the given one");
});

test("upsert: duplicates refused, limit enforced, update keeps id, reorder works", () => {
  const v = (value) => X.validateChannel({ kind: "phone", label: "L", value }).value;
  let r = X.upsertChannel([], null, v("0612345678"), "c1"); assert.ok(r.ok); let list = r.list;
  assert.equal(X.upsertChannel(list, null, v("0612345678"), "c2").code, "DUPLICATE");
  r = X.upsertChannel(list, null, v("0698765432"), "c2"); list = r.list; assert.equal(list.length, 2);
  assert.equal(X.upsertChannel(list, "nope", v("0600000000"), "x").status, 404);
  r = X.upsertChannel(list, "c1", { ...v("0612345678"), enabled: false }, "x"); assert.equal(r.channel.id, "c1"); assert.equal(r.channel.enabled, false);
  const re = X.reorder(r.list, ["c2", "c1"]); assert.equal(re.find((c) => c.id === "c2").sortOrder, 1);
  let big = []; for (let i = 0; i < X.LIMITS.channels; i++) big = X.upsertChannel(big, null, v("06" + String(10000000 + i)), "i" + i).list;
  assert.equal(X.upsertChannel(big, null, v("0699999999"), "z").code, "TOO_MANY");
});

test("publicChannels: only enabled + addressed to stores, ordered, with link; no internal fields", () => {
  const list = [
    { id: "a", kind: "phone", label: { ar: "A" }, value: "0611111111", audience: ["stores"], enabled: true, sortOrder: 2, createdAt: "x" },
    { id: "b", kind: "whatsapp", label: { ar: "B" }, value: "0622222222", audience: ["stores", "drivers"], enabled: true, sortOrder: 1 },
    { id: "c", kind: "email", label: { ar: "C" }, value: "c@d.co", audience: ["stores"], enabled: false, sortOrder: 0 },
    { id: "d", kind: "phone", label: { ar: "D" }, value: "0633333333", audience: ["drivers"], enabled: true, sortOrder: 0 },
  ];
  const p = X.publicChannels(list, "stores");
  assert.deepEqual(p.map((c) => c.id), ["b", "a"]);
  assert.equal(p[0].href, "https://wa.me/0622222222");
  assert.ok(!("createdAt" in p[1]) && !("audience" in p[1]) && !("enabled" in p[1]));
});

test("tickets: validation, create, reply flow, unread counters, closed rules", () => {
  assert.equal(X.validateTicket({ subject: "ab", text: "x" }).code, "SUBJECT_REQUIRED");
  assert.equal(X.validateTicket({ subject: "Problem", text: "  " }).code, "TEXT_REQUIRED");
  const v = X.validateTicket({ subject: "Payment missing", text: "Hello", category: "payments", clientId: "cid-12345" }).value;
  assert.equal(v.category, "payments");
  assert.equal(X.validateTicket({ subject: "Payment missing", text: "x", category: "bogus" }).value.category, "other");
  assert.match(X.newTicketId(), /^TK-[A-Z0-9]{8}$/);
  const t = X.createTicket({ id: "TK-AAAAAAAA", storeId: "s1", by: { userId: "u1", role: "owner", name: "Boss" }, value: v, msgId: "m1" });
  assert.equal(t.status, "open"); assert.equal(t.unreadAdmin, 1); assert.equal(t.unreadStore, 0);
  let r = X.addMessage(t, { side: "admin", text: "On it", id: "m2", by: "Admin" });
  assert.ok(r.ok); assert.equal(t.status, "answered"); assert.equal(t.unreadStore, 1);
  r = X.addMessage(t, { side: "store", text: "Thanks", id: "m3", clientId: "cid-99999" });
  assert.equal(t.status, "open", "a store reply re-opens an answered ticket"); assert.equal(t.unreadAdmin, 2);
  const again = X.addMessage(t, { side: "store", text: "Thanks", id: "m4", clientId: "cid-99999" });
  assert.equal(again.duplicate, true); assert.equal(t.messages.length, 3, "same clientId never posts twice");
  assert.equal(X.setStatus(t, "open", { side: "store" }).status, 403, "store can only close");
  assert.ok(X.setStatus(t, "closed", { side: "store" }).ok);
  assert.equal(X.addMessage(t, { side: "store", text: "more", id: "m5" }).code, "TICKET_CLOSED");
  assert.ok(X.addMessage(t, { side: "admin", text: "reopen note", id: "m6" }).ok);
  assert.equal(t.status, "closed", "admin note on a closed ticket does not silently reopen it");
  assert.ok(X.setStatus(t, "open", { side: "admin" }).ok);
});

test("messagesAfter is incremental and resets on an unknown id; markRead; summary hides nothing sensitive to the store", () => {
  const t = X.createTicket({ id: "TK-AAAAAAAA", storeId: "s1", by: {}, value: { subject: "Subject", text: "one", category: "other", clientId: null }, msgId: "m1" });
  X.addMessage(t, { side: "admin", text: "two", id: "m2" });
  assert.equal(X.messagesAfter(t, "m1").messages.length, 1);
  assert.equal(X.messagesAfter(t, "zzz").reset, true);
  X.markRead(t, "store"); assert.equal(t.unreadStore, 0);
  const sSide = X.summary(t, "store"); assert.ok(!("storeId" in sSide));
  const aSide = X.summary(t, "admin", { name: { ar: "متجر" } }); assert.equal(aSide.storeId, "s1");
});
