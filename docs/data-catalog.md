# WoW Chicago Data Catalog

Last updated: 2026-04-09

Validation status: Rechecked against the running `wow-api`/`wow-db` containers and current repository code on 2026-04-08.

## Scope

This document is the canonical inventory of data in this project:

1. What datasets exist and where they come from
2. Which datasets are in the DB vs missing
3. Which datasets are exposed by API and actually used by UI
4. How to refresh, load, and verify data end-to-end

## High-Level Data Flow

1. External sources -> raw files in `data/`
2. Raw files -> raw DB tables (`chi_*`, supplemental raw tables)
3. Raw tables -> derived WoW tables (`wow_*`) via SQL build steps
4. API endpoints read `wow_*` (with fallback SQL for partial DB states)
5. React UI consumes API responses

Core build chain:

- Dataset dependency list: `who-owns-what.yml`
- Core loader: `dbtool.py`
- SQL build: `sql/create_parcels_table.sql`, `sql/create_indicators_table.sql`, `sql/create_indicatorhistory_table.sql`, `sql/search_function_pin.sql`, `sql/agg_function.sql`

Supplemental build chain:

- Loader: `scripts/load_supplemental_data.py`
- SQL: `sql/create_tax_sale_tables.sql`, `sql/create_recorder_tables.sql`, `sql/create_business_linkage_tables.sql`
- Derived summaries: `sql/create_tax_sale_summary.sql`, `sql/create_recorder_summary.sql`, `sql/create_business_linkage_summary.sql`

Source expansion build chain:

- Raw/source fetch: `scripts/fetch_source_expansion.py`
- Normalization: `scripts/parse_ihs_html.py`, `scripts/extract_woodstock_metadata.py`, `scripts/scrape_bor_decisions.py`
- Loader: `scripts/load_source_expansion.py`
- SQL: `sql/create_ihs_tables.sql`, `sql/create_woodstock_tables.sql`, `sql/create_bor_tables.sql`

## Current Live DB Snapshot (prod API DB)

Snapshot source: revalidated by direct query against the running `wow-api` DB connection on 2026-04-08.

### Core raw tables

| Table | Rows | Notes |
|---|---:|---|
| `chi_parcels` | 882,697 | Core parcel source |
| `chi_owners` | 1,767,253 | Currently 2025-2026 only |
| `chi_permits` | 831,133 | Core permits source |
| `chi_violations` | 2,000,589 | Core violations source |
| `chi_311` | 13,562,312 | Core 311 source |
| `chi_geographies` | 186 | Geography lookup |

### Core derived WoW tables

| Table | Rows | Notes |
|---|---:|---|
| `wow_parcels` | 882,697 | One latest parcel row per pin |
| `wow_portfolios` | 658,936 | Portfolio groups |
| `wow_indicators` | 882,697 | Current totals per pin |
| `wow_indicatorhistory_monthly` | 6,404,544 | Monthly time series |

### Supplemental tables

| Table | Rows | Notes |
|---|---:|---|
| `chi_tax_sale_annual` | 200,915 | Raw tax sale |
| `chi_tax_sale_scavenger` | 5,609 | Raw scavenger sale |
| `chi_recorder_documents` | 511,173 | Raw recorder docs |
| `chi_business_owners` | 327,443 | Raw business owners |
| `chi_business_licenses` | 739,745 | Raw business licenses |
| `wow_tax_sale_summary` | 882,697 | Derived tax sale summary |
| `wow_recorder_summary` | 882,697 | Derived recorder summary |
| `wow_business_linkage_matches` | 194,258 | Match records |
| `wow_business_linkage_summary` | 58,614 | Summarized linkages |

### Source expansion tables

| Table | Rows | Year Range | Notes |
|---|---:|---|---|
| `ihs_indicators` | 7,669 | 2005-2024 | Loaded and used in timeline API |
| `woodstock_mortgage_metadata` | 7 | 2018-2024 | Metadata only (not row-level mortgage facts) |
| `bor_search_results` | 40 | 2022-2025 | Sample BOR scrape output |
| `data_load_audit` | 7 | N/A | Loader run audit entries |

