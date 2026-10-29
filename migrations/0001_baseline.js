"use strict";
/**
 * Baseline: puts the existing JSON data under versioned migrations.
 * It changes NO data (files: []), so no backup is needed. It records the starting point in data/_migrations.json
 * and reports (without failing) data files that are not valid JSON, so they can be looked at before the next change.
 */
const fs = require("fs");
const path = require("path");

module.exports = {
  id: "0001_baseline",
  description: "Adopt the existing data under versioned migrations (no data is changed).",
  files: [],
  async up() { /* nothing to change */ },
  async verify(ctx) {
    const warnings = [];
    let names = [];
    try { names = fs.readdirSync(ctx.dataDir).filter((n) => n.endsWith(".json") && n !== "_migrations.json"); } catch (_e) { /* no data directory yet */ }
    for (const n of names) {
      try { JSON.parse(fs.readFileSync(path.join(ctx.dataDir, n), "utf8")); } catch (_e) { warnings.push(`${n} is not valid JSON`); }
    }
    return { ok: true, warnings };
  },
};
