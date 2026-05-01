# Public Landlord Contact Ingestion Backlog (Chicago)

Last updated: 2026-04-12

This backlog converts the public-source brainstorm into a source-by-source implementation sequence for the current repo.

Companion doc:

- `docs/public-landlord-contact-sources.md`
- `docs/chicago-socrata-contact-candidates.md`

## Current Validated State

- `wow_parcels` already carries parcel-linked owner and mailing fields from the latest owner row, including `owner_name`, `mailing_address`, `mailing_city`, `mailing_state`, and `mailing_zip`.
- `entity_contacts` already supports `phone`, `email`, `mailing_address`, and `website`, with provenance, confidence, and verification metadata.
- Chicago business license and business owner ingestion is implemented.
- Illinois SOS extraction code exists, but the repo still depends on acquiring the official bulk files.
- Recorder raw data is loaded, but the currently staged recorder file is oriented toward document summary and does not yet validate full party-name or return-address extraction.
- BOR is present only as a small sampled search-results dataset, not a comprehensive countywide or detail-level source.

## Goal

Build a public-data workflow that yields:

1. direct owner mailing contacts
2. official business-entity contacts for LLC and corporate owners
3. clearly labeled proxy contacts for management, legal, and operations workflows
4. a clean handoff into manual phone and email verification

## Principles

- Keep direct owner contacts separate from proxy contacts.
- Prefer official government sources over aggregators.
- Preserve source provenance and confidence on every inserted contact.
- Treat business-license, appeal, court, and permit-linked contacts as supporting evidence unless ownership is corroborated.
- Do not expand contact types blindly; first add the minimum metadata needed to distinguish contact role from contact value.

## Foundational Work Before More Sources

| Task | Why it is needed | Type | Acceptance criteria |
|---|---|---|---|
| Add a contact-role layer to `entity_contacts` or adjacent evidence storage | Current schema stores `contact_type` but not whether a mailing address belongs to an owner, registered agent, principal office, attorney, or operator | data, backend | Contact records can distinguish `direct_owner`, `registered_agent`, `principal_office`, `attorney_tax_rep`, and `operator_business` without overloading `contact_type` |
| Define freshness and staleness policy by source family | Mailing addresses, SOS records, and court proxies age differently | data, ops | Source-specific stale windows are documented and reflected in confidence or review logic |
| Add review-safe evidence JSON conventions | Several sources will produce contact-adjacent evidence rather than clean owner contacts | data | `match_evidence` consistently stores join keys, match method, source identifiers, and why the contact is considered direct or proxy |
| Add source coverage metrics for contact workflows | The repo has source-load visibility, but not yet a landlord-contact coverage view by source and role | backend, data | Admin can see entity and parcel coverage split by source and contact role |

## Recommended Build Order

1. Formalize parcel-owner mailing ingestion from `wow_parcels`.
2. Finish Illinois SOS bulk ingestion.
3. Add the targeted `Foreclosed Rental Property` source for direct phone and email in the foreclosure subset.
4. Tighten and extend Chicago business-license and business-owner linkage.
5. Decide whether richer recorder raw data is obtainable; if yes, add recorder contact extraction.
6. Add targeted proxy pipelines for BOR, PTAB, courts, and building systems.
7. Leave aggregators and web/manual research as secondary corroboration and verification layers.

## Concrete Loader Specs

| Dataset | Socrata ID | Fetch path | Raw table | Contact loader | Primary join key | Initial contact roles |
|---|---|---|---|---|---|---|
| Foreclosed Rental Property | `yhcw-iu53` | `data/chi_foreclosed_rental_properties.csv` via `scripts/fetch_chi_data.py` | `chi_foreclosed_rental_properties` | `scripts/extract_foreclosed_rental_contacts.py` -> `load_foreclosed_rental_contacts()` | exact normalized property address to `wow_parcels.address` | `direct_owner`, `property_manager` |
| Business Licenses | `r5kz-chrr` | staged supplemental CSV | `chi_business_licenses` | `scripts/extract_business_license_contacts.py` -> `load_business_license_contacts()` | business address to parcel address, business name to owner name | `operator_business` |
| Business Owners | `ezma-pppn` | staged supplemental CSV | `chi_business_owners` | consumed through business-license linkage | `account_number`, legal name | `entity_officer` |
| Building Permits | `ydr8-5enu` | `data/chi_permits.csv` via `scripts/fetch_chi_data.py` | `chi_permits` | `scripts/extract_building_permit_contacts.py` -> `load_building_permit_contacts()` | `pin_list`, normalized street address | `property_manager`, `operator_business`, `direct_owner` candidate |
| Ordinance Violations (Buildings) | `awqx-tuwv` | new targeted fetch if added | planned `chi_ordinance_violations_buildings` | planned | normalized address | `operator_business`, respondent proxy |
| Vacant and Abandoned Buildings - Violations | `kc9i-wq85` | new targeted fetch if added | planned `chi_vacant_building_violations` | planned | normalized address | vacant-property proxy |
| Building Code Scofflaw List - Current Records | `rz4d-qp2m` | new targeted fetch if added | planned `chi_building_code_scofflaw_current` | planned | normalized address, owner name | litigation proxy |

