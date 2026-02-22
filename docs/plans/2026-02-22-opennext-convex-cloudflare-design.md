# OpenNext + Convex + Cloudflare MVP Parity Design

**Date:** 2026-02-22  
**Status:** Approved

## Objective

Replace the current Django + CRA architecture with a unified Next.js application
deployed via OpenNext on Cloudflare, using Convex as the backend and database,
with MVP parity for core user workflows and reduced Chicago dataset coverage.

## Approved Decisions

1. Migration style: Big-bang rewrite.
2. Functional target: MVP parity (not strict full parity).
3. Auth strategy: Convex Auth.
4. Data scope: Reduced Chicago dataset for initial launch.

## Architecture

### Runtime

- Frontend + server rendering: Next.js (App Router).
- Deployment target: OpenNext adapter for Cloudflare Workers.
- Backend/business logic + persistence: Convex functions and tables.
- Edge delivery and caching: Cloudflare.

### Application Boundaries

- The Next.js app owns UI routing, rendering, client interactions, and API calls.
- Convex owns:
  - domain models,
  - query/mutation functions,
  - auth/session identity mapping,
  - reduced dataset storage and read paths.
- Legacy Django/SQL function execution paths are removed from MVP runtime.

## MVP Parity Scope

### Included

- Address search.
- Address/property detail view.
- Portfolio/owner-associated view equivalent for key organizing workflows.
- User authentication and session management via Convex Auth.

### Deferred

- Full long-tail endpoint parity.
- Full CSV export feature parity.
- Full indicator/history completeness from legacy data model.
- Legacy external auth compatibility behaviors.

## Data Design Strategy

### Dataset

- Import a reduced Chicago dataset containing only records required for MVP
  routes and aggregate views.

### Modeling

- Replace SQL function outputs with explicit Convex document shapes.
- Create denormalized read models for frequently queried views
  (search hit cards, property summary, portfolio summary).

### Performance

- Favor precomputed associations and index-first access patterns in Convex.
- Avoid runtime-heavy fan-out operations in request paths.

## Auth Design

- Use Convex Auth for identity and session handling.
- Implement login/register/session guards in Next.js route handlers and client.
- Provide route-level auth gating only where needed by MVP features.

## Delivery Plan

1. Platform bootstrap:
   - Next.js app scaffold in repository.
   - OpenNext Cloudflare deployment wiring.
   - Convex project initialization and environment setup.
2. Auth implementation:
   - Convex Auth setup and core flows.
3. Domain implementation:
   - Address search, address details, portfolio association equivalents.
4. Data pipeline:
   - Reduced dataset transform/import scripts.
   - Validation on representative fixtures.
5. Cutover:
   - Cloudflare production deployment.
   - DNS/frontend environment updates.
6. Stabilization:
   - E2E smoke tests and observability baseline.
   - Track deferred parity backlog.

## Risks and Mitigations

1. Legacy SQL logic complexity may be hard to replicate quickly.  
   Mitigation: formal schema/output mapping docs and test fixtures for each core flow.
2. Data volume/performance mismatch in Convex if modeled too relationally.  
   Mitigation: precompute read models and benchmark query latency early.
3. Big-bang cutover risk.  
   Mitigation: production-like staging with real reduced dataset and scripted smoke tests.

## Success Criteria

1. Users can search a Chicago address and load core property details.
2. Users can navigate owner/portfolio associations for organizing workflows.
3. Authenticated flows in MVP complete with Convex Auth.
4. App is deployed and served from Cloudflare via OpenNext + Convex backend.
