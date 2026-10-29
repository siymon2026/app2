#!/usr/bin/env node
"use strict";
// Versioned JSON data migrations (spec section 21). Stop the application first. See migrations/README.md.
//   node scripts/migrate-data.js status | --dry-run | (no argument = apply)
const path = require("path");
try { require("dotenv").config({ path: path.join(__dirname, "..", ".env") }); } catch (_e) { /* dotenv optional here */ }
const { createFromEnv } = require("../lib/data-protection");
const { createMigrationRunnerFromEnv } = require("../lib/data-migrations");
const { migrateMain } = require("../lib/data-cli");
const root = path.join(__dirname, "..");
const dp = createFromEnv({ rootDir: root, env: process.env });
migrateMain(process.argv.slice(2), { runner: createMigrationRunnerFromEnv({ dp, rootDir: root }) }).then((c) => process.exit(c), (e) => { console.error("FAILED:", e && e.message ? e.message : e); process.exit(1); });
