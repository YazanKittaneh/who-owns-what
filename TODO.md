# TODO: Data, API, UI, and Ops Backlog

Last updated: 2026-04-09

This is the comprehensive open-work list for remaining changes, fixes, and implementations.

Validation status: Rechecked against the current repository plus the running `wow-api`/`wow-db` containers on 2026-04-08. Items below are confirmed open unless noted otherwise.

## P0 - Data Coverage Blockers

- [ ] **Backfill full `chi_owners` historical depth**
  - Current prod coverage is 2025-2026 only; older years still missing.
  - Implement chunked historical fetch/load strategy so large pulls do not exhaust disk.
  - Add per-year load verification report and owner-history depth metrics by run.

- [ ] **Replace missing Registered Chicago Taxpayer source**
  - Legacy source is retired (`404`) and no stable bulk source is configured.
  - Identify replacement authoritative source or formal deprecation plan.
  - If no source exists, define explicit product behavior and user-facing messaging.

- [ ] **Unblock BOR detail-level ingest**
  - Public detail flow is captcha-limited; no public bulk endpoint.
  - Define legal/technical path (official data request, partnership feed, or approved workflow).
  - Decide whether BOR detail remains out-of-scope if access cannot be automated.

## P1 - Core Pipeline and Data Modeling

- [ ] **Stabilize contact-data backfills before broad live deploys**
  - Split deploys from backfills so code fixes do not require expensive data reloads.
  - Move business-license ingestion from Python loops to SQL on top of `chi_business_licenses`.
  - Disable `contact_audit_log` writes for automated bulk loads; keep audit logging for manual/admin changes.
  - Add resumable chunking for large refreshes and run targeted pilots before citywide backfills.
  - Clean Docker build cache and reduce image rebuild churn before additional broad refresh work.
  - Add pre-deploy SQL and endpoint smoke tests, then measure runtime, rows written, audit volume, and API impact.

- [ ] **Automate `chi_owners` historical maintenance**
  - Add incremental update mode (append new year while preserving old years).
  - Avoid destructive reloads when only latest year changes.
  - Persist run metadata in `data_load_audit` for core datasets too.

- [ ] **Harden address-to-PIN matching quality for indicators**
  - Current violations/311 joins rely on normalized address strings.
  - Add QA checks for false positive/false negative join rates.
  - Track unmatched records and drift between source schema changes and join quality.

- [ ] **Review and rationalize `chi_geographies` usage**
  - Confirm if still required in runtime path.
  - Remove dead dependencies and stale joins if no longer used.
  - Update docs and SQL references accordingly.

- [ ] **Complete Illinois SOS ingestion path (or remove placeholders)**
  - `il_sos_*` tables exist but are empty placeholders.
  - Implement download/import workflow (with resilient fetch path) or remove until needed.

## P1 - Expansion Datasets (currently partial)

- [ ] **Promote BOR search ingestion from sample to production-grade**
  - Expand beyond current tiny sample table.
  - Add deduping keys, crawl/run metadata, and refresh cadence.

- [ ] **Extract Woodstock row-level mortgage data**
  - Current DB has metadata only (`woodstock_mortgage_metadata`).
  - Design normalized fact schema and selective columns.
  - Load and validate against workbook totals.

- [ ] **Add idempotent run IDs + audit for all loaders**
  - `load_source_expansion.py` has audits; core and supplemental flows should match.
  - Include source hash/file size and row-count deltas in audit details.

## P1 - API/Product Surface Gaps

- [ ] **Add admin UI for `/api/admin/data-coverage`**
  - Backend auth guard is now in place.
  - Surface freshness/coverage in the frontend with missing/partial reason codes.
  - Decide which environments expose the admin UI.

- [ ] **Expose data coverage in-app (admin UI)**
  - Add frontend admin panel for freshness/coverage status.
  - Include missing/partial reason codes and last load times.

- [ ] **Expose business linkage summaries via API**
  - Add endpoint(s) for `wow_business_linkage_summary` and detail matches.
  - Add explanatory UX around confidence and ambiguity.

- [ ] **Upgrade first-pass owner profile to normalized owner entities**
  - `client/src/containers/OwnerPage.tsx` and `/api/owner/current` now exist, but they still use current `wow_parcels` grouping.
  - Replace `owner_id`/exact-`owner_name` grouping with normalized owner entities, aliases, and evidence.

- [ ] **Upgrade nearby-owner workflow from current-row grouping to owner intelligence**
  - `client/src/components/NearbyOwners.tsx` and `/api/address/nearby` now exist.
  - Add better ranking/filtering, business-linkage support, and stronger owner-level pivots.

- [ ] **Replace browser-local saved lists with backend persistence**
  - `client/src/containers/SavedListsPage.tsx` and `client/src/util/savedNearbyLists.ts` currently store saved items in browser local storage only.
  - Add named lists, server-side persistence, and optional auth boundary.

- [ ] **Decide BOR/Woodstock product endpoints**
  - Define whether these are user-facing, admin-only, or analytics-only.
  - Implement API contracts if they should be consumable by UI.

## P1 - Chicago UX/Data Correctness Issues

