# SIYMON audit & implementation status (this pass)

Method: static inspection + `node --test`. The real server was NOT run: `npm install`
cannot reach the registry from the sandbox, so no HTTP-level test was possible.

## Verified facts about the codebase
- Stack: Node 22 / Express 4 monolith (`server.js`, ~7.5k lines) + `lib/*` modules; vanilla JS PWAs in `public/` (admin, driver, store, restaurant, orders, chat).
- Storage: **JSON files in `data/`** (orders, drivers, customers, restaurants, topups...). `prisma/schema.prisma` exists but is not used by the server (its own header says so) and lacks stores, dispatch, wallet ledger, offers.
- Auth: email/phone + password (bcrypt, JWT, refresh tokens, csurf, rate limits). **No SMS/OTP code anywhere** (grep for sms/otp/twilio = none).
- Payments: **COD only** (`lib/payments.js`); online methods are listed but rejected. No provider, no webhook, no refunds.
- Wallet: driver wallet balance + `walletHistory` array on the driver record (not a ledger with unique refs/reconciliation). Customer wallet absent.
- Dispatch: H3 (`lib/hexgrid.js`, `h3-js`) ring search, offers with TTL, single-winner accept, stale-location rule (30 s). Documented as requiring single process (`instances: 1`) because atomicity relies on synchronous in-process handling. Mode default is `pull`, not `offers`.
- Maps: Leaflet/OSM tiles; routing service exists (`lib/route-service.js`) but ETA/road distance is documented as not enabled by default -> fees/ETA are straight-line unless configured.
- **No pickup code / delivery code** verification exists.
- Order status was enforced only per-endpoint; the driver endpoint accepted any status from a fixed list.

## Fixed in this pass (tested)
1. **Driver order state machine** (`lib/order-state.js`, wired into `PATCH /api/driver/orders/:id`):
   no skipping (accepted->delivered), no rewinding/reopening closed orders (delivered/done/canceled),
   idempotent repeat of the same status (no duplicate completion), 409 with code on violation.
2. **Order event history**: each driver transition appends `{at, from, to, actorType, actorId}` to `order.events` (bounded to 200).
3. Test suite: 6 new tests; `catalog.test.js` hours tests no longer hard-code a UTC+1 offset
   (the sandbox tz database 2026e reports Casablanca as +00 on 2026-10-19; production code uses `Intl` and was not changed).
   Result: **95/95 passing** (baseline was 87/89).

## Added in step 2 of this pass: pickup + delivery verification codes
- `lib/verify-codes.js` + 10 tests. Codes: 6 digits, HMAC-derived from `VERIFY_CODE_SECRET` (falls back to `JWT_SECRET`; **set one of them permanently in production**) + per-order salt + order id + stage. No code is stored or logged.
- Created with every new order (`order.verify`). **Orders created before deployment are not gated** (legacy), so in-flight orders keep working.
- `PATCH /api/driver/orders/:id`: `picked_up` needs the pickup code, `delivered` needs the delivery code (`body.code`). 5 wrong attempts -> 10 min lock (423); expiry 24h (410); missing/malformed (400); wrong (403, attemptsLeft). Attempt counters are persisted on failure.
- Visibility: the store/restaurant sees the pickup code (until collected); the customer sees the delivery code (while active); the driver endpoints strip `verify` and only get `verifyRequired`.
- Supervisor exception: `POST /api/admin/orders/:id/verify-exception` {stage, reason>=3 chars}; recorded on the order and in the audit log; also refreshes expiry.
- UI: driver code prompt (ar/en/fr), customer order card, restaurant panel, store dashboard. `public/sw.js` -> v49.
- Not covered by automated HTTP tests (no express in the sandbox); logic is covered at module level. Test on staging with a real order before release.
- Known gap: the admin UI has no button yet for the exception endpoint (API only).

