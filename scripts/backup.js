#!/usr/bin/env node
"use strict";
// Backup / verify / restore (spec section 21). See docs/DATA-PROTECTION.md. Usage: node scripts/backup.js
const path = require("path");
try { require("dotenv").config({ path: path.join(__dirname, "..", ".env") }); } catch (_e) { /* dotenv optional here */ }
const { createFromEnv } = require("../lib/data-protection");
const { backupMain } = require("../lib/data-cli");
const dp = createFromEnv({ rootDir: path.join(__dirname, ".."), env: process.env });
backupMain(process.argv.slice(2), { dp }).then((c) => process.exit(c), (e) => { console.error("FAILED:", e && e.message ? e.message : e); process.exit(1); });
