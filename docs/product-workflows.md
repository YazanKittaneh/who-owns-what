# Product Workflows

Last validated: 2026-04-09

## Current State

- The current Chicago workflow is now centered on two primary pages:
  - `client/src/containers/HomePage.tsx` as a map-first landing page
  - `client/src/containers/PropertyPage.tsx` as the dedicated `/pin/:pin` property profile page
- `client/src/containers/AddressPage.tsx` still powers the deeper legacy subroutes for portfolio, timeline, and summary.
- Search is `pin`-driven and the home map loads parcels by viewport.
- A first-pass owner profile page, nearby-owner widget, and browser-local saved-lists page now exist.
- Notes/status, shared/server-side prospect lists, and normalized owner-entity workflows do not yet exist.

## Desired State

- The product should support property research, owner intelligence, nearby-owner prospecting, prospect-list creation, compliant outreach preparation, and admin freshness review.

## Required Changes

### Property profile workflow

Current state:

- Search -> property/portfolio details is implemented.
- Home-page map -> property modal -> property page is implemented.
- Property page now combines current property details, portfolio map/list context, nearby-owner results, and timeline access.

Desired state:

- A property profile should show parcel details, current owner evidence, historical owner changes, timeline signals, recorder/tax-sale context, and freshness.

Required changes:

- Add explicit provenance/freshness UI.
- Add owner-history and business-linkage panels.
- Decide whether to retire the remaining tabbed `AddressPage` routes or keep them as advanced subviews.

### Owner profile workflow

Current state:

- `client/src/containers/OwnerPage.tsx` now exists and is keyed by current `owner_id` or exact `owner_name` fallback.

Desired state:

- A user can pivot from a parcel to a normalized owner entity and see associated parcels, aliases, mailing addresses, and supporting business evidence.

Required changes:

- Keep the current owner profile as a lightweight current-row view.
- Upgrade it to normalized owner entities with aliases, evidence, and business linkage.

### Nearby-owner prospecting workflow

Current state:

- `client/src/components/NearbyOwners.tsx` now provides a first-pass nearby-owner workflow on the property page.
- It supports radius toggles, owner-grouped and parcel-grouped views, CSV export, and save actions.

Desired state:

- A user can start from one `pin`, search nearby parcels within a configurable area, and filter for owner and signal patterns.

Required changes:

- Replace current `wow_parcels` row grouping with normalized owner entities.
- Add filters for radius, tax-sale history, recorder activity, owner overlap, and business linkage.
- Add saved-search persistence and stronger owner-level ranking.

### Prospect-list creation workflow

Current state:

- Users can save nearby owner groups and nearby parcels locally in the browser.
- `client/src/containers/SavedListsPage.tsx` exposes those saved items and CSV export.

Desired state:

- Users can create named lists from filtered portfolio or nearby-owner results and save list membership.

Required changes:

- Replace browser-local storage with backend persistence and named lists.
- Reuse filtered result sets from `PropertiesList.tsx` and owner/nearby workflows.
- Add list detail page, list export, and list status fields.

### Export workflow

Current state:

- `GET /api/address/export?pin=` exports associated parcel rows.
- Nearby-owner widget and saved-lists page now support browser-side CSV export.

Desired state:

- Exports support property portfolios and prospect lists, and include provenance/freshness fields.

Required changes:

- Keep current export for base parcel research.
- Keep current browser-side export for nearby owners/parcels and saved lists.
- Add server-side prospect-list export and owner-profile export formats with provenance.

### Notes and status workflow

Current state:

- No stored notes or statuses.

Desired state:

- Users can mark prospects with statuses like `researching`, `ready_to_contact`, `hold`, and `closed`, and attach notes.

Required changes:

- Add authenticated notes/status APIs and tables.
- Add lightweight list-side editing in the frontend.

### Admin and freshness workflow

Current state:

- Freshness is available only through `/api/admin/data-coverage`.

Desired state:

- Admins can inspect source freshness, missing sources, partial coverage, and load failures in-app.

Required changes:

- Keep the coverage endpoint protected.
- Add an admin-facing React view for coverage and audit rows.

## MVP Vs Later

### MVP

- Chicago-first property profile cleanup
- owner profile summary
- nearby-owner search
- browser-local save/export workflow
- admin freshness panel

### Later

- richer seller-opportunity scoring with Woodstock and BOR detail
- collaborative workflows and assignments
- outreach activity tracking across lists
- optional consent-based manual enrichment tools

## Chicago UX Corrections Required Before Expansion

- Replace NYC-only links in `client/src/components/UsefulLinks.tsx`.
- Remove or isolate NYC-only fields in `client/src/components/PortfolioTable.tsx`.
- Rewrite NYC-specific filter/help copy in `client/src/components/PortfolioFilters.tsx` and content JSON files.
- Make `client/src/components/APIClient.ts` timeline requests use `pin` only for Chicago flows.
