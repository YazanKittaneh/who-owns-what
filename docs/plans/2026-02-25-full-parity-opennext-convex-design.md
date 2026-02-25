# Full Parity OpenNext + Convex Migration Design

**Date:** 2026-02-25

## Goal
Deliver user-facing parity with the legacy Django + CRA Who Owns What app in the OpenNext + Convex + Cloudflare stack, including localized (`/en`, `/es`) and legacy (`/legacy`) routes, while allowing internal API modernization.

## Scope Decisions
- Include locale-prefixed routes now (`/en`, `/es`).
- Include legacy route aliases now (`/legacy/...`).
- Prioritize UI/behavior parity; backend API responses may differ internally as long as UI behavior matches.
- Continue using Cloudflare Worker (OpenNext) + Convex as primary runtime.

## Architecture
### Frontend runtime
- `apps/web` remains the canonical frontend app (Next.js App Router + OpenNext deploy target).
- Cloudflare Worker serves all UI routes and API route handlers.

### Data and domain backend
- Convex remains the primary data source for address/portfolio/auth-backed features.
- A parity adapter layer converts Convex/domain records into page-specific view models (especially for address tabs and timeline datasets).

### Route parity layer
- Introduce route helpers mirroring legacy route semantics (modern + locale + legacy aliases).
- Add Next route aliases and redirects for:
  - `/legacy/*`
  - `/en/*`, `/es/*`
  - legacy tabs and deep links (portfolio/timeline/summary)
  - legacy special paths (e.g. `/wowza` redirect)
- Keep one canonical route generator used by links and tests.

### Content and static pages
- Port content pages (about, how-to-use, methodology, terms, privacy) into Next pages.
- Reuse existing content assets/data where practical to avoid copy drift.

### Address page parity
- Expand current address page into tabbed experience:
  - Overview
  - Portfolio
  - Timeline (optional indicator suffix)
  - Summary
- Add timeline data shaping compatible with legacy dataset selection behavior.

### Account parity
- Preserve auth UX outcomes with Convex auth backend:
  - login
  - account settings (email settings)
  - verify email
  - forgot password / reset password
  - unsubscribe page
- Protected routes redirect to localized login route.

## Compatibility and Error Handling
- Legacy and localized aliases should resolve without breaking deep links.
- For unavailable datasets/features (especially legacy NYC-only behavior), show clear “not available in this deployment” states instead of hard failures.
- Keep explicit `503` only for true backend misconfiguration (missing Convex URL, unreachable Convex when fallback disabled).
- Add structured server logs for alias redirects, missing dataset branches, and auth callback failures.

## Testing Strategy
- Extend Playwright smoke suite with parity route matrix:
  - canonical modern routes
  - locale-prefixed routes
  - legacy aliases
- Add unit tests for route generation and timeline dataset shaping.
- Maintain `npm run validate` as the primary local/CI gate.

## Rollout Plan
- Vertical slices with frequent commits and live deploys.
- Prioritize route/static page parity first, then address tabs/timeline parity, then account flow parity details.
- Keep worker continuously deployable after each slice.

## Definition of Done (Parity Phase)
- Legacy user-facing routes resolve in Next app, including locale + legacy aliases.
- Address tabs (overview/portfolio/timeline/summary) work with Convex-backed data.
- Account pages and key flows are functional.
- Static informational pages exist and route correctly.
- Existing MVP smoke tests plus parity smoke tests pass.
