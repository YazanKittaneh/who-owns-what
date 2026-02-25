# Full Parity OpenNext + Convex Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver full user-facing parity for the legacy Who Owns What app in `apps/web`, including locale and legacy route compatibility, using OpenNext + Convex on Cloudflare.

**Architecture:** Build parity in vertical slices inside the existing Next.js App Router app. Add a route compatibility layer (locale + legacy aliases), then port page surfaces and address tab behaviors using Convex-backed adapters rather than strict legacy API parity.

**Tech Stack:** Next.js App Router, TypeScript, OpenNext (Cloudflare), Convex, Playwright, ESLint

---

### Task 1: Route parity foundation (helpers + locale/legacy aliases)

**Files:**
- Create: `apps/web/src/lib/routes.ts`
- Create: `apps/web/src/app/[locale]/(site)/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/search/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/address/[pin]/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/portfolio/[portfolioId]/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/login/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/register/page.tsx`
- Create: `apps/web/src/app/[locale]/(site)/account/page.tsx`
- Create: `apps/web/src/app/[locale]/layout.tsx`
- Create: `apps/web/src/app/[locale]/not-found.tsx`
- Create: `apps/web/src/app/legacy/[...slug]/page.tsx`
- Test: `apps/web/e2e/route-aliases.spec.ts`

**Steps:**
1. Add route helper utilities and locale validation (`en`, `es`).
2. Add locale wrappers reusing current page implementations.
3. Add legacy alias catch-all mapping to modern pages/redirects.
4. Add Playwright smoke checks for `/en`, `/es`, and `/legacy` aliases.
5. Run `npm run validate` (or targeted smoke) and commit.

### Task 2: Static content page parity

**Files:**
- Create: `apps/web/src/app/about/page.tsx`
- Create: `apps/web/src/app/how-to-use/page.tsx`
- Create: `apps/web/src/app/how-it-works/page.tsx`
- Create: `apps/web/src/app/terms-of-use/page.tsx`
- Create: `apps/web/src/app/privacy-policy/page.tsx`
- Create corresponding locale wrappers under `apps/web/src/app/[locale]/(site)/...`
- Create: `apps/web/src/lib/content/staticPages.ts`
- Test: `apps/web/e2e/static-pages.spec.ts`

**Steps:**
1. Port baseline content from legacy client data files into reusable content module.
2. Add modern and localized routes.
3. Add legacy aliases for static pages.
4. Add smoke tests for content route resolution.
5. Validate and commit.

### Task 3: Address page tab route parity

**Files:**
- Modify: `apps/web/src/app/address/[pin]/page.tsx`
- Create: `apps/web/src/app/address/[pin]/portfolio/page.tsx`
- Create: `apps/web/src/app/address/[pin]/timeline/[[...indicator]]/page.tsx`
- Create: `apps/web/src/app/address/[pin]/summary/page.tsx`
- Create locale wrappers and legacy alias mappings for tab routes
- Create: `apps/web/src/components/address/AddressTabs.tsx`
- Create: `apps/web/src/lib/parity/addressViewModel.ts`
- Test: `apps/web/e2e/address-tabs.spec.ts`

**Steps:**
1. Create shared address page layout + tab nav.
2. Implement tab route pages reusing existing data adapters.
3. Preserve deep-link semantics for timeline indicator suffix.
4. Add e2e coverage across modern/locale/legacy tab paths.
5. Validate and commit.

### Task 4: Timeline/indicator parity behavior

**Files:**
- Create: `apps/web/convex/indicators.ts`
- Modify: `apps/web/convex/schema.ts` (if needed for indicator tables)
- Create: `apps/web/src/lib/parity/indicators.ts`
- Create: `apps/web/src/components/address/IndicatorsPanel.tsx`
- Create tests for dataset shaping logic
- Extend e2e address tab tests

**Steps:**
1. Implement Convex query for indicator history (or fallback unavailable-state adapter).
2. Port legacy dataset detection (`standard` / `nyc`) and `show_all` shaping logic.
3. Build timeline UI controls with graceful empty/unavailable states.
4. Add unit + e2e tests.
5. Validate and commit.

### Task 5: Account page parity expansion

**Files:**
- Create: `apps/web/src/app/account/settings/page.tsx`
- Create: `apps/web/src/app/account/verify-email/page.tsx`
- Create: `apps/web/src/app/account/forgot-password/page.tsx`
- Create: `apps/web/src/app/account/reset-password/page.tsx`
- Create: `apps/web/src/app/account/unsubscribe/page.tsx`
- Create locale wrappers and legacy-compatible links where applicable
- Create: `apps/web/src/components/auth/*` supporting views
- Test: `apps/web/e2e/account-flows.spec.ts`

**Steps:**
1. Add route surfaces and protected routing for settings.
2. Implement UI flows mapped to Convex auth capabilities / placeholders where unsupported.
3. Add localized routing coverage and auth redirects.
4. Add smoke tests.
5. Validate and commit.

### Task 6: Final parity polish and deploy hardening

**Files:**
- Modify: `apps/web/e2e/*` (route matrix coverage)
- Modify: `apps/web/src/app/layout.tsx` (nav parity, locale switcher, footer links)
- Modify: `docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`
- Modify: `.github/workflows/web-validate.yml` (if parity smoke test list changes)

**Steps:**
1. Add parity route matrix regression coverage.
2. Align nav/footer links to new parity routes.
3. Update runbook with locale/legacy route checks.
4. Run `npm run validate` and deploy.
5. Commit release-ready parity slice changes.
