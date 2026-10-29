"use strict";
/**
 * Report exports with NO third-party dependency (the deployment cannot be assumed to have exceljs / pdfkit):
 *   toCsv   UTF-8 with BOM (opens correctly in Excel, Arabic included), formula-injection safe.
 *   toXlsx  real .xlsx (OOXML in a ZIP), numbers stay numbers, header/totals styled, RTL sheet for Arabic.
 *   toPdf   real PDF 1.4, A4 landscape, Helvetica (standard font, nothing to embed). Text outside Latin-1 cannot be
 *           drawn with a standard font and is replaced by "?"; Arabic output therefore uses toHtml() + the browser's
 *           "Save as PDF" (full Arabic shaping / RTL), or the Excel file.
 *   toHtml  standalone printable page (all values escaped; no script).
 *
 * Every function takes (report, labels, opts) where `labels` is lib/report-labels.js labelsFor().
 */
const zlib = require("zlib");

const MAX_EXPORT_ROWS = 50000;

/* ------------------------------ value formatting ------------------------------ */

const tzFormatters = new Map();
function localDateTime(iso, tz) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso || "");
  let f = tzFormatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    }
    tzFormatters.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(new Date(t))) if (p.type !== "literal") o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}`;
}

const NUMERIC = new Set(["money", "int", "pct", "minutes", "number"]);
const isNum = (c) => NUMERIC.has(c.type);
const has = (v) => v !== null && v !== undefined && v !== "";

/** Display text for a value (csv / pdf / html / UI parity). */
function display(c, v, L, tz) {
  if (!has(v)) return "";
  switch (c.type) {
    case "money": return Number(v).toFixed(2);
    case "int": return String(Math.round(Number(v)));
    case "pct": return Number(v).toFixed(1) + "%";
    case "minutes": return Number(v).toFixed(1);
    case "number": return String(Math.round(Number(v) * 100) / 100);
    case "enum": {
      const m = L.enums && L.enums[c.enum];
      return m && Object.prototype.hasOwnProperty.call(m, String(v)) ? m[String(v)] : String(v);
    }
    case "datetime": return localDateTime(v, tz);
    default: return String(v);
  }
}

const colLabel = (c, L) => (L.columns && L.columns[c.key]) || c.key;
const tableLabel = (t, L) => (L.tables && L.tables[t.id]) || t.id;
const periodText = (r, L) => `${L.ui.period}: ${r.meta.fromKey} → ${r.meta.toKey}`;
const scopeText = (r, L) => `${L.ui.scope}: ${L.ui[r.meta.scope] || r.meta.scope}`;
const metaLine = (r, L) =>
  [periodText(r, L), scopeText(r, L), `${L.ui.timezone}: ${r.meta.tz}`, `${L.ui.currency}: ${r.meta.currency}`, `${L.ui.generated}: ${localDateTime(r.meta.generatedAt, r.meta.tz)}`].join("  |  ");

/* ------------------------------ CSV ------------------------------ */

/** OWASP CSV-injection guard: a text cell that a spreadsheet could read as a formula gets a leading apostrophe. */
function neutralize(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function csvCell(s) {
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(report, L, opts = {}) {
  const t = (opts.table && report.tables.find((x) => x.id === opts.table)) || report.tables[0];
  const tz = report.meta.tz;
  const lines = [t.columns.map((c) => csvCell(neutralize(colLabel(c, L)))).join(",")];
  const one = (c, v) => {
    if (isNum(c)) return has(v) ? String(Math.round(Number(v) * 100) / 100) : ""; // a real number: never prefixed
    return csvCell(neutralize(display(c, v, L, tz)));
  };
  for (const r of t.rows) lines.push(t.columns.map((c) => one(c, r[c.key])).join(","));
  if (t.totals) lines.push(t.columns.map((c, i) => (has(t.totals[c.key]) ? one(c, t.totals[c.key]) : i === 0 ? csvCell(L.ui.totals) : "")).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ------------------------------ XLSX (ZIP + OOXML) ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer (deflate). files: [{name, data: Buffer}] */
function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fixed timestamp: reproducible output
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    chunks.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

// eslint-disable-next-line no-control-regex
const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (s) =>
  String(s == null ? "" : s)
    .replace(XML_BAD, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// style ids (see STYLES below)
const S = { text: 0, head: 1, money: 2, int: 3, pct: 4, dec: 5, tText: 6, tMoney: 7, tInt: 8, tPct: 9, tDec: 10, title: 11, meta: 12, note: 13 };
const NUM_STYLE = { money: [S.money, S.tMoney], int: [S.int, S.tInt], pct: [S.pct, S.tPct], minutes: [S.dec, S.tDec], number: [S.dec, S.tDec] };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font>
</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF337418"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEAF6E3"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF337418"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="1" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="166" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetName(label, used) {
  let base = String(label || "Sheet").replace(/[\[\]:*?/\\]/g, " ").replace(XML_BAD, "").trim().slice(0, 31) || "Sheet";
  let name = base, i = 2;
  while (used.has(name.toLowerCase())) name = base.slice(0, 31 - String(i).length - 1) + "_" + i++;
  used.add(name.toLowerCase());
  return name;
}

function sheetXml(report, t, L, opts, withNotes) {
  const tz = report.meta.tz;
  const rows = [];
  const sc = (c, r, v, style) => (has(v) ? `<c r="${colName(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>` : "");
  const nc = (c, r, v, style) => (has(v) && Number.isFinite(Number(v)) ? `<c r="${colName(c)}${r}" s="${style}"><v>${Number(v)}</v></c>` : `<c r="${colName(c)}${r}" s="${style}"/>`);
  let r = 1;
  rows.push(`<row r="${r}">${sc(0, r, L.title + " — " + tableLabel(t, L), S.title)}</row>`); r++;
  rows.push(`<row r="${r}">${sc(0, r, metaLine(report, L), S.meta)}</row>`); r++;
  r++; // blank
  const headRow = r;
  rows.push(`<row r="${r}" ht="30" customHeight="1">${t.columns.map((c, i) => sc(i, r, colLabel(c, L), S.head)).join("")}</row>`); r++;
  const widths = t.columns.map((c) => colLabel(c, L).length + 2);
  for (const row of t.rows) {
    const cells = t.columns.map((c, i) => {
      const v = row[c.key];
      let txt;
      if (isNum(c)) { txt = has(v) ? String(Math.round(Number(v) * 100) / 100) : ""; return nc(i, r, v, NUM_STYLE[c.type][0]); }
      txt = display(c, v, L, tz);
      widths[i] = Math.max(widths[i], Math.min(60, txt.length + 2));
      return sc(i, r, txt, S.text);
    });
    t.columns.forEach((c, i) => { if (isNum(c)) widths[i] = Math.max(widths[i], 14); });
    rows.push(`<row r="${r}">${cells.join("")}</row>`); r++;
  }
  if (t.totals) {
    const cells = t.columns.map((c, i) => {
      if (isNum(c)) return nc(i, r, t.totals[c.key], NUM_STYLE[c.type][1]);
      return sc(i, r, i === 0 && !has(t.totals[c.key]) ? L.ui.totals : t.totals[c.key], S.tText) || `<c r="${colName(i)}${r}" s="${S.tText}"/>`;
    });
    rows.push(`<row r="${r}">${cells.join("")}</row>`); r++;
  }
  if (withNotes) {
    r++;
    for (const n of L.notes || []) { rows.push(`<row r="${r}">${sc(0, r, n, S.meta)}</row>`); r++; }
  }
  const lastCol = colName(Math.max(0, t.columns.length - 1));
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, w))}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${Math.max(r - 1, headRow)}"/>
<sheetViews><sheetView workbookViewId="0"${opts.rtl ? ' rightToLeft="1"' : ""}><pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>
<autoFilter ref="A${headRow}:${lastCol}${headRow + Math.max(t.rows.length, 0)}"/></worksheet>`;
}

function toXlsx(report, L, opts = {}) {
  const used = new Set();
  const tables = report.tables;
  const names = tables.map((t) => sheetName(tableLabel(t, L), used));
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
${tables.map((_t, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(L.title)}</dc:title><dc:creator>SIYMON</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xml(report.meta.generatedAt)}</dcterms:created></cp:coreProperties>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_t, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: STYLES },
    ...tables.map((t, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(report, t, L, opts, i === 0) })),
  ];
  return zip(files);
}

/* ------------------------------ PDF ------------------------------ */

// Helvetica advance widths (1/1000 em) for ASCII 32..126 (Adobe AFM)
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

const SUBST = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "→": "->", "←": "<-", "−": "-", "≠": "!=", "≤": "<=", "≥": ">=", " ": " " };
/** Text a standard (WinAnsi) font can show. A run of other characters becomes a single "?". */
function pdfSafe(s) {
  let out = "", lastBad = false;
  for (const ch of String(s == null ? "" : s)) {
    const sub = SUBST[ch];
    const c = (sub || ch).codePointAt(0);
    const ok = sub ? true : (c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff);
    if (ok) { out += sub || ch; lastBad = false; }
    else if (!lastBad) { out += "?"; lastBad = true; }
  }
  return out;
}
function textWidth(s, size, bold) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += c >= 32 && c <= 126 ? HELV[c - 32] : c >= 160 && c <= 255 ? 556 : 556;
  }
  return (w / 1000) * size * (bold ? 1.04 : 1);
}
function fit(s, maxW, size, bold) {
  if (textWidth(s, size, bold) <= maxW) return s;
  let t = s;
  while (t.length > 1 && textWidth(t + "..", size, bold) > maxW) t = t.slice(0, -1);
  return t + "..";
}
const pdfEsc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

function toPdf(report, L) {
  const W = 842, H = 595, MX = 36, TOP = 44, BOT = 40;
  let FS = 8, ROW = 14;
  const usable = W - 2 * MX;
  const tz = report.meta.tz;
  const pages = [];
  let ops = null, y = 0;
  const newPage = () => { ops = []; pages.push(ops); y = H - TOP; };
  const text = (x, yy, s, size, bold, align, width) => {
    const t = pdfSafe(s);
    const w = textWidth(t, size, bold);
    const px = align === "right" ? x + width - w : align === "center" ? x + (width - w) / 2 : x;
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${f2(px)} ${f2(yy)} Td (${pdfEsc(t)}) Tj ET`);
  };
  const rect = (x, yy, w, h, rgb) => ops.push(`${rgb} rg ${f2(x)} ${f2(yy)} ${f2(w)} ${f2(h)} re f 0 0 0 rg`);
  const hline = (x1, x2, yy) => ops.push(`0.2 0.45 0.09 RG 0.6 w ${f2(x1)} ${f2(yy)} m ${f2(x2)} ${f2(yy)} l S`);

  newPage();
  text(MX, y, L.title, 15, true);
  y -= 14;
  text(MX, y, metaLine(report, L), 7.5, false);
  y -= 8;

  for (const t of report.tables) {
    const cols = t.columns;
    FS = cols.length > 15 ? 6.5 : cols.length > 11 ? 7.2 : 8; // wide tables get a smaller font instead of cut-off cells
    ROW = Math.round(FS + 6);
    // natural widths from the header and up to 300 sampled rows
    const nat = cols.map((c) => {
      let w = textWidth(pdfSafe(colLabel(c, L)), FS, true);
      for (let i = 0; i < Math.min(300, t.rows.length); i++) w = Math.max(w, textWidth(pdfSafe(display(c, t.rows[i][c.key], L, tz)), FS, false));
      if (t.totals && has(t.totals[c.key])) w = Math.max(w, textWidth(pdfSafe(display(c, t.totals[c.key], L, tz)), FS, true));
      return Math.max(26, w + 7);
    });
    // water-filling: when the table is wider than the page, only text columns are cut down to a common cap;
    // numbers and dates always keep their natural width
    let cw = nat;
    if (nat.reduce((a, b) => a + b, 0) > usable) {
      const flex = cols.map((c) => !isNum(c) && c.type !== "datetime" && c.type !== "date");
      const fixed = nat.reduce((a, w, i) => a + (flex[i] ? 0 : w), 0);
      const budget = usable - fixed;
      if (budget >= 26 * flex.filter(Boolean).length) {
        let lo = 26, hi = Math.max(...nat);
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (nat.reduce((a, w, k) => a + (flex[k] ? Math.min(w, mid) : 0), 0) > budget) hi = mid; else lo = mid;
        }
        cw = nat.map((w, k) => (flex[k] ? Math.min(w, lo) : w));
      } else {
        const k = usable / nat.reduce((a, b) => a + b, 0);
        cw = nat.map((w) => w * k);
      }
    }
    const xs = []; { let x = MX; for (const w of cw) { xs.push(x); x += w; } }
    const drawHead = () => {
      rect(MX, y - 4, Math.min(usable, cw.reduce((a, b) => a + b, 0)), ROW, "0.2 0.45 0.09");
      ops.push("1 1 1 rg");
      cols.forEach((c, i) => text(xs[i] + 3, y, fit(pdfSafe(colLabel(c, L)), cw[i] - 6, FS, true), FS, true, isNum(c) ? "right" : "left", cw[i] - 6));
      ops.push("0 0 0 rg");
      y -= ROW;
    };
    if (y - 3 * ROW - 24 < BOT) { newPage(); }
    y -= 6;
    text(MX, y, pdfSafe(tableLabel(t, L)), 10.5, true);
    y -= 16;
    drawHead();
    if (!t.rows.length) { text(MX + 3, y, L.ui.noRows, FS, false); y -= ROW; }
    t.rows.forEach((row, ri) => {
      if (y - ROW < BOT) { newPage(); drawHead(); }
      if (ri % 2) rect(MX, y - 4, cw.reduce((a, b) => a + b, 0), ROW, "0.96 0.96 0.96");
      cols.forEach((c, i) => text(xs[i] + 3, y, fit(pdfSafe(display(c, row[c.key], L, tz)), cw[i] - 6, FS, false), FS, false, isNum(c) ? "right" : "left", cw[i] - 6));
      y -= ROW;
    });
    if (t.totals) {
      if (y - ROW < BOT) { newPage(); drawHead(); }
      hline(MX, MX + cw.reduce((a, b) => a + b, 0), y + ROW - 4);
      cols.forEach((c, i) => {
        const v = t.totals[c.key];
        const s = has(v) ? display(c, v, L, tz) : i === 0 ? L.ui.totals : "";
        text(xs[i] + 3, y, fit(pdfSafe(s), cw[i] - 6, FS, true), FS, true, isNum(c) ? "right" : "left", cw[i] - 6);
      });
      y -= ROW;
    }
    y -= 6;
  }
  // notes, wrapped
  const notes = [...(L.notes || []), L.ui.pdfLatin];
  for (const n of notes) {
    const words = pdfSafe(n).split(/\s+/);
    let line = "";
    const flush = () => { if (!line) return; if (y - 10 < BOT) newPage(); text(MX, y, line, 7.5, false); y -= 10; line = ""; };
    for (const w of words) {
      if (textWidth(line ? line + " " + w : w, 7.5, false) > usable) flush();
      line = line ? line + " " + w : w;
    }
    flush();
    y -= 3;
  }

  const total = pages.length;
  pages.forEach((p, i) => {
    ops = p;
    ops.push("0.4 0.4 0.4 rg");
    text(MX, 20, "SIYMON - " + pdfSafe(L.title), 7, false);
    text(MX, 20, `${L.ui.page} ${i + 1} ${L.ui.of} ${total}`, 7, false, "right", usable);
  });

  // objects: 1 catalog, 2 pages, 3 F1, 4 F2, then (page, content) pairs
  const objs = [];
  const add = (body) => objs.push(body) && objs.length;
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${pages.map((_p, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${total} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const streams = [];
  pages.forEach((p, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    const data = zlib.deflateSync(Buffer.from(p.join("\n"), "latin1"));
    streams.push(data);
    add({ stream: data });
  });
  const info = `<< /Title (${pdfEsc(pdfSafe(L.title))}) /Producer (SIYMON) >>`;
  const infoNo = add(info);
  const parts = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offs = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    offs.push(pos);
    let b;
    if (typeof o === "string") b = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1");
    else b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.stream.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), o.stream, Buffer.from("\nendstream\nendobj\n", "latin1")]);
    parts.push(b);
    pos += b.length;
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) xref += String(o).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoNo} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