## Added in step 3: state machine on every role + cancellation rules
- Admin `PATCH /api/orders/:id`: transition table (`ADMIN_TRANSITIONS`); no skipping or reopening closed orders (409). Admin can no longer force `picked_up`/`delivered` while a code is still required: the response is 409 `VERIFICATION_REQUIRED`; use the audited exception instead. `restaurant_ready` remains store-only. The legacy `sent` order status (never used for orders) is no longer accepted.
- Customer cancel: allowed only while status is `new`, or `admin_accepted` before the store accepted (spec: no cancel after acceptance). Otherwise 409 `CANCEL_NOT_ALLOWED`. The customer app disables the button accordingly.
- Bug fixed: a customer cancellation did not return reserved stock (store rejection did). `catalogLib.restoreStock` now restores it.
- Store accept/ready/reject already validated transitions; they now also write `order.events`.
- Admin UI: "Verification exception" button in the order details (asks stage + mandatory reason). `public/sw.js` -> v50.
- Tests: 108 passing.
- Known pre-existing issue (not changed): admin.js `sendToDrivers()` sends `restaurant_ready`, which the server has always rejected (store-only). Admin-forced `delivered` does not apply the driver wallet charge (only the driver path does).

## Added in step 4: auditable driver-wallet ledger
- `lib/wallet-ledger.js` (+7 tests) works on the existing `walletBalance`/`walletHistory` fields (no migration). Every entry has a unique `ref`, `balanceAfter`, actor and note; entries are never edited or deleted; amounts are rounded to 2 decimals.
- Idempotent: delivery charge `order:<id>:charge`, topup credit `topup:<id>`, admin adjustment `adj:<random>`. Fixes a real double-credit risk: topup approval wrote the wallet before marking the topup decided, so a crash in between allowed a second approval to credit again.
- New: `POST /api/admin/drivers/:id/wallet-adjust` {amount, reason>=3} (never negative, audited as `wallet.adjust`); `GET /api/admin/drivers/:id/wallet-reconcile` (balance vs ledger sum; legacy entries without `ref` are counted).
- Delivery charge still may take the balance below zero on purpose (balance is checked when the driver accepts); everything else refuses negative.
- Limits: still JSON storage + single process, so there is no cross-process atomicity; a PostgreSQL migration should make `ref` a UNIQUE column inside a transaction. The admin UI has no wallet-adjust form yet (API only). Existing drivers whose balance does not equal their history will show a non-zero `diff` in reconcile; nothing is auto-corrected.
- Not built: customer wallet, online top-ups, refunds (need a payment provider).

## Added in step 5: road-distance delivery pricing
- `lib/delivery-pricing.js` (+10 tests). Settings in `data/config.json`: `deliveryPricingMode` (`flat` default = legacy per-store fee | `distance`), `deliveryPricePerKm` (0-50), `deliveryBaseFee` (default **0**), `deliveryMaxKm` (1-60, default 15). Out-of-range admin values are rejected (400), not clamped; changes are audited (`config.delivery_pricing`).
- Fee = base + road km x price/km, distance from the existing routing service (OSRM, or ORS with `ORS_API_KEY`). The store's free-delivery threshold still applies.
- **No fake distance:** missing store coordinates -> 422 `STORE_LOCATION_MISSING`; missing/invalid customer pin -> 422 `ADDRESS_LOCATION_REQUIRED`; provider failure/timeout -> 503 `ROUTING_UNAVAILABLE`; farther than limit -> 422 `OUT_OF_RANGE`. The order is NOT created in those cases.
- `POST /api/delivery/quote` (rate limited) gives the estimate shown in the cart; `POST /api/orders` recomputes it server-side (client fee is never trusted) and snapshots `order.deliveryPricing` {mode, pricePerKm, baseFee, distanceM, km, provider, fee, computedAt}.
- Customer app shows "calculating / pick location / error" states and blocks placing the order until a valid estimate exists. Admin settings form added. `public/sw.js` -> v51.
- **Default stays `flat`**, so existing stores' prices do not change until a supervisor switches the mode. Every store needs `lat/lng` before `distance` mode is enabled.
- The public OSRM demo server (`router.project-osrm.org`) is rate-limited and not for production use: set `ROUTING_URL` to your own OSRM or an `ORS_API_KEY`. Not tested against a live provider (sandbox has no access).
- Not done here: driver earnings (base + per-km snapshot) are still `deliveryFee`; requiring a pin for every order in flat mode.