- [ ] **Replace NYC-specific external links in `UsefulLinks` for Chicago mode**
  - Confirmed `client/src/components/UsefulLinks.tsx` still links to ACRIS, HPD, DOB, and DOF NYC systems.
  - Current links include NYC systems (ACRIS/HPD/DOB/DOF), which are incorrect for Chicago users.
  - Swap in Chicago/Cook equivalents and keep locale-safe tracking.

- [ ] **Audit legacy NYC fields and copy still shown in Chicago UI**
  - `client/src/components/PortfolioTable.tsx` still includes NYC-era columns such as `bbl`, rent-stabilized units, evictions, and ACRIS deed links.
  - `client/src/components/IndicatorsDatasets.tsx` and `client/src/components/PortfolioFilters.tsx` still include HPD/DOB/NYC-specific labels and explanatory copy.
  - Hide/remove nonfunctional Chicago-mode columns and text.
  - Keep compatibility only where still needed.

- [ ] **Clarify timeline mode behavior (`pin` vs `bbl`)**
  - Chicago uses `pin`; NYC path still exists and can leak legacy assumptions.
  - Confirmed `client/src/components/APIClient.ts` still prefers `bbl` when present, while Chicago detail flows are keyed by `pin`.
  - Add explicit mode handling and safeguards in API and UI.

## P2 - Data Quality, Monitoring, and Alerting

- [ ] **Add data quality assertions to CI/release checks**
  - Expected nonzero rows for mandatory tables.
  - Year-range sanity checks for `chi_owners`, `ihs_indicators`.
  - Null-rate thresholds on key join fields.

- [ ] **Add drift/anomaly alerts**
  - Alert on abrupt row-count drops/spikes.
  - Alert on unusual owner-depth regressions.
  - Alert on stale load timestamps.

- [ ] **Create reproducible data snapshot manifests for every load run**
  - Include source URLs, timestamps, checksums, row counts, and loader versions.

## P2 - Testing Coverage Gaps

- [ ] **Expand backend tests for new map/owner endpoints**
  - `wow/tests/test_milestone1.py` now has smoke coverage for `/api/admin/data-coverage`, `/api/address/overview-map`, `/api/address/nearby`, and `/api/owner/current`.
  - Add deeper assertions for bounds validation, nearby-distance ordering, owner lookup edge cases, and degraded-mode behavior.

- [ ] **Add tests for `scripts/fetch_chi_data.py --chi-owners-years`**
  - `latest`, `all`, single year, range, invalid range.

- [ ] **Add tests for `scripts/load_source_expansion.py` audit behavior**
  - Success and skip states.
  - Correct row counts and run metadata.

- [ ] **Add integration tests for IHS timeline enrichment**
  - Verify IHS columns appear in Chicago indicator history.
  - Verify fallback behavior when IHS table missing.

## P2 - Documentation Consistency

- [ ] **Keep new product docs aligned with implementation**
  - `README.md`, `docs/data-catalog.md`, `docs/api-roadmap.md`, `docs/product-workflows.md`, and `docs/technical-architecture.md` now mention the map-first home page, property page, owner page, nearby-owner workflow, and saved lists.
  - Keep them aligned as owner normalization, persistence, and ranking evolve.

- [ ] **Retire or fix stale SQL artifacts not used in runtime path**
  - Confirmed `sql/create_ihs_integration.sql` still assumes a `chi_geographies.pin10` join path that does not match the current working IHS runtime query.
  - Clearly mark experimental vs production SQL.

## P2 - Storage and Backup Automation

- [ ] **Automate DB backups directly to `/backup-pool/dump/wow-backups`**
  - Add scheduled backup job with retention policy.
  - Verify restore drills regularly.

- [ ] **Automate staging archive lifecycle**
  - Automatically archive staging snapshots to backup pool.
  - Auto-prune stale local temporary files.

- [ ] **Add disk budget guardrails for large fetches**
  - Preflight free-space checks before heavy fetch operations.
  - Abort early with actionable guidance when space is insufficient.

## P3 - Performance and Scale

- [ ] **Tune high-volume table indexes and vacuum strategy**
  - Focus on `chi_311`, `chi_violations`, `wow_indicatorhistory_monthly`.
  - Verify query plans for search/timeline paths.

- [ ] **Reduce full-table rebuild cost where possible**
  - Evaluate incremental materialization for history/summary tables.

## P3 - Governance and Product Decisions

- [ ] **Formalize source acceptance criteria**
  - Define standards for legal use, freshness, reliability, and reproducibility.

- [ ] **Define deprecation policy for permanently unavailable datasets**
  - Set clear rules for "missing by design" vs "temporary outage".

- [ ] **Define owner for each dataset family**
  - Single accountable maintainer for core, supplemental, and expansion pipelines.

## Next Suggested Execution Order

1. Complete full historical `chi_owners` backfill safely (disk-aware chunking).
2. Replace browser-local owner grouping with normalized owner entities.
3. Replace browser-local saved lists with backend persistence.
4. Replace NYC links and clean Chicago-facing UX inconsistencies.
5. Expose business linkage summaries via API/UI.