/* ------------------------------ printable HTML ------------------------------ */

const hx = (s) =>
  String(s == null ? "" : s)
    .replace(XML_BAD, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function toHtml(report, L, opts = {}) {
  const lang = opts.lang === "fr" || opts.lang === "en" ? opts.lang : "ar";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const tz = report.meta.tz;
  const body = report.tables
    .map((t) => {
      const head = t.columns.map((c) => `<th>${hx(colLabel(c, L))}</th>`).join("");
      const rows = t.rows.map((r) => `<tr>${t.columns.map((c) => `<td${isNum(c) ? ' class="n"' : ""}>${hx(display(c, r[c.key], L, tz))}</td>`).join("")}</tr>`).join("");
      const tot = t.totals
        ? `<tr class="tot">${t.columns.map((c, i) => `<td${isNum(c) ? ' class="n"' : ""}>${hx(has(t.totals[c.key]) ? display(c, t.totals[c.key], L, tz) : i === 0 ? L.ui.totals : "")}</td>`).join("")}</tr>`
        : "";
      const empty = t.rows.length ? "" : `<tr><td colspan="${t.columns.length}" class="e">${hx(L.ui.noRows)}</td></tr>`;
      return `<h2>${hx(tableLabel(t, L))}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}${empty}${tot}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${hx(L.title)}</title>
<style>
:root{--g:#337418;--gl:#5DD62C;--k:#0F0F0F;--w:#F8F8F8}
*{box-sizing:border-box}body{font:12px/1.45 system-ui,"Segoe UI",Tahoma,Arial,sans-serif;color:var(--k);background:#fff;margin:16px}
header{border-bottom:3px solid var(--gl);padding-bottom:8px;margin-bottom:10px}h1{margin:0;font-size:20px;color:var(--g)}.meta{color:#555;font-size:11px;margin-top:4px}
h2{font-size:14px;margin:18px 0 6px;color:var(--g)}table{border-collapse:collapse;width:100%}th{background:var(--g);color:#fff;font-weight:700;padding:5px 6px;text-align:start;font-size:11px}
td{padding:4px 6px;border-bottom:1px solid #ddd}td.n{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}tr:nth-child(even) td{background:var(--w)}
tr.tot td{font-weight:700;border-top:2px solid var(--g);background:#EAF6E3}td.e{text-align:center;color:#777;padding:14px}.note{color:#555;font-size:11px;margin-top:12px}
@media print{@page{size:A4 landscape;margin:10mm}body{margin:0}tr{break-inside:avoid}thead{display:table-header-group}}
</style></head><body><header><h1>${hx(L.title)}</h1><div class="meta">${hx(metaLine(report, L))}</div></header>${body}${(L.notes || []).map((n) => `<p class="note">${hx(n)}</p>`).join("")}</body></html>`;
}

module.exports = { MAX_EXPORT_ROWS, toCsv, toXlsx, toPdf, toHtml, display, pdfSafe, textWidth, zip, crc32, neutralize, HELV };