## Source-By-Source Backlog

### P0: Parcel Owner Mailing Contacts (`wow_parcels`)

Current state:

- `wow_parcels` already contains owner and mailing fields.
- Nearby-owner export code already emits `wow_parcels_owner_record` mailing contacts.
- The contact system is not yet explicitly documented as ingesting this parcel-owner mailing layer into canonical contact tables as the primary direct contact source.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add a parcel-owner mailing ingestion path from `wow_parcels` into `canonical_entities`, `entity_contacts`, and `entity_parcel_mappings` | data, backend | foundational contact-role work preferred | Parcels with owner name plus mailing address produce a direct-owner mailing contact with strong confidence and parcel mapping |
| Add dedupe rules for owner-name and mailing-address variants | data | same task | Repeated mailing-address variants collapse cleanly without dropping provenance |
| Make this source the default direct contact baseline in docs and coverage reporting | docs, backend | ingest path | Contact coverage can distinguish direct parcel-owner mailing coverage from all other sources |

Notes:

- This is the highest-value direct public contact layer and should be considered the baseline, not a fallback.

### P0: Illinois SOS Bulk Records

Current state:

- `scripts/extract_sos_contacts.py` exists.
- `il_sos_*` tables still appear in docs and schema as incomplete or placeholder-oriented.
- Official bulk download retrieval remains the main operational blocker.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Establish a reliable operator workflow to obtain and stage official SOS bulk ZIPs | ops, docs | none | Runbook documents how bulk files are obtained and staged when automated download is blocked |
| Replace placeholder raw tables with profiled raw schemas or documented normalized staging tables | data | bulk files available | Loaded corp and LLC master, agent, and if possible manager or old-name rows are queryable and auditable |
| Extend extraction beyond principal address and agent records where source files allow it | data, backend | staged raw SOS data | Canonical entities can store official file number, principal office, registered agent, and manager or officer evidence |
| Link matched SOS entities back to parcel-linked owners with explicit confidence | data | extraction path | LLC and corp parcel owners gain official business-contact paths with provenance |

Notes:

- This is the highest-value public source for LLC and corporate landlords.
- If official bulk files remain operationally blocked, the repo should document a manual browser-download path rather than leaving the source half-implemented.

### P1: Chicago Business Licenses + Business Owners

Current state:

- Raw datasets load through `scripts/load_supplemental_data.py`.
- Business-linkage SQL exists.
- Business-license contact extraction is implemented.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add explicit contact-role labeling for business-license-derived addresses and owner-name evidence | data, backend | foundational contact-role work | Downstream views can distinguish operator-business and officer-name evidence from direct owner contacts |
| Tighten parcel-to-business linkage QA using ambiguity thresholds already present in `wow_business_linkage_matches` | data, tests | existing summary tables | False positives from common legal names and shared commercial suites are reduced and measurable |
| Promote account-number and owner-title evidence into reviewable entity evidence, not just loose contact rows | data, backend | existing loaders | Operators can inspect why a person or business was linked to a parcel owner |

Notes:

- This source should remain supportive and high-utility, but should not be marketed as proof of ownership by itself.

### P1: Foreclosed Rental Property

Current state:

- City Socrata dataset `yhcw-iu53` includes owner and agent address fields plus populated phone and email fields for the foreclosure-registration subset.
- This dataset is not yet represented in the repo backlog or contact strategy docs.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add a loader for `yhcw-iu53` with normalized address and owner/agent fields | data | none | Foreclosed rental records are staged in Postgres with source metadata and load audit coverage |
| Map owner, management-agent, and notices-agent fields into canonical entities and contact records | data, backend | loader | Phone, email, and mailing-address records retain role and source provenance |
| Restrict product messaging and confidence logic to the foreclosure subset | backend, docs | ingest path | UI and API make it clear that this is a targeted source, not citywide landlord coverage |

Notes:

- This is the strongest City of Chicago Socrata source found for actual phone and email fields.
- It should be treated as a high-value targeted workflow, not as a general landlord registry.

### P1: Recorder Contact Extraction

Current state:

