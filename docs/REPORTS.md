# Reports and Analytics (spec section 17)

All reports are computed from real records (orders, settlements, top-ups, exceptions, customers/drivers/stores). No mock data.

## Reports
| id | permission (admin) | store | driver | notes |
|---|---|---|---|---|
| sales | reports.read | yes | - | orders / sales / revenue per day, week (Mon) or month |
| order-financials | finance.read | yes | - | per order: delivery fee, commission, driver share, discounts, net business entitlement |
| commissions | finance.read | yes | - | platform commission and platform net |
| settlements | finance.read | yes | - | business settlements |
| payments | finance.read | - | - | cash, approved transfer top-ups, wallet movements, refunds |
| drivers | drivers.read | - | - | deliveries, earnings, performance |
| driver-earnings | finance.read | - | own only | earnings per delivery |
| exceptions | exceptions.read | yes | - | cancelled / rejected / delayed / failed with reasons |
| comparison | reports.read | - | - | restaurants, stores, drivers side by side |
| reconcile | finance.read | - | - | independent re-aggregation vs. order snapshots and wallet ledgers |

## Endpoints
- `GET /api/admin/reports` (index), `GET /api/admin/reports/:type`
- `GET /api/store/reports`, `GET /api/store/reports/:type` (store taken only from the authenticated membership, needs `reports.read`)
- `GET /api/driver/reports/earnings` (own deliveries only)

Query: `from,to,preset(today|yesterday|7d|30d|this_month|last_month),granularity,status,storeId,driverId,lang(ar|fr|en),format(json|csv|xlsx|pdf|html),table`.
Max range 366 days. Export cap 50,000 rows, JSON 2,000 rows. Limits per actor: 120 reads/min, 20 exports/min. Every export (and admin view of financial reports) is audit-logged.

## Definitions
- Delivered orders are dated by `deliveredAt||createdAt`; cancelled by `canceledAt||updatedAt||createdAt`.
- Money is summed in integer cents. Legacy orders without a `financials` snapshot fall back like `finance.statement()` (commission 0, net = subtotal).
- platformNet = commission + (deliveryFee - driverEarning) - platform-funded discount.
- "Electronic" = approved transfer top-ups; no online gateway is enabled.
- Time zone: env `REPORTS_TZ`, else `config.timezone`, else `Africa/Casablanca`.

## Visibility
Finance columns need `finance.read`. Platform columns (commission, margin) are never shown to stores or drivers. No customer PII in store/driver scope.

## Exports
CSV (UTF-8 BOM, formula-injection neutralised), XLSX (hand-built OOXML, RTL for Arabic), PDF (built-in Helvetica: non-Latin text becomes "?", so `lang=ar` PDF falls back to English labels and sets `X-Report-Lang`), printable HTML (RTL, used for Arabic print-to-PDF in the UI).

## Tests
`node --test tests/*.test.js` (370 pass), `python3 tests/browser-admin-reports.py`, `browser-admin-perms-refresh.py`, `browser-admin-exceptions.py` (all pass on the mock server). Not tested: store dashboard in a real browser, real production data, large-volume performance.
