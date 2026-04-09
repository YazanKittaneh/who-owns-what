# Schema Plan

Last validated: 2026-04-09

## Current State

### Active raw tables

- `chi_parcels`
- `chi_owners`
- `chi_permits`
- `chi_violations`
- `chi_311`
- `chi_geographies`
- `chi_tax_sale_annual`
- `chi_tax_sale_scavenger`
- `chi_recorder_documents`
- `chi_business_owners`
- `chi_business_licenses`
- `ihs_indicators`
- `woodstock_mortgage_metadata`
- `bor_search_results`
- `data_load_audit`

### Active derived tables and functions

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

### Current schema gaps

- No history-preserving owner dimension beyond raw `chi_owners`.
- No normalized owner-entity table.
- No normalized mailing-address table.
- No nearby-owner or prospect-list objects.
- No notes/status or outreach activity objects.
- Confidence scoring exists only implicitly in `wow_business_linkage_matches` scores, not as a cross-domain model.

## Desired State

The target schema should explicitly separate raw, normalized, and product-serving layers.

### Raw layer

- Keep current raw tables appendable and source-faithful.
- Add consistent run metadata for every loader.

### Normalized layer

Recommended new objects:

| Object | Purpose | Primary key |
|---|---|---|
| `wow_owner_history_by_pin` | History of owner rows by `pin` and year | `(pin, source_year, raw_owner_row_id)` |
| `wow_owner_entity` | Canonical owner/business entity record | `owner_entity_id` |
| `wow_owner_alias` | Name variants tied to owner entities | `owner_alias_id` |
| `wow_mailing_address_norm` | Canonical mailing/business address dimension | `mailing_address_id` |
| `wow_owner_entity_parcel_link` | Confidence-scored parcel-to-entity link | `(pin, owner_entity_id, link_source)` |
| `wow_business_linkage_evidence` | Normalized business-license and owner evidence | `evidence_id` |
| `wow_parcel_address_norm` | Canonical parcel address variants used by search and joins | `pin` |

### Product-serving layer

Recommended new objects:

| Object | Purpose |
|---|---|
| `wow_owner_profile_summary` | Owner-level rollup across parcels, signals, and freshness |
| `wow_nearby_owner_candidates` | Nearby parcels and owners around a seed parcel |
| `wow_indicator_match_audit_monthly` | Join QA for permits, violations, and 311 |
| `wow_ihs_community_area_yearly` | Clean annual IHS facts keyed by community area and year |
| `wow_portfolio_community_area_bridge` | Portfolio-to-community-area mapping for multi-area portfolios |
| `wow_prospect_list` | Saved list metadata |
| `wow_prospect_list_item` | Saved parcel/owner candidates |
| `wow_outreach_activity` | Public/business-contact outreach tracking |
| `wow_prospect_note` | Notes and status history |

## Required Changes

### Join keys

- Parcel identity: `pin` is canonical.
- Legacy/support key: `pin10` only for source joins such as permit `pin_list`.
- Avoid making `bbl` part of new Chicago schema design.
- For geography-linked annual indicators, use a stable normalized community-area bridge rather than ad hoc joins inside request SQL.

### Provenance requirements

Every normalized or product-serving table should carry:

- `source_dataset`
- `source_table`
- `source_ref` or source file path
- `run_id`
- `loaded_at`
- `match_method`
- `confidence_score` where applicable

### Confidence scoring requirements

Recommended initial scoring bands:

- `90-100`: exact or highly corroborated match
- `70-89`: likely match requiring limited review
- `40-69`: weak heuristic evidence, not ownership proof
- `0-39`: do not auto-link into owner entities

These scores should be used for business linkage, mailing-address linkage, and future nearby-owner ranking.

### Migration strategy

1. Keep existing raw and serving tables intact while introducing normalized objects in parallel.
2. Build normalized tables from current raw sources first; do not block on future datasets.
3. Derive owner-profile and nearby-owner serving tables from the normalized layer.
4. Shift new APIs to the normalized layer while preserving current `/api/address` contracts.
5. Retire or clearly mark stale SQL artifacts after replacement objects are validated.

### Raw vs normalized storage rules

- Raw tables remain source-faithful and reloadable.
- Normalized tables may deduplicate, standardize, and score, but must always point back to raw provenance.
- Product-serving tables may aggregate across parcels or owners, but must preserve freshness metadata and drill-back paths.

## Open Questions

- Should owner entities be versioned over time, or should only parcel-to-entity links be time-aware in MVP?
- Should prospect-list tables live in the same database/schema as public data, or in a separate app-owned schema?
- How much of Woodstock should move from metadata-only to row-level facts in the first seller-opportunity milestone?