## Added in step 6: driver earnings (base + road distance), snapshotted
- `lib/driver-earnings.js` (+7 tests). Config: `driverEarningsMode` (`delivery_fee` = legacy default | `formula`), `driverEarningBase` (0-200), `driverEarningPerKm` (0-50); strict validation (400 on out-of-range), audited as `config.driver_earnings`.
- `formula` = base + road km x perKm. Rates and result are stored on the order at creation (`order.driverEarnings`), so later changes never rewrite history. Road km comes only from the order's road-distance snapshot; if absent (flat delivery pricing) the driver gets the base only and the snapshot says `distanceMissing: true` (no invented distance). **To get a distance-based earning, also enable road-distance delivery pricing.**
- Legacy mode stores nothing and reads `deliveryFee` live, exactly as before.
- The driver app (cards, offers, history, today/week/month stats) now shows `driverEarning`; the receipt still shows the customer's delivery fee. Admin settings form added. `public/sw.js` -> v52.
- Not done: the driver wallet is not credited with earnings (they are settled outside the app, as before); per-store commission and the settlement entries are the next financial item.

## Added in step 7: commissions, financial snapshot, manual settlements
- `lib/finance.js` (+9 tests). Per-store commission `store.commission` = `{type: none|percent|fixed, value}` (percent 0-50, fixed 0-1000; strict validation), charged on the GOODS subtotal only, capped at the subtotal. Default: none.
- Every new order stores `order.financials`: commission setting applied + amounts (commissionAmount, businessNet, driverEarning, platformDeliveryMargin which may be negative). Pre-delivery receipt edits (admin / restaurant) recompute the amounts with the SNAPSHOTTED setting; the record becomes `final` on delivery or `void` on cancellation (customer, store reject, supervisor, driver) and is never reopened. Orders created before this change have no snapshot and are reported as `legacyOrdersWithoutSnapshot` (commission treated as 0).
- API (all behind `requireAdmin` + `requireFinance`, role in {admin, super_admin, accountant}; audited): `PUT/GET /api/admin/stores/:id/commission`; `GET/POST /api/admin/settlements`, `POST /api/admin/settlements/:id/void` (append-only: unique reference per store, reason required to void, nothing deleted); `GET /api/admin/stores/:id/statement?from&to`. Stores read only their own statement via `GET /api/store/statement` (owner, `reports.read`; store id comes from the token).
- The public store list is a whitelist, so commission is not exposed to customers; owners cannot edit their own commission (profile edits are field-whitelisted).
- Admin UI: "Finance & commission" section in the store profile (commission, statement, new settlement, void with reason). `public/sw.js` -> v53.
- LIMITS: only one admin role exists today (`admin`), so there is no real accountant/supervisor separation yet: anyone with an admin token can edit finance. Adding roles needs an admin-user model change. The store dashboard has no statement screen yet (API only). Cash flow model (who physically holds the cash) is not modelled beyond `paymentMethod`; the existing driver-wallet deduction logic is unchanged. Settlement balance = sum(businessNet of delivered orders) - net settlements.

