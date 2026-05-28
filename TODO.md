# TODO: Data, API, UI, and Ops Backlog

Last updated: 2026-05-25

This is the open-work list after rechecking the current repository on
2026-05-25, including the merged `claude/*` branches and recent Find Owners /
PropStream export work.

## Recently Completed / No Longer Waiting

- [x] **Tighten CORS for API responses**
  - `wow/apiutil.py` now echoes only configured allowed origins and sets
    credentials headers only for allowed origins.

- [x] **Add public endpoint rate limiting**
  - `django-ratelimit` is configured in `project/settings.py`.
  - Public parcel, owner, contact, export, and PropStream upload endpoints now
    have per-IP throttles.

- [x] **Move contact endpoints out of `wow/views.py`**
  - Contact/entity endpoints now live in `wow/views_entity.py`.
  - `wow/urls.py` routes `entity/*`, `parcel/entities`, and
    `admin/contact-coverage` there.

- [x] **Use PostGIS for radius queries**
  - `wow_parcels.geog` is built in `sql/create_parcels_table.sql`.
  - `wow/sql/address_nearby.sql` and `wow/sql/owner_search_by_area.sql` use
    `ST_DWithin` / `ST_Distance`.

- [x] **Add no-APN PropStream export for Find Owners**
  - `client/src/containers/FindOwnersPage.tsx` exports a PropStream-ready CSV.
  - `wow/sql/owner_search_by_area.sql` returns parcel city/state/zip for that
    export.

- [x] **Add address-friendly nearby-owner CLI wrapper**
  - `find_nearby.py` can read `DATABASE_URL` from `.env`, rewrite Docker host
    names for host execution, and accept positional address text.
  - `findn` wraps common nearby-search usage.

## P0 - Data Coverage Blockers

- [ ] **Backfill full `chi_owners` historical depth**
  - Still needed. `docs/data-roadmap.md` and `docs/data-catalog.md` still
    describe validated coverage as 2025-2026 only.
  - `scripts/fetch_chi_data.py --chi-owners-years` supports `latest`, `all`,
    single-year, and bounded-range modes, but the full backfill and verification
    run are not complete.
  - Add per-year load verification and owner-history depth metrics by run.

- [x] **Replace or deprecate missing Registered Chicago Taxpayer source**
  - Deprecated after a 2026-05-25 source recheck. The legacy taxpayer search
    still returns 404, and current Chicago finance pages are informational tax
    pages rather than a replacement registered-taxpayer dataset.
  - `/api/admin/data-coverage` now reports
    `source_deprecated_no_replacement`.

- [x] **Unblock BOR detail-level ingest or document it as blocked**
  - Documented as blocked/sample-only after a 2026-05-25 source recheck. Public
    BOR pages expose form search but no bulk/export endpoint.
  - Product docs now say BOR detail should stay sample/admin-only unless
    official bulk or approved targeted access is obtained.

## P1 - Core Pipeline and Data Modeling

- [ ] **Stabilize contact-data backfills before broad live deploys**
  - Still needed. Contact endpoints and rate limiting are in place, but backfill
    operations still need operational hardening.
  - Split deploys from expensive backfills.
  - Move high-volume extraction work toward resumable, auditable chunks.
  - Avoid `contact_audit_log` write amplification during automated bulk loads;
    keep audit logging for manual/admin changes.
  - Add pre-deploy SQL checks and endpoint smoke tests around contact tables.

- [ ] **Add contact-role semantics to contact data**
  - Still needed. `entity_contacts` stores `contact_type`, but source docs still
    call for roles such as `direct_owner`, `registered_agent`,
    `principal_office`, `attorney_tax_rep`, and `operator_business`.
  - Add role/evidence storage without overloading phone/email/address type.

- [ ] **Automate `chi_owners` historical maintenance**
  - Still needed.
  - Add incremental append/update mode that preserves older years.
  - Avoid destructive reloads when only the latest year changes.
  - Persist core run metadata in `data_load_audit` or equivalent.

- [ ] **Harden address-to-PIN matching quality for indicators**
  - Still needed. Violations/311 joins still depend on normalized address
    strings.
  - Add QA checks for false positive/false negative join rates.
  - Track unmatched records and source schema drift.

- [ ] **Review and rationalize `chi_geographies` usage**
  - Still needed. `who-owns-what.yml` still depends on `chi_geographies`, while
    current IHS runtime SQL uses `chi_parcels.chicago_community_area_name`.
  - `sql/create_ihs_integration.sql` still contains the stale
    `chi_geographies.pin10` join path.
  - Decide whether `chi_geographies` remains required or can be removed from
    runtime dependencies.

