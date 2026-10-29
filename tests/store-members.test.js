"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../lib/store-members");

test("create: needs contact, strong password, assignable role; owners can't be created", () => {
  assert.equal(m.validateCreate({ password: "12345678" }, []).code, "CONTACT_REQUIRED");
  assert.equal(m.validateCreate({ email: "a@b.co", password: "short" }, []).code, "WEAK_PASSWORD");
  assert.equal(m.validateCreate({ email: "a@b.co", password: "12345678", role: "owner" }, []).code, "INVALID_ROLE");
  assert.equal(m.validateCreate({ email: "bad", password: "12345678" }, []).code, "BAD_EMAIL");
  const ok = m.validateCreate({ email: "A@B.co", password: "12345678", role: "manager" }, []);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.email, "a@b.co");
  assert.equal(m.validateCreate({ phone: "+212 600-000-000", password: "12345678" }, []).value.phone, "212600000000");
});

test("create: duplicates and member cap", () => {
  const list = [{ email: "a@b.co", phone: "0600000001" }];
  assert.equal(m.validateCreate({ email: "a@b.co", password: "12345678" }, list).code, "EXISTS");
  assert.equal(m.validateCreate({ phone: "06 00 00 00 01", password: "12345678" }, list).code, "EXISTS");
  const many = Array.from({ length: m.MAX_MEMBERS }, (_, i) => ({ email: `u${i}@x.co` }));
  assert.equal(m.validateCreate({ email: "new@x.co", password: "12345678" }, many).code, "LIMIT");
});

test("update: owners, self and unknown users are protected", () => {
  const actor = { userId: "u1" };
  assert.equal(m.validateUpdate(actor, null, { isActive: false }).status, 404);
  assert.equal(m.validateUpdate(actor, { id: "u2", role: "owner" }, { isActive: false }).code, "OWNER_PROTECTED");
  assert.equal(m.validateUpdate(actor, { id: "u1", role: "manager" }, { isActive: false }).code, "SELF");
});

test("update: only role (manager/cashier), active flag and password; nothing else", () => {
  const actor = { userId: "u1" };
  const t = { id: "u3", role: "cashier" };
  assert.deepEqual(m.validateUpdate(actor, t, { role: "manager", isActive: false, restaurantId: "other", email: "x@y.co" }).patch, { role: "manager", isActive: false });
  assert.equal(m.validateUpdate(actor, t, { role: "owner" }).code, "INVALID_ROLE");
  assert.equal(m.validateUpdate(actor, t, { password: "abc" }).code, "WEAK_PASSWORD");
  assert.equal(m.validateUpdate(actor, t, {}).code, "NOTHING");
});
