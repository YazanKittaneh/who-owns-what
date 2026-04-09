# Technical Architecture

Last validated: 2026-04-09

## Scope

This repo already operates as a Chicago property intelligence application, but the implementation is still a narrow parcel-portfolio explorer rather than a full Chicago real-estate intelligence platform. This document describes the current architecture, the desired target architecture, and the concrete repo changes required to close that gap.

## Current State

### System layers

| Layer | Current implementation | Key files |
|---|---|---|
| Ingestion | Three separate manual pipelines: core `chi_*`, supplemental package loads, and source-expansion loads | `dbtool.py`, `who-owns-what.yml`, `scripts/fetch_chi_data.py`, `scripts/load_supplemental_data.py`, `scripts/load_source_expansion.py` |
| Raw storage | CSV-first staging in `data/`, then PostgreSQL raw tables | `data/`, `dbtool.py`, `sql/create_*_tables.sql` |
| Derived storage | Parcel, portfolio, indicator, tax-sale, recorder, and business-linkage summaries | `sql/create_parcels_table.sql`, `sql/create_indicators_table.sql`, `sql/create_indicatorhistory_table.sql`, `sql/create_tax_sale_summary.sql`, `sql/create_recorder_summary.sql`, `sql/create_business_linkage_summary.sql` |
| API | Thin Django views that mostly run SQL files or SQL functions, now including viewport map, nearby-owner, and current owner profile endpoints | `wow/views.py`, `wow/urls.py`, `wow/forms.py`, `wow/sql/` |
| Frontend | React 16 app with a map-first home page, dedicated property page, current owner page, saved-lists page, plus legacy portfolio/timeline/summary subroutes | `client/src/containers/HomePage.tsx`, `client/src/containers/PropertyPage.tsx`, `client/src/containers/OwnerPage.tsx`, `client/src/containers/SavedListsPage.tsx`, `client/src/containers/AddressPage.tsx` |
| Ops/admin | Health check, admin-gated data-coverage endpoint, and Docker-based deployment docs | `wow/views.py`, `docs/DEPLOYMENT.md`, `docker-compose.prod.yml` |

### Ingestion architecture

- Core Chicago refresh is `scripts/fetch_chi_data.py` -> `data/chi_*.csv` -> `python dbtool.py builddb --update`.
- `dbtool.py` uses `who-owns-what.yml` to load the six core dependencies and rebuild the core WoW objects.
- Supplemental loads are outside `builddb` and must be run separately with `scripts/load_supplemental_data.py`.
- Expansion loads are also outside `builddb` and use `scripts/load_source_expansion.py`, which is the only loader that records `data_load_audit` metadata.

### Raw vs derived data model

Active raw tables:

- Core: `chi_parcels`, `chi_owners`, `chi_permits`, `chi_violations`, `chi_311`, `chi_geographies`
- Supplemental: `chi_tax_sale_annual`, `chi_tax_sale_scavenger`, `chi_recorder_documents`, `chi_business_owners`, `chi_business_licenses`
- Expansion: `ihs_indicators`, `woodstock_mortgage_metadata`, `bor_search_results`, `data_load_audit`

Active derived tables and functions:

- `wow_parcels`
- `wow_portfolios`
- `wow_indicators`
- `wow_indicatorhistory_monthly`
- `wow_tax_sale_summary`
- `wow_recorder_summary`
- `wow_business_linkage_matches`
- `wow_business_linkage_summary`
- `get_assoc_addrs_from_pin(text)`
- `get_agg_info_from_pin(text)`

### Owner and entity resolution approach

- Current portfolio construction is intentionally simple: `portfoliograph/table.py` groups parcels by `coalesce(mail_address_name, row_id, pin)`.
- `wow_portfolios.graph` is always `{}` and `owner_names` is a one-item array, so the runtime does not yet model shell-company networks or owner aliases.
- Business-linkage SQL exists, but the resulting summaries are not exposed in the API or UI.

### Nearby-owner search architecture

- Nearby-owner search now exists as a lightweight SQL-first implementation:
  - viewport loading via `wow/sql/address_overview_map.sql`
  - nearby parcel lookup via `wow/sql/address_nearby.sql`
  - current owner profile lookup via `wow/sql/owner_current.sql`
- Current grouping is intentionally simple and built on `wow_parcels.owner_id`, then exact `owner_name` fallback.
- Browser-local saved lists are implemented in `client/src/util/savedNearbyLists.ts` and surfaced through `SavedListsPage.tsx`.
- This is still not a normalized owner-entity graph or a server-side prospecting system.

### API architecture

- The current product is PIN-first for search, portfolio lookup, building info, export, and most timeline use.
- Endpoints are thin wrappers around SQL and functions, with fallback SQL when derived WoW objects are missing.
- `/api/address/indicatorhistory` still carries a legacy `bbl` branch for NYC compatibility.
- `/api/address/overview-map`, `/api/address/nearby`, and `/api/owner/current` now support the new map/property/owner workflows.
- `/api/admin/data-coverage` is now guarded by admin auth logic.

### Frontend workflow architecture