- `chi_recorder_documents` and `wow_recorder_summary` are loaded.
- The current staged recorder file supports summary analytics.
- The currently validated raw columns do not yet prove that party names, return addresses, or attorney data are available in the existing staged file.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Profile the existing recorder raw file for party-name and return-address coverage | data | none | A short field inventory determines whether the current file can support contact extraction at all |
| If current raw data is insufficient, identify a richer recorder source and staging approach | data, ops | field inventory | Repo has a documented decision: richer source added, or recorder stays summary-only |
| Add recorder-derived contact extraction only if the source contains usable party or return-address fields | data, backend | richer recorder data if needed | Extracted recorder contacts preserve document type, document number, and direct vs proxy role |

Notes:

- Recorder is high-value in theory, but the present repo dataset may not yet contain the fields needed for real contact extraction.

### P2: BOR / PTAB Appeal Contacts

Current state:

- `bor_search_results` exists only as a small sample.
- BOR detail-level flow is already documented as captcha-limited.
- PTAB is not currently ingested.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Decide whether BOR remains sample-only, gets a compliant targeted workflow, or is deferred | data, ops | none | Repo documents a clear scope decision instead of implying broad automated coverage |
| If targeted BOR ingestion is approved, capture appellant, attorney, and complaint metadata for matched parcels only | data, backend | scope decision | High-priority parcels can show tax-rep proxy evidence with source identifiers |
| Add PTAB as a manual or targeted secondary appeal source if public access is practical | data, ops | after BOR decision | PTAB evidence is documented as targeted support, not assumed countywide coverage |

Notes:

- These are good proxy-contact sources for active investors, but not general baseline datasets.

### P2: Courts And Litigation Contacts

Current state:

- No validated automated court-ingestion path is present in the repo.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Decide whether court data should be manual review only or support a targeted ingestion path | ops, docs | none | Scope is explicit and compliant |
| If targeted ingestion is adopted, store attorney and party evidence as proxy contacts tied to case number and source URL | data, backend | scope decision | Litigation-derived contacts can be reviewed without being mistaken for owner contacts |

Notes:

- This is useful for foreclosure, eviction, chancery, and building cases, but should not be treated as a general-purpose base layer.

### P2: Permits, Violations, And VBR

Current state:

- `chi_permits` and `chi_violations` already support property-level indicators and counts.
- City Socrata `Building Permits` exposes multiple typed contact-name slots and now has a SQL-first contact-adjacent ingestion path in the repo.
- The repo does not yet validate a contact-extraction workflow from `chi_violations`.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add QA checks for permit contact-role quality and owner-vs-operator false positives | data, tests | existing permit loader | Permit-linked entities can be sampled and reviewed by role without conflating contractors with owners |
| Keep these sources as activity-only if contact fields are weak or absent | data, docs | field audit | Docs stop implying a contact path that the current datasets do not support |
| If contact-capable fields exist, add only proxy-contact ingestion with conservative confidence | data, backend | positive field audit | Permit or violation contacts are labeled as operator or respondent evidence, not direct-owner evidence |

Notes:

- These systems are more likely to be recency and operations signals than broad contact sources.
- `Building Permits` is more promising than generic violations because it carries typed contact names and `pin_list`.

### P3: Aggregators And Manual Verification

Current state:

- `docs/contact-data-strategies.md` already expects manual or commercial phone and email enrichment.
- Nearby-owner export templates already reference `Bizapedia` and `OpenCorporates` for manual research.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add a documented manual research QA rubric for public aggregator use | docs, ops | none | Reviewers know when an aggregator result can be used only as corroboration versus a loadable contact |
| Keep aggregator-sourced contacts below official-source confidence unless manually verified | data, backend | existing contact schema | Aggregator-only rows do not outrank official mailing or SOS contacts |
| Add a targeted import path for manually verified phone and email tied to canonical entity IDs | backend, data | existing import script | Verified phone and email can be loaded without losing source notes and reviewer attribution |

## Suggested Milestones

### Milestone 1: Baseline Direct Contact Coverage

- Parcel-owner mailing ingestion from `wow_parcels`
- Contact-role metadata
- Coverage reporting split by direct vs proxy contacts

### Milestone 2: Business Entity Contact Backbone

- Illinois SOS bulk staging and extraction
- Foreclosed rental targeted ingest
- Business-license and business-owner QA improvements
- Better entity evidence inspection

### Milestone 3: Selective Proxy Workflows

- Recorder decision and possible extraction path
- BOR and PTAB targeted workflow
- Court and building-system scope decisions

### Milestone 4: Verification Layer

- Manual QA rubric
- Manual verified phone and email imports
- Review queue and stale-contact handling by source family

## Highest-Priority Open Decisions

- Should `entity_contacts` gain a first-class `contact_role` field, or should role live in `match_evidence` plus derived views?
- Can Illinois SOS bulk files be staged reliably enough to treat SOS as part of the standard refresh sequence?
- Does the current recorder raw file contain enough detail for contact extraction, or should recorder remain summary-only until a richer feed is found?
- Should BOR, PTAB, courts, and VBR be targeted premium workflows rather than broad baseline ingestion?