### Placeholder/empty tables

| Table | Rows | Notes |
|---|---:|---|
| `il_sos_corporations_master` | 0 | Placeholder only |
| `il_sos_corporations_agents` | 0 | Placeholder only |
| `il_sos_llc_master` | 0 | Placeholder only |
| `il_sos_llc_agents` | 0 | Placeholder only |

## Dataset-by-Dataset Catalog

Legend:

- API Exposed:
  - `Y` = has endpoint payload access
  - `Partial` = only surfaced in admin coverage endpoint
  - `N` = not exposed by API
- UI Used:
  - `Y` = rendered in current React UI
  - `Partial` = used only in specific tab/filter/conditional rendering
  - `N` = not rendered currently

### Core Chicago datasets

| Dataset | Source | Raw File | DB Tables | In DB | API Exposed | UI Used | Refresh Cadence (recommended) | Join Keys / Schema Notes |
|---|---|---|---|---|---|---|---|---|
| Parcels | Cook County Socrata (`pabr-t5kh`) | `data/chi_parcels.csv` | `chi_parcels`, `wow_parcels`, `wow_portfolios` | Yes | Y | Y | Weekly or monthly | Key: `pin`, `pin10`; includes address/geo/class fields |
| Owners | Cook County Socrata (`3723-97qp`) | `data/chi_owners.csv` | `chi_owners`, feeds `wow_parcels` + portfolio grouping | Yes | Y | Y | Monthly + annual full-history refresh | Key: `pin`; current prod scope is 2025-2026 only |
| Permits | Chicago Socrata (`ydr8-5enu`) | `data/chi_permits.csv` | `chi_permits`, `wow_indicators`, `wow_indicatorhistory_monthly` | Yes | Y | Y | Weekly | Uses permit `pin_list` exploded against `pin10` |
| Violations | Chicago Socrata (`22u3-xenr`) | `data/chi_violations.csv` | `chi_violations`, `wow_indicators`, `wow_indicatorhistory_monthly` | Yes | Y | Y | Weekly | Address-normalized join to parcel addresses |
| 311 requests | Chicago Socrata (`v6vf-nfxy`) | `data/chi_311.csv` | `chi_311`, `wow_indicators`, `wow_indicatorhistory_monthly` | Yes | Y | Y | Weekly | Address-normalized join to parcel addresses |
| Geographies | Local/reference CSV | `data/chi_geographies.csv` | `chi_geographies` | Yes | N | N | As needed | Minimal current runtime usage; mostly legacy/support |

### Supplemental Chicago datasets (20260329 package)

| Dataset | Source | Raw File | DB Tables | In DB | API Exposed | UI Used | Refresh Cadence (recommended) | Join Keys / Schema Notes |
|---|---|---|---|---|---|---|---|---|
| Annual tax sale | Cook County Treasurer | `data/supplemental-20260329/tax/treasurer_annual_tax_sale.csv` | `chi_tax_sale_annual` -> `wow_tax_sale_summary` | Yes | Y (via derived) | Y | Monthly/quarterly | Key: normalized `pin`; includes buyer/amount/year |
| Scavenger tax sale | Cook County Treasurer | `data/supplemental-20260329/tax/treasurer_scavenger_tax_sale.csv` | `chi_tax_sale_scavenger` -> `wow_tax_sale_summary` | Yes | Y (via derived) | Y | Monthly/quarterly | Key: normalized `pin`; merged with annual events |
| Recorder docs | Cook County Recorder | `data/supplemental-20260329/recorder/recorder_foreclosures_mortgages_quitclaim_2013_2015.csv` | `chi_recorder_documents` -> `wow_recorder_summary` | Yes | Y (via derived) | Y | Quarterly (or source update cadence) | Key: normalized `pin`; derives mortgage/quitclaim/foreclosure counts |
| Business owners | Chicago data portal | `data/supplemental-20260329/corporate/chicago_business_owners.csv` | `chi_business_owners` -> linkage summaries | Yes | N | N | Monthly/quarterly | Account/name entity linkage input |
| Business licenses | Chicago data portal | `data/supplemental-20260329/corporate/chicago_business_licenses.csv` | `chi_business_licenses` -> linkage summaries | Yes | N | N | Monthly/quarterly | Account/name/address linkage input |