## Added in step 8: back-office roles (least privilege)
- `lib/admin-roles.js` (+11 tests). Roles: `system_admin` (full), `order_supervisor`, `driver_supervisor`, `accountant`, `support`. Enforced centrally inside `requireAdmin` for EVERY back-office route: the role is re-read from `data/admins.json` on each request (so demotion/disable is immediate) and checked against a method+path rule table. **Deny-by-default**: any route not listed is system_admin only (staff management, config writes, plans, audit logs, store create/edit/delete, store impersonation, notifications, catalog/menu, signup...).
- Backward compatible: existing admin accounts have no role and are treated as `system_admin`. A valid token whose admin record no longer exists (or is `disabled`) is now rejected with 401 (the password-only "legacy" bootstrap token still works while no admins exist).
- Privilege-escalation fixes: `POST /api/admin/signup` used to let ANY admin token create a new full admin; it now requires system_admin and records `role: system_admin`. Staff API (`GET/POST /api/admin/staff`, `PATCH /api/admin/staff/:id`, system_admin only): you cannot change your own role or disabled flag, and the last active system_admin cannot be demoted/disabled; all changes audited (`staff.create`, `staff.update`); passwords 8-128 chars, bcrypt via the existing hasher. Disabled staff cannot log in. Denied attempts are audited as `admin.denied`.
- Access split: accountant = finance + top-up review + wallet adjustments (no driver documents, dispatch, or order edits); driver_supervisor = driver review + private documents + dispatch; order_supervisor = orders + verification exceptions + dispatch (no documents/finance); support = read orders/customers + customer chat only. `GET /api/config` is open to any staff but bank details are blanked unless the role has `finance.read`. `GET /api/admin/me` now returns `role` and `permissions`.
- UI: a "Staff" entry in the sidebar (system_admin only) to create staff, change roles, disable/enable. `public/sw.js` -> v54.
- LIMITS: the admin UI still shows every section to every role (restricted roles get "Forbidden" toasts on sections they cannot use); hiding tabs per permission is a UI follow-up. Granular sub-permissions inside a role (e.g. refund approval) do not exist because refunds/online payments are not built. Sessions already issued keep working until they expire, but the role they act with is always the current one.

## NOT done (needs your decisions/credentials; do not treat as working)
Priority order I recommend:
1. (done, see above) pickup/delivery codes. Remaining: admin UI button for exceptions.
2. Same state-machine treatment for admin / restaurant / customer-cancel endpoints; central table for all roles.
3. Migrate JSON storage to PostgreSQL (transactions, unique constraints, row-level business isolation). Large; needs a backup + dry-run plan.
4. SMS auth: requires an SMS provider account (Twilio/Infobip/local Moroccan gateway) — credentials unavailable.
5. Online payments + webhook verification + refunds + customer wallet ledger: requires a provider (e.g. CMI/Payzone/Stripe) and keys.
6. Road-distance delivery pricing via routing provider (OSRM/ORS) with explicit failure path.
7. Driver/business onboarding documents with private storage + audit; granular supervisor roles; promotions/loyalty/referrals; notification retry.
8. Spec sections 13+ were cut off in the uploaded file (ends at "Retry transie") — please resend the rest.

## Added in step 9 — driver review workflow
- lib/driver-review.js: statuses pending/approved/rejected/suspended; reviewer, time and mandatory reason recorded (history kept); warnings for missing licence/vehicle data.
- Suspension: stops dispatch offers, returns un-picked orders to dispatch, lets a driver finish an in-hand delivery only (on_the_way/delivered/done).
- Identity-document views are audited (`driver.document.view`); licence image supported.
- Admin UI: suspended tab, suspend button, reason prompt (required for reject/suspend), licence/vehicle display, release/in-delivery report.
- Not verified over HTTP/browser (sandbox cannot run the server); unit-tested only.

## Added in step 10 — store review workflow
- lib/store-review.js (+tests): pending/approved/rejected/suspended; reviewer, time, reason (mandatory for reject/suspend) and history in store.review/reviewHistory.
- New stores created by an admin start `pending` (unpublished, no orders, no store login) until approved. Approval requires name, phone and address. Stores created before this change have no `review` field and count as approved.
- PUT /api/admin/restaurants/:id can no longer publish a non-approved store; only PATCH /api/admin/stores/:id/review (system_admin only) decides.
- Suspending/rejecting: unpublishes (previous status restored on re-approval); orders the store never touched are cancelled (stock restored, finance finalized, customer notified); orders the store already started are NOT cancelled — flagged `supervisorAlert` and listed in the response/audit for a supervisor.
- Gaps: no store self-signup or document upload yet (stores are admin-created); store users can't finish in-progress orders while suspended (login blocked) — supervisor must handle via admin order tools; no automated UI/HTTP test.