- Current primary user journey is `home overview map -> property modal -> property page`.
- The property page now hosts nearby-owner, owner pivot, timeline, and portfolio exploration workflows.
- Owner profile and saved-lists pages now exist, but saved lists are browser-local only.
- Many components still carry NYC-specific columns, links, copy, and timeline datasets.
- There is still no server-side prospect list object, notes/status system, or admin dashboard in the UI.

### Ops, admin, and data coverage architecture

- Production health is exposed at `/api/health/` through `project/urls.py` and `wow/urls.py`.
- Data coverage is derived at request time by `wow.views.admin_data_coverage` using row counts, year ranges, and `data_load_audit` when available.
- The repo has deployment guidance, but no single repo-specific runbook for refresh, verification, failure recovery, and freshness review.

## Desired State

### Architecture goals

- Treat Chicago `PIN` as the primary parcel identity across data, API, and UI.
- Preserve raw sources exactly as loaded, and add normalized and derived layers for search, owner intelligence, prospecting, and outreach workflows.
- Keep contact modeling limited to public and business-contact paths: mailing addresses, registered agents, business licenses, and consent-based manual enrichment.
- Make provenance and freshness first-class fields in both SQL objects and API responses.

### Target system layers

| Layer | Desired architecture |
|---|---|
| Ingestion | One documented refresh sequence with per-dataset audits and resumable large fetches |
| Storage | Clear raw, normalized, and product-serving layers |
| Entity model | Separate parcel, owner entity, owner alias, contact channel, prospect list, and outreach activity objects |
| API | Explicit Chicago/PIN-first contracts for property, owner, nearby-owner, prospect-list, export, and admin/freshness workflows |
| Frontend | Chicago-first workflows with NYC leftovers removed or isolated as legacy |
| Ops | Canonical runbook, freshness verification, coverage checks, and failure-recovery procedures |

## Required Changes

### Data and ingestion

- Unify the documented refresh sequence across `dbtool.py`, `scripts/load_supplemental_data.py`, and `scripts/load_source_expansion.py`.
- Add `data_load_audit` style run metadata for core and supplemental loaders, not just expansion loaders.
- Backfill `chi_owners` beyond the current 2025-2026 depth and make historical refreshes disk-aware.

### Schema and SQL

- Add normalized owner and address layers instead of relying on `mail_address_name` grouping alone.
- Add derived tables for owner history, entity resolution, nearby-owner search, and prospecting outputs.
- Mark stale SQL artifacts such as `sql/create_ihs_integration.sql` and `sql/create_ihs_views.sql` as experimental or replace them with runtime-aligned objects.

### API

- Keep the existing search/detail endpoints stable, but add dedicated Chicago endpoints for owner intelligence, business linkages, nearby-owner search, prospect lists, and admin coverage.
- Remove ambiguity from timeline mode by making Chicago clients use `pin` only.
- Protect admin-only routes.

### Frontend

- Preserve the current search and portfolio shell, but add owner-profile and prospecting flows on top of it.
- Replace NYC-only linkouts and terminology in `UsefulLinks.tsx`, `PortfolioTable.tsx`, `PortfolioFilters.tsx`, `IndicatorsDatasets.tsx`, and the content JSON files.
- Introduce admin freshness views and prospect-list actions near the existing portfolio filters and export surface.

### Ops and testing

- Add one canonical runbook for refresh, verification, and recovery.
- Add smoke tests for `/api/health/`, `/api/address/search`, `/api/address`, `/api/address/indicatorhistory`, and `/api/admin/data-coverage`.
- Add data-quality assertions for mandatory row counts, year ranges, and join coverage.

## Repo-Specific File and Table Map

### Core files

- `dbtool.py`
- `who-owns-what.yml`
- `wow/views.py`
- `wow/urls.py`
- `wow/forms.py`
- `client/src/containers/HomePage.tsx`
- `client/src/containers/PropertyPage.tsx`
- `client/src/containers/OwnerPage.tsx`
- `client/src/containers/SavedListsPage.tsx`
- `client/src/containers/AddressPage.tsx`
- `client/src/components/APIClient.ts`
- `client/src/components/NearbyOwners.tsx`
- `client/src/util/savedNearbyLists.ts`

### Active SQL surface

- `sql/create_parcels_table.sql`
- `sql/create_portfolios_table.sql`
- `sql/create_indicators_table.sql`
- `sql/create_indicatorhistory_table.sql`
- `sql/search_function_pin.sql`
- `sql/agg_function.sql`
- `wow/sql/address_search.sql`
- `wow/sql/address_search_fallback.sql`
- `wow/sql/address_overview_map.sql`
- `wow/sql/address_nearby.sql`
- `wow/sql/owner_current.sql`
- `wow/sql/address_buildinginfo.sql`
- `wow/sql/address_indicatorhistory_chi.sql`
- `wow/sql/address_indicatorhistory_chi_with_ihs.sql`

## Architectural Principles And Tradeoffs

- `PIN` remains the canonical parcel key even when other source systems expose address-only or year-specific data.
- The repo should keep the current SQL-first serving model; most needed capability can be added with new normalized tables and views rather than a large Django-domain rewrite.
- Current fallback behavior is useful for partial DB states and should be retained, but admin-facing surfaces should distinguish degraded mode from healthy mode.
- Business linkage should remain supportive evidence, not ownership proof.