### Expansion datasets (20260331 package)

| Dataset | Source | Raw/Normalized Files | DB Tables | In DB | API Exposed | UI Used | Refresh Cadence (recommended) | Notes |
|---|---|---|---|---|---|---|---|---|
| IHS indicators | housingstudies.org data portal | Raw HTML in `data/supplemental-20260331/housing/ihs/`; normalized `data/supplemental-20260331/normalized/ihs_indicators.csv` | `ihs_indicators` | Yes | Y (`/api/address/indicatorhistory` for Chicago) | Y (timeline datasets) | Annual (new year publish) | 5 indicators, 77 community areas, 2005-2024 |
| Woodstock mortgage metadata | Woodstock XLSX files | Raw XLSX in `data/supplemental-20260331/housing/woodstock/`; normalized `woodstock_metadata.json` | `woodstock_mortgage_metadata` | Yes | Partial (`/api/admin/data-coverage` only) | N | Annual | Metadata only; no row-level mortgage fact table yet |
| BOR search results | Cook County BOR public search page scrape | `data/supplemental-20260331/normalized/bor_search_results.csv` | `bor_search_results` | Yes | Partial (`/api/admin/data-coverage` only) | N | Monthly/quarterly sample refresh | Current table holds small sampled scrape output |
| Registered Chicago taxpayer | Legacy Chicago finance page | source manifest only (`404` documented) | none | No | Partial (`/api/admin/data-coverage` status row) | N | N/A until source identified | Blocked: legacy source retired/no stable bulk endpoint |
| BOR detail-level data | BOR detail flow | none bulk | none | No | Partial (`/api/admin/data-coverage` status row) | N | N/A until access strategy | Blocked: detail page flow captcha-limited |

### Illinois SOS tables

| Dataset | Source | DB Tables | In DB | API Exposed | UI Used | Notes |
|---|---|---|---|---|---|---|
| IL SOS corporations/LLC bulk | ilsos.gov bulk zips | `il_sos_corporations_master`, `il_sos_corporations_agents`, `il_sos_llc_master`, `il_sos_llc_agents` | Empty placeholders | N | N | Table scaffolding exists; no ingest yet |

## API Exposure Matrix

### Endpoints and datasets they read

