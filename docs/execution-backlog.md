# Execution Backlog

Last validated: 2026-04-09

This backlog converts the current repo into a milestone-based execution plan. Each milestone separates current state, desired state, and required changes, and each task is labeled by work type.

## Current State

- The repo already serves Chicago parcel search, portfolio views, timeline data, CSV export, and supplemental signals.
- The largest blockers are historical owner coverage, minimal entity resolution, public admin coverage, and Chicago-vs-NYC product drift.
- The current API and UI are strong enough to support incremental delivery; this does not require a rewrite.

## Desired State

- A Chicago `PIN`-first platform for property research, owner intelligence, nearby-owner prospecting, seller-opportunity analysis, prospect lists, and compliant outreach workflows.

## Required Changes

## Recommended Build Order

1. Stabilize data coverage and operational visibility.
2. Introduce normalized owner/entity data structures.
3. Add owner-profile and nearby-owner APIs.
4. Add prospect-list and notes/status workflows.
5. Add admin controls and outreach workflow support.

## Milestones

### Milestone 1: Data Backbone And Coverage Control

Current state:

- `chi_owners` is only validated for 2025-2026.
- Core and supplemental loads have no unified audit trail.
- `/api/admin/data-coverage` is public.

Desired state:

- Historical owner depth is materially improved.
- All loaders record freshness and run metadata.
- Coverage can be reviewed safely by admins.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add disk-aware `chi_owners` backfill and refresh guidance | data, ops | none | Operator can fetch `latest`, bounded ranges, and a documented all-years flow without ambiguity |
| Extend `data_load_audit` coverage to core and supplemental loaders | data, backend | none | Every refresh writes dataset name, source ref, row count, status, and run id |
| Protect `/api/admin/data-coverage` | backend | none | Non-admin requests are rejected or require explicit token/auth |
| Add coverage smoke tests | backend, tests | protected endpoint behavior decided | Tests cover present, missing, partial, and missing-audit-table cases |

### Milestone 2: Owner Entity Resolution Layer

Current state:

- `wow_portfolios` groups on mailing name, `row_id`, or `pin` only.
- `wow_business_linkage_summary` exists but is not part of the product contract.

Desired state:

- Parcels, owner entities, aliases, mailing addresses, and business linkages are normalized and queryable.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add normalized owner/address/entity tables described in `docs/schema-plan.md` | data | Milestone 1 preferred | One parcel can be traced to raw owner rows, normalized owner entities, and confidence-scored linkage evidence |
| Materialize owner history by `pin` | data | owner backfill | API can show owner change history with provenance |
| Add debug/review queries for bad matches | data, ops | normalized tables | Operators can inspect why two parcels were or were not linked |
| Expose business-linkage summary API | backend | normalized entity layer | API returns scored supportive evidence with freshness metadata |

### Milestone 3: Chicago Product Surface Cleanup

Current state:

- Search and portfolio workflows exist.
- Frontend still shows NYC-only columns, links, and copy.

Desired state:

- The live UI reflects Chicago data and workflows only.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Replace NYC linkouts in `UsefulLinks.tsx` | frontend | none | Chicago pages no longer point to ACRIS, HPD, DOB, or DOF |
| Remove or hide NYC-only portfolio columns and labels | frontend | none | Chicago users do not see nonfunctional NYC fields in default flow |
| Make timeline explicitly `pin`-first | frontend, backend | none | Chicago UI never prefers `bbl` over `pin` |
| Rewrite methodology/help copy for Chicago | docs, frontend | none | Product help no longer describes HPD/ACRIS/rent-stabilization as current Chicago behavior |

### Milestone 4: Nearby-Owner And Prospecting Workflows

Current state:

- No nearby-owner search.
- No saved prospect lists.

Desired state:

- Users can discover nearby owners, filter candidates, and create exportable prospect lists.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add nearby-owner search tables/views | data | Milestone 2 | Search can return parcels and owners near a seed parcel with documented ranking inputs |
| Add nearby-owner API | backend | nearby-owner tables | API accepts `pin` plus radius/filter arguments and returns parcel, owner, and provenance fields |
| Add nearby-owner UI entry point from overview/portfolio | frontend | nearby-owner API | User can launch the flow without leaving the existing property context |
| Add prospect-list storage and export model | backend, data | nearby-owner API | Users can persist named lists and export current results |

### Milestone 5: Notes, Status, And Admin Workflows

Current state:

- No notes/status model.
- No admin UI for freshness or data-health review.

Desired state:

- Users can manage research status and admins can inspect freshness/coverage in-app.

Required changes:

| Task | Type | Dependencies | Acceptance criteria |
|---|---|---|---|
| Add prospect notes/status schema and API | backend, data | Milestone 4 | A prospect can store status, notes, and timestamps |
| Add admin freshness dashboard | frontend, backend | Milestone 1 | Admin can review data freshness, missing datasets, and partial-source reasons |
| Add export metadata and provenance fields | backend | Milestone 4 | Exports include source freshness and confidence context |

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Large `chi_311` and historical `chi_owners` fetches exhaust disk | Failed refreshes and partial loads | Enforce preflight disk checks and staged year-bounded loads |
| Address-based joins overcount or miss violations/311 | Bad signals in product and prospecting | Add canonical address normalization plus match-audit tables |
| Public admin coverage endpoint exposes internal operations data | Operational information leak | Add auth guard before building admin UI on top |
| NYC fields remain mixed into Chicago UX | User confusion and implementation drag | Make Chicago cleanup a discrete milestone before adding more UI surface |

## Highest-Priority Open Decisions

- What auth boundary should protect `/api/admin/data-coverage` and future admin routes?
- How much historical `chi_owners` depth is required for the first owner-history release?
- Should BOR detail and registered-taxpayer flows be sourced through official partnerships, or formally declared out of scope?
- Should prospect lists be user-authenticated only, or also support anonymous session export in MVP?
