# Service zones — spec section 18

Three independent questions, three independent mechanisms:

| Question | Mechanism | Code |
|---|---|---|
| Do we deliver to this address (and does this store belong to that area)? | **Service zone** polygons | `lib/service-zones.js` |
| How far is the real drive, and is it within the limit? Fee and navigation. | **Road routing** (OSRM/ORS) | `lib/route-service.js`, `lib/delivery-pricing.js` |
| Which drivers do we offer the order to? | **H3 rings** | `lib/hexgrid.js`, `lib/dispatch-*.js` |

Zones never import H3/dispatch and dispatch never imports zones (asserted in `tests/service-zones.test.js`).

## Rules enforced on the server (`serviceZones.guard`)
1. The delivery pin must be valid, else `LOCATION_REQUIRED`.
2. At least one active zone must exist, else `OUT_OF_SERVICE_AREA / NO_ACTIVE_ZONES` (fail-closed).
3. The pin must be inside an active zone, else `OUTSIDE_SERVICE_AREA`.
4. The store must be inside the same zone, else `STORE_OUTSIDE_ZONE` (stores without coordinates: address-only check).
5. Road limit = zone `maxRoadKm`, else the global `deliveryMaxKm` (distance mode only). In flat mode a limit applies only if the zone sets one, and then the road is measured; if routing fails the order is refused (`ROUTING_UNAVAILABLE`, 503). No straight-line fallback.
Every refusal returns `{error, code, reason, message:{ar,fr,en}}`. The gate runs on `POST /api/orders`, `POST /api/delivery/quote` and pharmacy acceptance; accepted orders store `order.serviceZone` (zone, limit, measured km, time).

## API
Public: `GET /api/service-area`, `POST /api/service-area/check`.
Supervisor: `GET|POST /api/admin/service-zones`, `PUT|DELETE /api/admin/service-zones/:id`, `POST /api/admin/service-zones/test`.
Permissions: `zones.read` (system_admin, order_supervisor, driver_supervisor), `zones.manage` (system_admin only, listed in `EXPLICIT_ONLY`). Edits use an optimistic `revision` (409 `STALE_REVISION`), removing/deactivating the last active zone needs `confirmBlockAll:true`, every change is audited with before/after (polygon logged when it changed).
UI: `/admin/zones/` (sidebar "Service zones").

## Storage / migration
`data/service_zones.json` `{version, revision, updatedAt, zones[]}`. Nothing is written until a supervisor saves; until then a **placeholder** 7 km circle around central Berrechid (`seeded:true`) is used. No existing data is changed, so no backup/migration is needed; rollback = delete the file (returns to the placeholder) or restore the previous copy.

## Known limits
- The placeholder boundary is NOT the real city limit. A supervisor must redraw it.
- Zone geometry uses planar point-in-polygon (fine at city scale). Polygons crossing the antimeridian/poles are unsupported.
- Existing orders are not re-evaluated.
- Verified without the real server and real Leaflet (see final report).