| Endpoint | Main SQL/Function | Main tables read | Fallback behavior |
|---|---|---|---|
| `GET /api/address/search` | `wow/sql/address_search.sql` | `wow_parcels` | Falls back to `wow/sql/address_search_fallback.sql` (`chi_parcels` + latest `chi_owners`) |
| `GET /api/address` | `get_assoc_addrs_from_pin` (`sql/search_function_pin.sql`) | `wow_parcels`, `wow_indicators`, `wow_tax_sale_summary`, `wow_recorder_summary`, `wow_portfolios` | Falls back to `wow/sql/address_query_fallback.sql` |
| `GET /api/address/overview-map` | `wow/sql/address_overview_map.sql` | `wow_parcels` | Returns empty result if WoW parcel tables missing |
| `GET /api/address/nearby` | `wow/sql/address_nearby.sql` | `wow_parcels` | Returns empty result if WoW parcel tables missing |
| `GET /api/owner/current` | `wow/sql/owner_current.sql` | `wow_parcels` | Returns empty result if WoW parcel tables missing |
| `GET /api/address/buildinginfo` | `wow/sql/address_buildinginfo.sql` | `wow_parcels`, `wow_indicators`, `wow_tax_sale_summary`, `wow_recorder_summary` | Falls back to `wow/sql/address_query_fallback.sql` |
| `GET /api/address/indicatorhistory?pin=` | `wow/sql/address_indicatorhistory_chi_with_ihs.sql` (or fallback to `..._chi.sql`) | `wow_indicatorhistory_monthly`, `wow_portfolios`, `chi_parcels`, `ihs_indicators` | If IHS tables missing, uses non-IHS timeline query |
| `GET /api/address/indicatorhistory?bbl=` | `wow/sql/address_indicatorhistory.sql` | NYC legacy tables | Legacy/NYC mode path |
| `GET /api/address/aggregate` | `get_agg_info_from_pin` (`sql/agg_function.sql`) | `wow_parcels`, `wow_indicators`, `wow_portfolios` | No explicit fallback |
| `GET /api/address/export` | `get_assoc_addrs_from_pin` (`sql/search_function_pin.sql`) | same as `/api/address` | No explicit fallback |
| `GET /api/admin/data-coverage` | `wow.views.admin_data_coverage` | table existence/count checks across target datasets + `data_load_audit` | Reports missing/partial reasons explicitly; no auth guard yet |

### API fields sent but not strongly used in UI

`/api/address` and `/api/address/buildinginfo` send many fields; current UI prominently uses only a subset.

Examples of fields sent but minimally/conditionally rendered:

- `latest_tax_sale_sold_at_sale`
- `latest_recorder_doc_date`
- `latest_mortgage_date`
- `latest_quitclaim_date`
- `latest_quitclaim_amount`
- `annual_tax_sale_count`, `scavenger_tax_sale_count` (mostly used in aggregate math)

## UI Consumption Matrix

### Currently wired and visible in Chicago flows

- Address search/autocomplete uses `/api/address/search`
- Home-page overview map uses `/api/address/overview-map`
- Property modal/detail uses `/api/address`
- Nearby-owner section uses `/api/address/nearby`
- Owner profile page uses `/api/owner/current`
- Unregistered flow uses `/api/address/buildinginfo`
- Timeline uses `/api/address/indicatorhistory`
- Portfolio filters/tables/summaries use:
  - permits/violations/311
  - tax sale summary fields
  - recorder summary fields
  - IHS timeline datasets

### New product surfaces implemented in the current UI

- `client/src/containers/HomePage.tsx`: map-first Chicago landing page
- `client/src/containers/PropertyPage.tsx`: dedicated property profile page for `/pin/:pin`
- `client/src/components/NearbyOwners.tsx`: nearby owner/parcels widget with radius toggle and CSV export
- `client/src/containers/OwnerPage.tsx`: current owner profile page
- `client/src/containers/SavedListsPage.tsx`: browser-local saved owners/parcels page

### Not wired to current UI

- `bor_search_results`
- `woodstock_mortgage_metadata`
- `wow_business_linkage_summary`
- `wow_business_linkage_matches`
- `data_load_audit` (only consumed by admin API endpoint, not frontend)
- `registered_chicago_taxpayer` (no table)
- BOR detail-level data (no table)

### Current owner/nearby limitations

- Nearby-owner results are powered by current `wow_parcels` rows only.
- Owner grouping is `owner_id` first, then exact `owner_name` fallback.
- Saved lists are browser-local only and are not stored in the backend.
- There is still no normalized owner-entity graph or shared prospect-list workflow.

### Legacy NYC fields still present in frontend types/components

Several components/types still carry NYC-era fields or copy (for compatibility), including `bbl`, rent-stabilization, and NYC linkouts. Confirmed examples include `client/src/components/UsefulLinks.tsx`, `client/src/components/PortfolioTable.tsx`, `client/src/components/IndicatorsDatasets.tsx`, and `client/src/components/PortfolioFilters.tsx`. In Chicago mode these are often null, misleading, or not meaningful.

## Raw File Inventory (key files)

Core:

