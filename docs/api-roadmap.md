# API Roadmap

Last validated: 2026-04-09

## Current State

### Active endpoints

| Endpoint | Current behavior | Main implementation |
|---|---|---|
| `GET /api/health/` | DB connectivity health check | `project/urls.py`, `wow/urls.py`, `wow.views.health_check` |
| `GET /api/admin/data-coverage` | Coverage/freshness summary across selected datasets | `wow.views.admin_data_coverage` |
| `GET /api/address/search?q=` | Address autocomplete/search | `wow/views.py`, `wow/sql/address_search.sql` |
| `GET /api/address?pin=` | Portfolio parcel lookup by `pin` | `sql/search_function_pin.sql` |
| `GET /api/address/overview-map?north=&south=&east=&west=` | Viewport parcel loading for the home-page map | `wow.views.address_overview_map`, `wow/sql/address_overview_map.sql` |
| `GET /api/address/nearby?pin=&radius_m=&limit=` | Nearby parcel + current owner/mail-to lookup around a seed `pin` | `wow.views.address_nearby`, `wow/sql/address_nearby.sql` |
| `GET /api/owner/current?owner_id=` or `?owner_name=` | Current owner profile using present `wow_parcels` grouping | `wow.views.owner_current`, `wow/sql/owner_current.sql` |
| `GET /api/address/aggregate?pin=` | Aggregated portfolio counts | `sql/agg_function.sql` |
| `GET /api/address/buildinginfo?pin=` | Unregistered/no-portfolio building info path | `wow/sql/address_buildinginfo.sql` |
| `GET /api/address/indicatorhistory?pin=` | Chicago timeline, with IHS fallback behavior | `wow/sql/address_indicatorhistory_chi_with_ihs.sql` |
| `GET /api/address/indicatorhistory?bbl=` | Legacy NYC timeline path | `wow/sql/address_indicatorhistory.sql` |
| `GET /api/address/export?pin=` | CSV export for associated parcels | `wow.views.address_export` |

### Current API constraints

- Chicago runtime is mostly `pin`-first, but timeline still accepts legacy `bbl` input.
- Nearby-owner and current owner profile flows now have dedicated endpoints, but still rely on current `wow_parcels` owner rows rather than normalized owner entities.
- Saved lists are frontend/browser-local only and have no backend API yet.
- Business linkage, Woodstock, BOR, notes/status, and shared prospect-list workflows still have no dedicated product endpoints.
- Admin coverage requires auth in the current backend implementation.
- Only some endpoints have fallback SQL behavior for partial DB states.

## Desired State

### API principles

- All new Chicago endpoints are `pin`-first or owner-entity-first.
- Every product endpoint returns freshness and provenance metadata for nontrivial derived data.
- Admin routes require auth or an explicit admin token boundary.
- Fallback behavior is explicit and documented rather than silent.

### Proposed endpoint groups

#### Property and portfolio

- Keep:
  - `GET /api/address/search`
  - `GET /api/address`
  - `GET /api/address/overview-map`
  - `GET /api/address/nearby`
  - `GET /api/address/buildinginfo`
  - `GET /api/address/export`
- Add:
  - `GET /api/property/profile?pin=`
  - `GET /api/property/history?pin=`
  - decide whether `GET /api/address/nearby` graduates to `GET /api/property/nearby` or remains an address API

#### Owner intelligence

- Keep for current-state owner grouping:
  - `GET /api/owner/current?owner_id=`
  - `GET /api/owner/current?owner_name=`
- Add:
  - `GET /api/owner/profile?owner_entity_id=`
  - `GET /api/owner/portfolio?owner_entity_id=`
  - `GET /api/owner/linkages?owner_entity_id=`

#### Prospect lists and workflow state

- Add:
  - `GET /api/prospect-lists`
  - `POST /api/prospect-lists`
  - `GET /api/prospect-lists/{id}`
  - `POST /api/prospect-lists/{id}/items`
  - `POST /api/prospect-lists/{id}/notes`
  - `POST /api/prospect-lists/{id}/status`

#### Admin and freshness

- Keep, but protect:
  - `GET /api/admin/data-coverage`
- Add:
  - `GET /api/admin/load-audit`
  - `GET /api/admin/data-quality`

## Required Changes

### Request and response recommendations

All new derived-data endpoints should include fields like:

- `freshness`: last successful load time or table-level max timestamp
- `provenance`: source datasets or evidence summaries
- `confidence`: numeric score and band where matching is heuristic
- `degraded`: whether fallback mode or partial source coverage affected the response

Example owner-linkage response shape:

```json
{
  "owner_entity_id": "oe_123",
  "display_name": "123 EXAMPLE LLC",
  "parcels": [{ "pin": "17032270221140" }],
  "business_linkages": [
    {
      "account_number": "12345",
      "match_type": "business_name_exact",
      "confidence": 100,
      "is_ambiguous": false
    }
  ],
  "freshness": {
    "chi_owners_loaded_at": "2026-04-08T00:00:00Z"
  }
}
```

### `PIN`-first Chicago behavior

- New Chicago endpoints must not accept `bbl`.
- Existing `indicatorhistory?bbl=` support should be documented as legacy-only and removed from Chicago UI callers.
- Search results should continue returning `pin` and human-readable address fields.

### Auth and admin boundaries

- Public property research endpoints may remain open.
- Admin endpoints should require staff auth, signed token, or an allowlisted internal environment boundary.
- Shared/server-side prospect-list and notes/status endpoints should require authenticated users.
- Browser-local saved lists can remain unauthenticated until backend persistence is introduced.

### Fallback behavior expectations

- Keep fallback search/detail behavior when WoW derived objects are absent.
- Return a structured `degraded` flag for fallback responses rather than making degraded mode invisible.
- Coverage and admin endpoints should never silently hide missing source limitations.

## Acceptance Criteria For The Next API Milestone

- Chicago UI no longer prefers `bbl` for timeline requests.
- `/api/admin/data-coverage` remains protected.
- Current owner-profile and nearby-owner endpoints are documented as first-pass current-row lookups.
- API docs clearly distinguish public endpoints, authenticated workflow endpoints, and admin endpoints.
