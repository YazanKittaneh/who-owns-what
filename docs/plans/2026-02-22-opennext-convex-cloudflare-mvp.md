# OpenNext + Convex + Cloudflare MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Django + CRA stack with a Next.js (OpenNext) + Convex app on Cloudflare that delivers MVP parity for address search, property details, portfolio associations, and auth.

**Architecture:** Build a new Next.js App Router application in-repo, wire deployment with OpenNext for Cloudflare Workers, and move domain logic into Convex query/mutation/action functions backed by reduced Chicago dataset tables and precomputed read models. Cut over frontend and backend together after staging validation.

**Tech Stack:** Next.js, OpenNext (Cloudflare adapter), Cloudflare Workers/Pages, Convex, TypeScript, Vitest/Jest, Playwright, CSV ETL scripts (Node/TS).

---

### Task 1: Create new web app workspace and base tooling

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/.gitignore`
- Modify: `README.md`
- Test: `apps/web/app/page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("renders MVP landing title", () => {
  render(<HomePage />);
  expect(screen.getByText("Who Owns What")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test app/page.test.tsx`  
Expected: FAIL with "Cannot find module './page'" or test setup missing.

**Step 3: Write minimal implementation**

```tsx
export default function HomePage() {
  return <main>Who Owns What</main>;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test app/page.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web README.md
git commit -m "feat: scaffold nextjs web app for mvp migration"
```

### Task 2: Configure OpenNext for Cloudflare deployment

**Files:**
- Create: `apps/web/open-next.config.ts`
- Create: `apps/web/wrangler.toml`
- Create: `apps/web/.dev.vars.example`
- Create: `.github/workflows/web-cloudflare-deploy.yml`
- Modify: `apps/web/package.json`
- Test: `apps/web/scripts/validate-cloudflare-config.test.ts`

**Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

it("contains Cloudflare worker name in wrangler config", () => {
  const cfg = readFileSync("wrangler.toml", "utf8");
  expect(cfg).toContain("name = \"wow-mvp\"");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test scripts/validate-cloudflare-config.test.ts`  
Expected: FAIL because `wrangler.toml` does not exist.

**Step 3: Write minimal implementation**

```toml
name = "wow-mvp"
main = ".open-next/worker.js"
compatibility_date = "2026-02-22"
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test scripts/validate-cloudflare-config.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/open-next.config.ts apps/web/wrangler.toml apps/web/package.json .github/workflows/web-cloudflare-deploy.yml
git commit -m "feat: add opennext cloudflare deployment setup"
```

### Task 3: Initialize Convex and environment wiring

**Files:**
- Create: `apps/web/convex/schema.ts`
- Create: `apps/web/convex/auth.config.ts`
- Create: `apps/web/convex/http.ts`
- Create: `apps/web/src/lib/convexClient.ts`
- Create: `apps/web/src/lib/env.ts`
- Modify: `apps/web/package.json`
- Test: `apps/web/src/lib/env.test.ts`

**Step 1: Write the failing test**

```ts
import { getRequiredEnv } from "./env";

it("throws when required env missing", () => {
  expect(() => getRequiredEnv("NEXT_PUBLIC_CONVEX_URL")).toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test src/lib/env.test.ts`  
Expected: FAIL because `env.ts` does not exist.

**Step 3: Write minimal implementation**

```ts
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test src/lib/env.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/convex apps/web/src/lib apps/web/package.json
git commit -m "feat: initialize convex runtime and env wiring"
```

### Task 4: Implement Convex Auth and Next.js session integration

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`
- Create: `apps/web/src/components/auth/LoginForm.tsx`
- Create: `apps/web/src/components/auth/RegisterForm.tsx`
- Create: `apps/web/src/lib/auth/session.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Test: `apps/web/src/lib/auth/session.test.ts`
- Test: `apps/web/src/components/auth/LoginForm.test.tsx`

**Step 1: Write the failing test**

```ts
import { requireUser } from "./session";

it("throws for anonymous session", async () => {
  await expect(requireUser(null)).rejects.toThrow("Unauthorized");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test src/lib/auth/session.test.ts`  
Expected: FAIL because `session.ts` does not exist.

**Step 3: Write minimal implementation**

```ts
export async function requireUser(user: { id: string } | null) {
  if (!user) throw new Error("Unauthorized");
  return user;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test src/lib/auth/session.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app apps/web/src/components/auth apps/web/src/lib/auth
git commit -m "feat: add convex auth pages and session guards"
```

### Task 5: Model MVP domain schema in Convex

**Files:**
- Modify: `apps/web/convex/schema.ts`
- Create: `apps/web/convex/address.ts`
- Create: `apps/web/convex/portfolio.ts`
- Create: `apps/web/convex/types.ts`
- Test: `apps/web/convex/address.test.ts`

**Step 1: Write the failing test**

```ts
import { normalizePin } from "./address";

it("normalizes pin by removing separators", () => {
  expect(normalizePin("12-34-567-890")).toBe("1234567890");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test convex/address.test.ts`  
Expected: FAIL because function missing.

**Step 3: Write minimal implementation**

```ts
export function normalizePin(pin: string): string {
  return pin.replaceAll("-", "").trim();
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test convex/address.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/convex
git commit -m "feat: add convex mvp domain schema and helpers"
```

### Task 6: Build reduced dataset ETL into Convex

**Files:**
- Create: `apps/web/scripts/etl/transformChiDataset.ts`
- Create: `apps/web/scripts/etl/importToConvex.ts`
- Create: `apps/web/scripts/etl/config.ts`
- Create: `apps/web/scripts/etl/fixtures/sample_addresses.csv`
- Modify: `apps/web/package.json`
- Test: `apps/web/scripts/etl/transformChiDataset.test.ts`

**Step 1: Write the failing test**

```ts
import { transformAddressRow } from "./transformChiDataset";

it("maps csv row to convex document shape", () => {
  const doc = transformAddressRow({ pin: "123", prop_address_full: "1 Main St" });
  expect(doc.pin).toBe("123");
  expect(doc.address).toBe("1 Main St");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test scripts/etl/transformChiDataset.test.ts`  
Expected: FAIL because transform module missing.

**Step 3: Write minimal implementation**

```ts
export function transformAddressRow(row: Record<string, string>) {
  return {
    pin: row.pin,
    address: row.prop_address_full,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test scripts/etl/transformChiDataset.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/scripts/etl apps/web/package.json
git commit -m "feat: add reduced chicago dataset etl for convex"
```

### Task 7: Implement address search API and UI flow

**Files:**
- Create: `apps/web/convex/search.ts`
- Create: `apps/web/src/app/search/page.tsx`
- Create: `apps/web/src/components/search/AddressSearchForm.tsx`
- Create: `apps/web/src/components/search/SearchResults.tsx`
- Test: `apps/web/convex/search.test.ts`
- Test: `apps/web/src/components/search/AddressSearchForm.test.tsx`

**Step 1: Write the failing test**

```ts
import { scoreAddressMatch } from "./search";

it("prefers exact prefix match", () => {
  expect(scoreAddressMatch("123 main", "123 main st")).toBeGreaterThan(
    scoreAddressMatch("123 main", "999 broadway"),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test convex/search.test.ts`  
Expected: FAIL because scoring function missing.

**Step 3: Write minimal implementation**

```ts
export function scoreAddressMatch(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.startsWith(q)) return 2;
  if (c.includes(q)) return 1;
  return 0;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test convex/search.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/convex/search.ts apps/web/src/app/search apps/web/src/components/search
git commit -m "feat: implement mvp address search flow"
```

### Task 8: Implement property details page with Convex query composition

**Files:**
- Create: `apps/web/convex/property.ts`
- Create: `apps/web/src/app/address/[pin]/page.tsx`
- Create: `apps/web/src/components/property/PropertySummary.tsx`
- Create: `apps/web/src/components/property/PropertyIndicators.tsx`
- Test: `apps/web/convex/property.test.ts`
- Test: `apps/web/src/components/property/PropertySummary.test.tsx`

**Step 1: Write the failing test**

```ts
import { buildPropertySummary } from "./property";

it("returns fallback zeros for missing metrics", () => {
  const summary = buildPropertySummary({ pin: "1" });
  expect(summary.violationsOpen).toBe(0);
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test convex/property.test.ts`  
Expected: FAIL because function missing.

**Step 3: Write minimal implementation**

```ts
export function buildPropertySummary(doc: Record<string, unknown>) {
  return {
    pin: String(doc.pin ?? ""),
    violationsOpen: Number(doc.violationsOpen ?? 0),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test convex/property.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/convex/property.ts apps/web/src/app/address apps/web/src/components/property
git commit -m "feat: add property details route for mvp parity"
```

### Task 9: Implement portfolio association views

**Files:**
- Create: `apps/web/convex/associations.ts`
- Create: `apps/web/src/app/portfolio/[portfolioId]/page.tsx`
- Create: `apps/web/src/components/portfolio/PortfolioTable.tsx`
- Create: `apps/web/src/components/portfolio/PortfolioFilters.tsx`
- Test: `apps/web/convex/associations.test.ts`
- Test: `apps/web/src/components/portfolio/PortfolioTable.test.tsx`

**Step 1: Write the failing test**

```ts
import { dedupePins } from "./associations";

it("deduplicates repeated pin ids", () => {
  expect(dedupePins(["1", "1", "2"])).toEqual(["1", "2"]);
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test convex/associations.test.ts`  
Expected: FAIL because helper missing.

**Step 3: Write minimal implementation**

```ts
export function dedupePins(pins: string[]) {
  return [...new Set(pins)];
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test convex/associations.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/convex/associations.ts apps/web/src/app/portfolio apps/web/src/components/portfolio
git commit -m "feat: implement portfolio association ui and queries"
```

### Task 10: Add API compatibility shim for MVP client data contracts

**Files:**
- Create: `apps/web/src/app/api/address/search/route.ts`
- Create: `apps/web/src/app/api/address/[pin]/route.ts`
- Create: `apps/web/src/lib/contracts/address.ts`
- Test: `apps/web/src/lib/contracts/address.test.ts`
- Test: `apps/web/src/app/api/address/search/route.test.ts`

**Step 1: Write the failing test**

```ts
import { toLegacyAddressResult } from "./address";

it("maps convex doc to legacy key names used by ui", () => {
  const result = toLegacyAddressResult({ pin: "1", address: "1 Main St" });
  expect(result.prop_address).toBe("1 Main St");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn test src/lib/contracts/address.test.ts`  
Expected: FAIL because mapping function missing.

**Step 3: Write minimal implementation**

```ts
export function toLegacyAddressResult(doc: { pin: string; address: string }) {
  return {
    pin: doc.pin,
    prop_address: doc.address,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn test src/lib/contracts/address.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/api apps/web/src/lib/contracts
git commit -m "feat: add mvp api contract compatibility layer"
```

### Task 11: Add end-to-end smoke tests for critical flows

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/auth.spec.ts`
- Create: `apps/web/e2e/address-search.spec.ts`
- Create: `apps/web/e2e/property.spec.ts`
- Create: `apps/web/e2e/portfolio.spec.ts`
- Modify: `apps/web/package.json`

**Step 1: Write the failing test**

```ts
import { test, expect } from "@playwright/test";

test("searches address and opens property page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: /address/i }).fill("123");
  await page.getByRole("button", { name: /search/i }).click();
  await expect(page).toHaveURL(/address/);
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn playwright test e2e/address-search.spec.ts`  
Expected: FAIL because page elements/routes not complete.

**Step 3: Write minimal implementation**

```tsx
// Add address input + submit button on landing page and route to /address/[pin].
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn playwright test e2e/address-search.spec.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/e2e apps/web/playwright.config.ts apps/web/package.json apps/web/src/app
git commit -m "test: add e2e smoke coverage for mvp flows"
```

### Task 12: Cutover docs and production deployment runbook

**Files:**
- Create: `docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`
- Modify: `README.md`
- Modify: `client/README.md`
- Modify: `netlify.toml`
- Test: `docs/runbooks/2026-02-22-cloudflare-convex-cutover.md` (manual checklist execution)

**Step 1: Write the failing test**

```md
- [ ] DNS points to Cloudflare project
- [ ] Convex production deployment active
- [ ] Auth callback URLs verified
- [ ] Smoke tests pass in production
```

**Step 2: Run test to verify it fails**

Run: `rg -n "DNS points to Cloudflare project" docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`  
Expected: no match (file missing).

**Step 3: Write minimal implementation**

```md
# Cloudflare + Convex Cutover Checklist

- [ ] DNS points to Cloudflare project
- [ ] Convex production deployment active
- [ ] Smoke tests pass
```

**Step 4: Run test to verify it passes**

Run: `rg -n "DNS points to Cloudflare project" docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`  
Expected: one match line found.

**Step 5: Commit**

```bash
git add docs/runbooks README.md client/README.md netlify.toml
git commit -m "docs: add migration cutover runbook and deployment docs"
```

### Task 13: Final verification and release tag

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/README.md`

**Step 1: Write the failing test**

```bash
cd apps/web && yarn lint && yarn test && yarn build
```

Expected: one or more failures before final cleanup.

**Step 2: Run test to verify it fails**

Run: `cd apps/web && yarn lint && yarn test && yarn build`  
Expected: FAIL until all migration tasks are complete.

**Step 3: Write minimal implementation**

```ts
// Resolve final lint/type/test/build issues without introducing new features.
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && yarn lint && yarn test && yarn build`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web
git commit -m "chore: finalize opennext convex cloudflare mvp release readiness"
git tag -a mvp-opennext-convex-cutover -m "MVP cutover to OpenNext + Convex + Cloudflare"
```