- [ ] **Complete Illinois SOS ingestion path**
  - Still needed. `scripts/extract_sos_contacts.py` exists, but docs still
    identify official bulk ZIP acquisition/staging as the blocker.
  - Establish the operator workflow for obtaining official files.
  - Replace placeholder-oriented staging with profiled/auditable raw schemas.
  - Link SOS entities back to parcel-linked owners with confidence evidence.

- [x] **Fix PropStream upload schema lifecycle and auth**
  - `propstream_upload` now requires `Authorization: Token $ADMIN_API_TOKEN`.
  - `propstream_parcel_records` creation moved to
    `sql/create_propstream_tables.sql` and `who-owns-what.yml`.
  - Smoke tests cover unauthorized upload rejection and verify request-path DDL
    is not invoked.

## P1 - Expansion Datasets

- [ ] **Promote BOR search ingestion from sample to production-grade**
  - Still needed. `bor_search_results` is documented as a small sample.
  - Add dedupe keys, crawl/run metadata, coverage reporting, and refresh
    cadence if BOR remains in scope.

- [ ] **Extract Woodstock row-level mortgage data**
  - Still needed. Docs still say `woodstock_mortgage_metadata` is metadata-only.
  - Design normalized fact schema and validate against workbook totals.

- [ ] **Add idempotent run IDs + audit for all loaders**
  - Still needed. Expansion loaders have some audit behavior; core and
    supplemental flows should match.
  - Include source hash/file size and row-count deltas in audit details.

- [ ] **Promote Foreclosed Rental Property contacts beyond targeted loader**
  - Partially done. `chi_foreclosed_rental_properties` is in
    `who-owns-what.yml`, and `scripts/extract_foreclosed_rental_contacts.py`
    exists.
  - Still needed: coverage reporting, confidence/role handling, and product
    messaging that this is a foreclosure-subset source rather than citywide
    landlord coverage.

## P1 - API/Product Surface Gaps

- [x] **Add admin UI for data/contact coverage**
  - Added `/admin/coverage`, backed by a session-stored admin token.
  - The page consumes `/api/admin/data-coverage` and
    `/api/admin/contact-coverage`.
  - Shows missing/partial reason codes, source freshness, last load times,
    contact totals, source breakdowns, and not-initialized contact states.

- [x] **Expose business linkage summaries via API/UI**
  - Added `GET /api/business-linkage?pin=` for summary and match rows.
  - Property pages now show a Business linkages panel with match evidence,
    scores, ambiguity, empty, loading, and degraded states.

- [ ] **Upgrade owner profile to normalized owner entities**
  - Still needed. `/api/owner/current` and `OwnerPage` still group by current
    `owner_id` / exact `owner_name`.
  - Replace current-row grouping with canonical owner entities, aliases, and
    evidence.

- [ ] **Upgrade nearby-owner workflow to owner intelligence**
  - Still needed. Nearby search is faster now via PostGIS and Find Owners has a
    better export, but ranking/filtering still relies on current `wow_parcels`
    grouping.
  - Add entity/contact evidence, business-linkage support, and owner-level
    pivots.

- [ ] **Replace browser-local saved lists with backend persistence**
  - Still needed. `client/src/util/savedNearbyLists.ts` still uses
    `window.localStorage`.
  - Add named lists, server-side persistence, and auth boundary decisions.

- [ ] **Decide BOR/Woodstock product endpoints**
  - Still needed. Decide whether these are user-facing, admin-only, or
    analytics-only before adding API contracts.

## P1 - Chicago UX/Data Correctness Issues

- [x] **Replace NYC-specific external links in `UsefulLinks`**
  - Chicago PIN flows now show Cook County Assessor, Cook County Property Tax,
    CookViewer, Chicago building permit, and Google Maps links.
  - Legacy NYC links remain only as a fallback when there is no Chicago PIN.

- [ ] **Audit legacy NYC fields and copy still shown in Chicago UI**
  - Partially done. Search results and portfolio tables no longer show core
    NYC-only columns, Chicago links now prefer PIN/Cook County flows, and the
    Chicago summary tab no longer renders eviction or rent-stabilization panels.
  - Still needed: generated locale catalogs and legacy-mode components still
    contain NYC-era strings for HPD, ACRIS, DOB, rent stabilization, NYCHA, and
    eviction datasets.
  - Decide whether legacy NYC timeline datasets should remain hidden entirely
    in Chicago builds or stay available only when backend `schema: "nyc"` is
    returned.