## Added in step 11 — push retry
- lib/push-retry.js (+tests): failures classified gone (404/410: subscription removed) / permanent (other 4xx: no retry) / retry (408, 429, 5xx, network errors).
- Transient failures of the per-customer order push are queued in data/push_retry.json (idempotent per notification+endpoint, max 4 retries at 1m/5m/30m/2h, dropped after 6h, queue capped at 1000). A 30s background tick (only when Web Push is configured) retries; unsubscribed devices are dropped.
- Not covered: the admin broadcast push path is unchanged (no retry); the in-app notification record is always saved first so nothing is lost if push fails. The retry worker was not exercised against a real push service (no VAPID keys/network in sandbox) — only the pure policy is unit-tested.

## Added in step 12 — driver signup form: vehicle + licence
- public/driver: vehicle type/plate/model fields and optional driving-licence upload (resized client-side like the other documents); sent as vehicleType/vehiclePlate/vehicleModel/licenseImage, validated by the existing server code. Fields are optional: the admin sees a warning if they are missing at approval time.
- Not tested in a real browser (UI wiring only checked by syntax and existing unit tests).

## Added in step 13 — store dashboard statement
- public/store/store.js: «كشف الحساب / Relevé de compte» panel inside the reports view (needs reports.read): period totals (delivered orders, goods, platform commission, net) with date range, all-time net / settled / balance owed to the store, and a note for legacy orders without a financial snapshot. Data comes only from GET /api/store/statement (store id from the token).
- Not checked in a real browser; only syntax-checked. No English strings (the store app ships ar/fr only).

## Added in step 14 — admin UI hides what the role cannot use
- public/admin/admin-perms.js (+tests/admin-perms.test.js): reads /api/admin/me permissions and hides sidebar entries and action buttons (driver approve/reject/suspend/view documents, store review/edit/archive/delete/publish, commission save/void settlement) the role lacks. Test checks every permission named by the UI exists in lib/admin-roles.js.
- COSMETIC ONLY: the server still authorises every request (deny-by-default). Not checked in a real browser; some buttons not covered (order actions, wallet adjust) because their markup has no stable selector.
- Decision recorded (owner): driver earnings are NOT credited to the wallet. Today the driver keeps the delivery fee in cash and only the goods amount is deducted; crediting earnings would double count.

## Added in step 15 — location / personal-data privacy review
Findings from reading the code:
- OK already: only the latest driver fix is stored (no trail); GPS pings are excluded from the audit log; offers (offers mode) hide customer data before acceptance; a customer sees the driver's position only for their own order and only while it is on_the_way (stale fixes ignored).
- FIXED: in pull mode the driver's "available orders" list sent every approved driver the customer's name, phone, address, notes and coordinates before anyone accepted. Now withheld (lib/driver-privacy.js); only the road distance is shown, full details appear after acceptance.
- FIXED: drivers kept seeing customer phone/address/notes/coordinates of old deliveries indefinitely; hidden 24h after delivery (name and amounts kept).
- FIXED: the last known driver position could stay in data/dispatch.json forever; erased after 1 hour without update (tick, every 5s).
- NOT changed / open: live tracking returns the driver position rounded to ~1 m (needed for the map); the store and admin still see the customer's phone/address (needed to operate); orders and chat keep customer data indefinitely (no retention policy decided); the customer's own coordinates are stored with the order. A retention/anonymisation policy for old orders is a business/legal decision (Moroccan law 09-08 / CNDP) and is left to the owner.
- Not exercised over HTTP or in a browser.

## Added in step 16 — store owner manages own staff
- lib/store-members.js (+tests) and /api/store/members (GET, POST, PATCH/:id) with new permission `members.write` (owner only; `members.read` also owner only). Owner can add managers/cashiers, disable/enable them, change manager<->cashier and reset a password (min 8 chars). Cannot create/modify owners, cannot modify themself, max 20 members, targets are looked up inside the owner's own store only (another store's user id returns 404). Every change is written to the audit log (never the password).
- New store dashboard section «فريق العمل / Équipe» (section key `members`). Store types that an admin saved with an explicit sections list must add `members` to show it; built-in types include it automatically.
- Employees of the same person in two stores log in as before. Not tested in a real browser or over HTTP (route-level tests use the in-memory harness).
- Gap: no forced password change on first login and no email/SMS invitation flow (needs a provider).

