# Data Roadmap

Last validated: 2026-04-09

## Current State

### Source inventory

| Source family | Current state | Key files |
|---|---|---|
| Core Socrata sources | Loaded via CSV fetch plus `builddb` | `scripts/fetch_chi_data.py`, `dbtool.py`, `who-owns-what.yml` |
| Supplemental tax/recorder/business package | Loaded separately from staged package | `scripts/load_supplemental_data.py`, `data/supplemental-20260329/` |
| IHS indicators | Loaded and used in timeline API | `scripts/load_source_expansion.py`, `wow/sql/address_indicatorhistory_chi_with_ihs.sql` |
| Woodstock mortgage data | Metadata only | `scripts/extract_woodstock_metadata.py`, `woodstock_mortgage_metadata` |
| BOR | Sample search results only | `scripts/scrape_bor_decisions.py`, `bor_search_results` |
| Registered Chicago taxpayer | Missing source | `wow.views.admin_data_coverage`, `TODO.md` |
| Illinois SOS | Placeholder tables only | `il_sos_*` tables |

### Known coverage gaps

- `chi_owners` history is currently limited to 2025-2026 in the validated environment.
- Recorder data appears limited to the staged 2013-2015 file.
- Woodstock has no row-level fact ingest.
- BOR detail-level access is blocked by captcha.
- Registered Chicago taxpayer source is retired and not replaced.

## Desired State

- A documented refresh strategy for each source family.
- Historical owner depth sufficient for owner-history and seller-opportunity workflows.
- Consistent loader audits and quality checks.
- Clear source acceptance criteria for public/business-contact workflows.

## Required Changes

### Refresh strategy

| Source family | Recommended cadence | Required changes |
|---|---|---|
| `chi_parcels`, `chi_permits`, `chi_violations`, `chi_311` | weekly | Keep paged Socrata fetch and add post-load row-count checks |
| `chi_owners` | monthly incremental plus periodic deep backfill | Add bounded/year-scoped historical maintenance and load verification |
| Tax sale and recorder package | monthly or quarterly | Add loader audits and explicit source-date coverage metadata |
| Business license and owner package | monthly or quarterly | Expose freshness in future owner-intelligence APIs |
| IHS | annual | Keep current loader, but move annual aggregation into a dedicated derived table |
| Woodstock | annual | Decide whether metadata-only remains acceptable for MVP |
| BOR | experimental | Decide whether official access path exists; otherwise document as blocked |

### Historical backfill strategy

- Keep `fetch_chi_data.py --chi-owners-years latest` for normal refreshes.
- Add documented bounded backfills such as `2020-2026` before attempting `all`.
- Record year ranges loaded, row deltas, and elapsed time in `data_load_audit` or an equivalent core-audit table.
- Prefer staged yearly refreshes over one large destructive reload when restoring deep history.

### Load audit strategy

All loaders should record:

- dataset name
- source file or source URL
- run id
- row count
- status
- details JSON with checksums, year range, and warnings
- loaded timestamp

### Data quality checks

Minimum checks to add:

- mandatory raw and derived tables have nonzero rows
- `chi_owners` minimum and maximum year meet expected thresholds
- `ihs_indicators` includes the expected five indicators and annual span
- violations and 311 joins report matched and unmatched rates
- recorder and tax-sale summary tables cover the same `pin` universe as `wow_parcels`

### Missing sources and decision points

- Registered Chicago taxpayer: either obtain a replacement authoritative source or formally deprecate the planned workflow.
- BOR detail: either secure an approved data path or keep only sample/admin visibility.
- Illinois SOS: either complete ingest or remove placeholder tables from the roadmap until needed.

### Operational refresh sequence

1. Refresh core CSVs with `scripts/fetch_chi_data.py`.
2. Rebuild core objects with `python dbtool.py builddb --update`.
3. Load supplemental package with `python scripts/load_supplemental_data.py --data-dir data/supplemental-20260329`.
4. Refresh and normalize expansion sources as needed.
5. Load expansion sources with `python scripts/load_source_expansion.py --data-dir data/supplemental-20260331`.
6. Verify `/api/admin/data-coverage`, `/api/address/search`, `/api/address`, and `/api/address/indicatorhistory?pin=`.

### Storage and disk considerations

- `data/chi_311.csv` and deep-history `chi_owners.csv` are the largest practical disk risks.
- Historical fetches should check available disk before running.
- Refresh documentation should distinguish local staging, backup, and archive locations, but this task does not change any of those paths.

## Acceptance Criteria For The Next Data Milestone

- Core, supplemental, and expansion loaders all produce auditable run records.
- Historical `chi_owners` strategy is documented and tested on bounded ranges.
- Coverage endpoint distinguishes missing, partial, and healthy source families.
- One source decision is made for either BOR detail, registered taxpayer, or Illinois SOS.
