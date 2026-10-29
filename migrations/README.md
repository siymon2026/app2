# Data migrations

One file per change, named `NNNN_short_name.js` (four digits, lower-case). Applied in order, once, recorded in `data/_migrations.json`.

```js
module.exports = {
  id: "0002_example",                 // must equal the file name without .js
  description: "What and why",
  files: ["orders.json"],             // EVERY data file the migration reads or writes (relative to data/, *.json only)
  async up(ctx) {                     // runs on an in-memory copy; nothing is written until it returns
    const d = ctx.read("orders.json", { orders: [] });
    d.orders.forEach((o) => { if (o.note === undefined) o.note = ""; });
    ctx.write("orders.json", d);
  },
  async verify(ctx) {                 // optional: runs on the LIVE data after the commit
    const d = ctx.read("orders.json", { orders: [] });
    return { ok: d.orders.every((o) => typeof o.note === "string") };
  },
};
```

Rules enforced by the runner (`lib/data-migrations.js`):
* a verified backup is taken before any change; no backup => no migration;
* undeclared files cannot be touched; `audit/`, `private_uploads/` and the ledger are off limits;
* a migration must never reduce the number of orders, top-ups, settlements, wallet-ledger entries or audit records;
* never edit a migration that was already applied (the run stops: `MIGRATION_MODIFIED`) - add a new one instead;
* any failure restores the affected files from the backup (current versions are kept as `*.rolledback-<time>`).

Test first: `npm run migrate:data -- --dry-run`. Apply: `npm run migrate:data` (application stopped).