- `data/chi_parcels.csv` (~863MB)
- `data/chi_owners.csv` (~188MB)
- `data/chi_permits.csv` (~640MB)
- `data/chi_violations.csv` (~1.0GB)
- `data/chi_311.csv` (~5.7GB)
- `data/chi_geographies.csv` (~6.5MB)

Supplemental:

- `data/supplemental-20260329/tax/treasurer_annual_tax_sale.csv`
- `data/supplemental-20260329/tax/treasurer_scavenger_tax_sale.csv`
- `data/supplemental-20260329/recorder/recorder_foreclosures_mortgages_quitclaim_2013_2015.csv`
- `data/supplemental-20260329/corporate/chicago_business_owners.csv`
- `data/supplemental-20260329/corporate/chicago_business_licenses.csv`

Expansion normalized:

- `data/supplemental-20260331/normalized/ihs_indicators.csv`
- `data/supplemental-20260331/normalized/bor_search_results.csv`
- `data/supplemental-20260331/normalized/woodstock_metadata.json`

## Operational Runbook

### 1) Refresh core Chicago source CSVs

```bash
python scripts/fetch_chi_data.py --output-dir data
```

Owner-year scoped refresh examples:

```bash
# latest only
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years latest --output-dir data

# bounded historical range
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years 2024-2026 --output-dir data

# all years (large)
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years all --output-dir data
```

### 2) Rebuild core DB tables

```bash
python dbtool.py builddb --update
```

### 3) Load supplemental package (tax/recorder/business)

```bash
python scripts/load_supplemental_data.py --data-dir data/supplemental-20260329
```

### 4) Refresh/load expansion package (IHS/Woodstock/BOR)

```bash
# fetch source files
python scripts/fetch_source_expansion.py --output-dir data/supplemental-20260331

# normalize
python scripts/parse_ihs_html.py
python scripts/extract_woodstock_metadata.py
python scripts/scrape_bor_decisions.py

# load
python scripts/load_source_expansion.py --data-dir data/supplemental-20260331
```

### 5) Verify data health quickly

DB table presence + counts (example from running API container):

```bash
docker exec wow-api python - <<'PY'
import os, psycopg2
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
for t in ['chi_parcels','chi_owners','chi_permits','chi_violations','chi_311','wow_parcels','wow_indicators','wow_indicatorhistory_monthly','ihs_indicators','woodstock_mortgage_metadata','bor_search_results']:
    cur.execute('SELECT to_regclass(%s)', [t])
    e = cur.fetchone()[0] is not None
    if not e:
        print(t, 'MISSING')
        continue
    cur.execute(f'SELECT COUNT(*) FROM {t}')
    print(t, cur.fetchone()[0])
cur.close(); conn.close()
PY
```

Coverage endpoint:

```bash
curl http://127.0.0.1:8000/api/admin/data-coverage
```

Endpoint smoke tests:

```bash
curl 'http://127.0.0.1:8000/api/address/search?q=118%20n%20clark'
curl 'http://127.0.0.1:8000/api/address?pin=<PIN_FROM_SEARCH>'
curl 'http://127.0.0.1:8000/api/address/indicatorhistory?pin=<PIN_FROM_SEARCH>'
```

### 6) Disk and backup hygiene

- Storage map: `docs/data-storage-map.md`
- Keep backups/staging archives on `/backup-pool/dump/wow-backups`
- Keep interrupted fetch artifacts (`*.tmp`, `*.progress`) cleaned up

## Known Gaps (as of now)

- `chi_owners` is multi-year but still not full historical depth (currently 2025-2026)
- `registered_chicago_taxpayer` has no stable bulk source configured
- BOR detail-level data remains blocked by captcha-limited public flow
- `woodstock_mortgage_metadata` is metadata-only (no row-level mortgage fact extraction yet)
- `bor_search_results` is small sample data, not comprehensive countywide ingestion
- Business linkage summaries exist in DB but are not exposed in API/UI
