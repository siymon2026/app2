"use strict";
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("zlib");
const R = require("../lib/reports");
const LB = require("../lib/report-labels");
const X = require("../lib/export-files");
const fin = require("../lib/finance");

const NOW = Date.parse("2026-10-27T12:00:00Z");
function sample(name = "Hope") {
  const o = { id: "=cmd", restaurantId: "s1", status: "delivered", createdAt: "2026-10-20T10:00:00Z", deliveredAt: "2026-10-20T11:00:00Z", subtotal: 100, deliveryFee: 10, total: 110, paymentMethod: "cod" };
  o.financials = fin.orderFinancials({ order: o, store: { commission: { type: "percent", value: 10 } }, driverEarning: 10 });
  fin.finalize(o);
  const D = { now: NOW, orders: [o], stores: [{ id: "s1", name: { en: name, ar: "مطعم" } }] };
  const p = R.parseParams({ from: "2026-10-01", to: "2026-10-27" }, { now: NOW }).params;
  const report = R.generate("order-financials", D, p, { scope: "admin", finance: true }).report;
  return { report, L: (l) => LB.labelsFor(report, l) };
}

/** Reads a ZIP back (central directory) so the test checks real structure, not just "some bytes". */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(end + 10);
  let off = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(off), 0x02014b50);
    const method = buf.readUInt16LE(off + 10), crc = buf.readUInt32LE(off + 16), csize = buf.readUInt32LE(off + 20), usize = buf.readUInt32LE(off + 24);
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32), lo = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nl);
    const lnl = buf.readUInt16LE(lo + 26), lel = buf.readUInt16LE(lo + 28);
    const raw = buf.subarray(lo + 30 + lnl + lel, lo + 30 + lnl + lel + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, usize);
    assert.equal(X.crc32(data), crc, `crc ${name}`);
    out[name] = data.toString("utf8");
    off += 46 + nl + el + cl;
  }
  return out;
}

test("crc32 matches the standard check value", () => assert.equal(X.crc32(Buffer.from("123456789")), 0xcbf43926));

test("xlsx: valid zip, required parts, numbers stay numeric, RTL only for Arabic", () => {
  const { report, L } = sample();
  const f = unzip(X.toXlsx(report, L("ar"), { rtl: true }));
  for (const k of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) assert.ok(f[k], k);
  assert.ok(f["xl/worksheets/sheet1.xml"].includes('rightToLeft="1"'));
  assert.ok(f["xl/worksheets/sheet1.xml"].includes("<v>110</v>")); // total billed is a number, not text
  const en = unzip(X.toXlsx(report, L("en"), { rtl: false }));
  assert.ok(!en["xl/worksheets/sheet1.xml"].includes("rightToLeft"));
  assert.ok(en["xl/worksheets/sheet1.xml"].includes("Total billed"));
});

test("xlsx: markup in data is escaped (no XML injection) and bad control chars removed", () => {
  const { report, L } = sample('A"><script>&\u0001x');
  const sheet = unzip(X.toXlsx(report, L("en")))["xl/worksheets/sheet1.xml"];
  assert.ok(!sheet.includes("<script>"));
  assert.ok(sheet.includes("&lt;script&gt;"));
  assert.ok(!sheet.includes("\u0001"));
});

test("csv: BOM, formula-injection neutralised, numbers untouched", () => {
  const { report, L } = sample("=HYPERLINK(1)");
  const csv = X.toCsv(report, L("en"));
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("'=cmd"));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes(",110,"));
  for (const s of ["=1", "+1", "-1", "@x", "\tx"]) assert.equal(X.neutralize(s), "'" + s);
  assert.equal(X.neutralize("abc"), "abc");
});

test("pdf: structurally valid, page count right, non-Latin text degraded not crashing", () => {
  const { report, L } = sample("مطعم الأمل");
  const buf = X.toPdf(report, L("en"));
  const s = buf.toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4") && s.trimEnd().endsWith("%%EOF"));
  const m = /startxref\n(\d+)\n/.exec(s);
  assert.equal(s.slice(Number(m[1]), Number(m[1]) + 4), "xref");
  assert.equal(X.pdfSafe("مطعم الأمل x"), "? ? x");
  assert.equal(X.pdfSafe("a−b≠c"), "a-b!=c");
  assert.equal(X.HELV.length, 95);
});

test("pdf: many rows paginate", () => {
  const { report, L } = sample();
  const t = report.tables[0];
  t.rows = Array.from({ length: 200 }, (_, i) => ({ ...t.rows[0], orderId: "o" + i }));
  const s = X.toPdf(report, L("en")).toString("latin1");
  const pages = (s.match(/\/Type \/Page /g) || []).length;
  assert.ok(pages >= 4, "pages=" + pages);
  assert.ok(/\/Count (\d+)/.exec(s)[1] == pages);
});

test("html: escapes everything, no script, RTL for Arabic", () => {
  const { report, L } = sample('<img src=x onerror=alert(1)>');
  const h = X.toHtml(report, L("ar"), { lang: "ar" });
  assert.ok(h.includes('dir="rtl"'));
  assert.ok(!h.includes("<img"));
  assert.ok(!/<script/i.test(h));
  assert.ok(X.toHtml(report, L("en"), { lang: "en" }).includes('dir="ltr"'));
});