## Added in step 17 — discount codes
- lib/promo.js (+tests/promo.test.js): percent/fixed codes, max discount, min basket, start/end, global and per-customer limits, optional store list. Usage is COUNTED FROM ORDERS (cancelled orders give the use back) — no second counter.
- Server: POST /api/promo/preview (rate-limited 20/min/IP; customer must be signed in), POST /api/orders accepts `promoCode` and recomputes everything server-side (client never sends an amount); order.promo snapshot; admin CRUD at /api/admin/promos (system_admin only: route is unlisted => deny-by-default), audited.
- Money rules (decided by me, please confirm): discount applies to goods only, never delivery; it is PLATFORM-FUNDED — store commission base and store net are unchanged; the driver's wallet charge (and the wallet gate in both accept paths) is reduced by the same amount, because the driver only collects what the customer pays; receipts edited later keep the snapshot amount clamped to the new subtotal (lib/promo.discountOf/totalOf/goodsDue). financials.promoDiscount records the platform cost.
- UI: code field + discount row in the customer cart; admin side-menu «أكواد الخصم» for system_admin; ESC/POS receipt shows a Discount line.
- Gaps: stores do not see the discount on their ticket; no first-order-only / category-specific rules; no per-code reporting beyond usage count; guests cannot use codes (login required for per-customer limits); not tested over HTTP/in a browser.

## Added in step 18 — discount-code extras
- Rules: `firstOrderOnly` (customer has no earlier non-cancelled order) and `categories` (the discount is computed only on goods of those menu categories; minimum basket still checks the whole basket).
- Reports: per-code uses and platform cost (sum of granted discounts of non-cancelled orders) in the admin list.
- Store view: orders now carry an explicit `discount` and `promoCode` (internal promo snapshot removed) so the store ticket/screen shows the discount line and totals add up; the store's net is unchanged (platform-funded).
- Server was restarted by the owner with step 22 online (pm2 `siymon-server` online); not yet exercised end-to-end by me.

## Added in step 25 — payment methods, bank-transfer configuration, wallet top-ups
**Implemented (code + unit tests; never run over HTTP or in a browser):**
- lib/payment-methods.js: 9 separate records (stripe, cod, tpe, cih, credit_agricole, cashplus, wafacash, attijariwafa, barid) with contexts checkout / customerTopup / driverTopup, per-audience account details, min/max, receipt/verification flags, QR, status message, order, versioning. No RIB/IBAN is invented: a transfer method cannot be enabled until holder + an account identifier are entered. Stripe is permanently "غير متوفر حاليا" (no Stripe code exists). COD/TPE are checkout-only. Bank transfers are NOT available for order payment (no pending-payment order workflow) — only for wallet top-ups.
- Supervisor panel «Payment Methods & Bank Accounts» (public/admin/admin-payments.js), permission `payments.manage` (system_admin only, explicit), optimistic versioning (409), audit log with account numbers masked.
- Customer wallet (/wallet/, GET /api/customer/wallet, POST /api/customer/wallet/topups) and driver wallet top-up (method, instructions, reference, receipt). A request is only a claim: pending → approved/rejected/failed; credit happens ONLY in PATCH /api/admin/topups/:id (synchronous, ledger ref `topup:<id>`, 409 on repeat, reason mandatory for reject/fail). Reference reuse blocked (any wallet), max 3 pending per owner, receipt magic-byte checked.
- SECURITY FIX: payment receipts were publicly downloadable under /uploads/topups; new receipts go to a private dir, the public path now returns 404, receipts are served only to the owner (own session) or an admin with `topups.review` (admin views are audited).
- Checkout: customer may pay the GOODS part from the wallet (order.payment snapshot; ledger ref `order:<id>:wallet`); delivery fee stays payable on delivery so driver earnings/settlement are unchanged (driver goods charge = subtotal − discount − wallet part). Wallet part is refunded on cancel (ref `order:<id>:wallet_refund`, idempotent). Customer notifications: top-up pending/confirmed/rejected, refund.
**Not implemented / limits:** paying a whole order incl. delivery from the wallet; bank transfer as an ORDER payment; any real bank/Cash Plus/Wafacash/Stripe API (none used — all manual verification); driver notifications on top-up review (no driver notification system); payment status screen in the customer order-details page (data is in order.payment); CSV reconciliation import.
**Database:** JSON files, additive only — new data/payment-methods.json (seeded on first read, existing data untouched), topup records gain walletType/methodId/reference/refKey/…, customers gain walletBalance/walletHistory on first ledger write, orders gain `payment`. No migration/reseed. Rollback: stop server, restore the pre-deploy copy of data/ (take `cp -a data data.bak-step25` BEFORE deploying), put back previous code; extra fields are ignored by old code. Receipts stored in data/private_uploads/topups.
**Owner must supply:** the real RIB/IBAN/holder for each bank/service (entered in the panel), an actual Stripe account + integration if wanted, a decision on who may hold `payments.manage`.