- [x] **Clarify timeline mode behavior (`pin` vs `bbl`)**
  - Frontend timeline calls now always use `indicatorhistory?pin=` for Chicago
    property flows.
  - `indicatorhistory?bbl=` remains backend legacy support only.

## P2 - Testing Coverage Gaps

- [x] **Fix legacy backend test harness drift**
  - Added legacy OCA config keys expected by `wow/tests/conftest.py`.
  - Smoke tests now stub PropStream/contact enrichment instead of touching DB.
  - Server-error content-type assertion now accepts Django's charset suffix.
  - Verified `wow/tests/test_milestone1.py` and `wow/tests/test_views.py::TestServerError`.

- [ ] **Expand backend tests for map/owner/contact endpoints**
  - Still needed. Existing smoke coverage does not fully cover bounds
    validation, distance ordering, owner lookup edge cases, degraded-mode
    behavior, or moved contact endpoints in `wow/views_entity.py`.

- [x] **Add tests for `scripts/fetch_chi_data.py --chi-owners-years`**
  - Added tests for `latest`, `all`, single year, bounded range, and invalid
    range/value behavior.

- [ ] **Add tests for loader audit behavior**
  - Still needed. Cover `scripts/load_source_expansion.py` and supplemental/core
    loaders for success, skip states, row counts, and run metadata.

- [ ] **Add integration tests for IHS timeline enrichment**
  - Still needed. Verify IHS columns appear in Chicago indicator history and
    fallback behavior works when IHS tables are missing.

## P2 - Data Quality, Monitoring, and Alerting

- [ ] **Add data quality assertions to CI/release checks**
  - Expected nonzero rows for mandatory tables.
  - Year-range sanity checks for `chi_owners` and `ihs_indicators`.
  - Null-rate thresholds on key join fields.

- [ ] **Add drift/anomaly alerts**
  - Alert on abrupt row-count drops/spikes.
  - Alert on owner-depth regressions.
  - Alert on stale load timestamps.

- [ ] **Create reproducible data snapshot manifests for every load run**
  - Include source URLs, timestamps, checksums, row counts, and loader versions.

## P2 - Documentation Consistency

- [ ] **Keep product/data docs aligned with implementation**
  - Still needed. Several docs still describe pre-merge state or future product
    surfaces.
  - Keep `README.md`, `docs/data-catalog.md`, `docs/api-roadmap.md`,
    `docs/product-workflows.md`, and `docs/technical-architecture.md` aligned as
    owner normalization, contact roles, saved-list persistence, and admin UI
    evolve.

- [ ] **Retire or fix stale SQL artifacts not used in runtime path**
  - Still needed. `sql/create_ihs_integration.sql` still conflicts with the
    current working IHS runtime query.
  - Clearly mark experimental vs production SQL.

## P2 - Storage and Backup Automation

- [ ] **Automate DB backups directly to `/backup-pool/dump/wow-backups`**
  - Still needed. Add scheduled backup job with retention policy and regular
    restore drills.

- [ ] **Automate staging archive lifecycle**
  - Still needed. Archive staging snapshots to backup pool and auto-prune stale
    temporary files.

- [ ] **Add disk budget guardrails for large fetches**
  - Still needed. `fetch_chi_data.py` warns for large owner ranges, but fetches
    still need hard free-space preflight checks and actionable abort messages.

## P3 - Performance and Scale

- [ ] **Tune high-volume table indexes and vacuum strategy**
  - Focus on `chi_311`, `chi_violations`, `wow_indicatorhistory_monthly`, and
    any new contact/entity tables after backfills.

- [ ] **Reduce full-table rebuild cost where possible**
  - Evaluate incremental materialization for history/summary tables.

## P3 - Governance and Product Decisions

- [ ] **Formalize source acceptance criteria**
  - Define standards for legal use, freshness, reliability, and reproducibility.

- [ ] **Define deprecation policy for permanently unavailable datasets**
  - Set clear rules for "missing by design" vs "temporary outage".

- [ ] **Define owner for each dataset family**
  - Single accountable maintainer for core, supplemental, expansion, and contact
    pipelines.

## Next Suggested Execution Order

1. Fix the legacy backend test harness so broader test runs are meaningful.
2. Complete a bounded historical `chi_owners` backfill with disk checks and
   audit reporting.
3. Add contact-role semantics and finish the Illinois SOS staging workflow.
4. Replace NYC links/copy in Chicago-facing UI.
5. Move saved lists and owner intelligence from local/current-row grouping to
   backend persisted canonical owner entities.