---

## Section 15 — Customer accounts and features (this pass; sections 1–14 untouched)

Verified before changing: orders were attached to an account by **phone number match** (`GET /api/customer/orders`,
`/cancel`, `/rate`) while signup never verifies the phone (no SMS code exists) → anyone could register with a victim's
number and read/cancel/rate their orders. Account deletion hard-deleted the record. No profile edit, favorites,
reorder, order receipt, or guest tracking existed.

### Implemented (logic in `lib/customer-account.js`, wired in `server.js`)
- **Ownership rule**: `customerId` match, or a *verified* phone (`phoneVerifiedAt`) for legacy guest orders only. Applied to list/cancel/rate/reorder/receipt. Nothing sets `phoneVerifiedAt` yet, so phone-only access is now off.
- `PATCH /api/customer/me` (name/email/phone only; duplicates → 409; changing phone clears `phoneVerifiedAt`; contact changes audited).
- `GET/PUT /api/customer/favorites` (stores + items, max 100, per account).
- `POST /api/customer/orders/:id/reorder`: re-prices from the live catalogue, reports removed/unavailable/out-of-stock/reduced quantities. Returns a proposal only; checkout still re-validates price/stock/hours.
- `GET /api/customer/orders/:id/receipt`: owner + delivered/done only, whitelisted fields (no codes, commission, driver data).
- **Guest tracking**: guest orders return a one-time `trackingToken` (only its SHA-256 is stored as `order.trackHash`); `GET /api/track/:id` needs header `X-Track-Token`, rate-limited, 404 otherwise, view excludes phone/address/codes. Page: `/track/#<id>.<token>` (token in the fragment).
- **Account deletion** (`DELETE /api/customer/me`): re-auth (password, or `DELETE` for Google accounts), blocked while orders are active (409 `ACTIVE_ORDERS`) or wallet balance > 0 (409 `WALLET_BALANCE`); then the account is removed from `customers`, a PII-free tombstone goes to `deletedCustomers`, the customer's orders keep items/amounts/dates/financials but name, phone, address, notes, coordinates and track hash are cleared; tokens + push subscriptions revoked; audited.
- UI: `/orders/` shows Reorder + Receipt on delivered orders, profile edit form, password-confirmed deletion; checkout shows the guest tracking link.

### Tests
`node --test tests/*.test.js` → 329/329 (311 baseline + 11 lib tests + 7 route tests). The route tests execute the **real
route block extracted from server.js** against an in-memory fake `app`; they are not full HTTP tests.

### Not done / blocked
- **Guest checkout "after phone verification"**: needs an SMS provider and OTP flow (none in the repo). Guest checkout still works unverified; only tracking is now protected. Blocked on SMS credentials/provider choice.
- Favorites have API only; no heart/toggle buttons in the storefront yet.
- Legacy guest orders (no `trackHash`) have no tracking link.
- Receipt is an on-screen/printable view, not a PDF.
- Server not run end to end (`npm install` unavailable offline); browser tests not re-run.
