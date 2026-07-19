# Issue drafts — 2026-07-19 project audit

Each block below is one GitHub issue, in the format consumed by `file_issues.sh`.
Filed from a five-role audit: backend, frontend, devops, data engineering, growth.

=== ISSUE ===
TITLE: [P0][privacy] Purge committed owner PII (names, home addresses, skip-trace columns) from repo and git history
LABELS: audit,P0,security,data
BODY:
**Lens:** DevOps + Data audit · **Severity: Critical**

23 tracked CSVs under `data/exports/nearby-owner-outreach/**` plus `data/Property Export 2436+N+Albany+Prospecting.xlsx` contain real individuals' names, PINs, home mailing addresses, and phone/email columns. `.gitignore` now excludes `data/exports/`, but these files were committed **before** the rule, so they remain tracked and live in history even after deletion. PropStream-derived skip-trace data also generally can't be redistributed under their ToS.

**Fix**
1. `git rm --cached` all export CSVs and the `.xlsx`; add `data/*.xlsx` to `.gitignore`.
2. Scrub history with `git filter-repo` (force-push; re-clone after).
3. Keep outreach exports on the backup pool, never in git.

**Rough thoughts:** The most important item in the whole audit — cheap to fix, expensive to ignore. Every additional commit makes the history rewrite more annoying, so do this first. This is also the blocker on ever open-sourcing the fork.

=== ISSUE ===
TITLE: [P0][data] Portfolio linking is exact-string matching — the shell-company graph engine is dead code
LABELS: audit,P0,data
BODY:
**Lens:** Data engineering audit · **Severity: Critical**

`portfoliograph/table.py:33-67` groups parcels by `coalesce(nullif(o.mail_address_name,''), row_id, pin)` — exact, unnormalized string match on mailing name — and writes an empty `'{}'::jsonb` graph. The real JustFix machinery (NetworkX graph, name+address edges, Louvain splitting in `graph.py`, `standardize.py`) is imported nowhere.

Consequences:
- `SMITH, JOHN` vs `JOHN SMITH LLC` = separate portfolios (false negatives — the exact thing shell-company detection must defeat).
- Generic names (`CITY OF CHICAGO`) merge thousands of unrelated parcels (false positives).
- No address-based linking, so two LLCs sharing a registered-agent address never connect.

**Fix:** Port the graph pipeline to Chicago inputs (normalize names, add mailing-address edges, community detection, blocklist government/generic names), or at minimum reuse the normalization already in `create_business_linkage_summary.sql`. Quarantine the NYC dead code so it isn't mistaken for the active path.

**Rough thoughts:** This is the product's headline claim ("connect the dots on your landlord"), and right now it's an `GROUP BY owner_name`. I'd rank it the #1 engineering investment after the PII purge — everything growth-related depends on the portfolio data being credible.

=== ISSUE ===
TITLE: [P0][security] Rate limiting is defeatable two ways: spoofable X-Forwarded-For key and per-worker LocMemCache
LABELS: audit,P0,security,backend,devops
BODY:
**Lens:** Backend + DevOps audit · **Severity: High**

Two independent defects mean the throttles marked "done" in TODO.md don't hold in production:

1. `wow/apiutil.py:44-47` keys the limit on the **left-most** value of client-supplied `X-Forwarded-For`. Any caller can send a random XFF per request and get a fresh bucket — defeating every `@ratelimit`, including the 5/m PropStream upload guard.
2. `project/settings.py:185-196` defaults to `LocMemCache` while `Dockerfile.prod:50` runs 4 gunicorn workers. Counters aren't shared across processes, so limits are ~4× configured and reset unpredictably. The settings comment even warns about this, but `DJANGO_CACHE_BACKEND` is never set in `docker-compose.prod.yml`.

**Fix:** Derive client IP from `REMOTE_ADDR` / right-most trusted XFF hop (nginx `real_ip` or tunnel-provided header), add a Redis/memcached service to prod compose and point `RATELIMIT_USE_CACHE` at it, and add a smoke test asserting a 429 past the limit.

**Rough thoughts:** Worth doing before promoting the tool anywhere — the export and upload endpoints are the expensive ones, and right now they're effectively unthrottled.

=== ISSUE ===
TITLE: [P0][security] Harden admin token auth: constant-time compare, throttle admin endpoints, drop ALERTS token fallback
LABELS: audit,P0,security,backend
BODY:
**Lens:** Backend audit · **Severity: High**

Three compounding weaknesses:

1. `wow/apiutil.py:116` compares tokens with `==` (short-circuits, timing-observable) instead of `hmac.compare_digest`.
2. `admin_data_coverage` (`wow/views.py:882`) and `admin_contact_coverage` (`wow/views_entity.py:320`) are the only endpoints with **no** `@ratelimit` — unlimited guessing attempts.
3. `project/settings.py:58`: `ADMIN_API_TOKEN` silently falls back to `ALERTS_API_TOKEN`, so if the admin token is unset (empty in `.env.sample`), whoever holds the alerts token can hit the PropStream **write** endpoint and coverage internals. Distinct error strings ("No token provided" vs "You do not have permission") also leak progress.

**Fix:** `hmac.compare_digest`; `@ratelimit` on both admin views; make `ADMIN_API_TOKEN` required and distinct (fail closed if it equals the alerts token); single generic "Unauthorized" message.

**Rough thoughts:** Each fix is a few lines. The fallback (#3) is the sneaky one — it's an implicit privilege escalation baked into default config.

=== ISSUE ===
TITLE: [P0][security] Anchor CORS origin regexes — unanchored patterns allow credentialed cross-origin bypass
LABELS: audit,P0,security,backend
BODY:
**Lens:** Backend audit · **Severity: Medium-High**

`project/settings.py:139-149`: patterns like `r"https://([A-Za-z0-9\-\_]+)--wow-django\.netlify\.app"` have no trailing `$`. django-cors-headers matches with `re.match` (start-anchored only), so `https://x--wow-django.netlify.app.evil.example` matches and gets `Access-Control-Allow-Origin` echoed with `Access-Control-Allow-Credentials: true` (settings.py:112). Note `wow/apiutil.py:53` correctly uses `re.fullmatch`, but the corsheaders middleware emits the permissive header independently, so the app-layer check doesn't save you.

Also: `"https://*.who-owns-what.pages.dev"` at settings.py:135 sits in `CORS_ALLOWED_ORIGINS` as a literal string — it matches nothing (dead config).

**Fix:** Add `^...$` anchors to every regex; move the pages.dev wildcard into `CORS_ALLOWED_ORIGIN_REGEXES` properly escaped.

**Rough thoughts:** Classic subtle footgun — the two matching layers disagreeing (`fullmatch` vs `match`) is exactly how this slips through review.

=== ISSUE ===
TITLE: [P0][devops] CI lost every quality gate in the CircleCI → GitHub Actions migration
LABELS: audit,P0,devops
BODY:
**Lens:** DevOps audit · **Severity: High**

Old CircleCI ran `black --check`, `flake8`, `mypy`, frontend `prettier:check`, `lingui compile`, `typecheck`, and `yarn test` (`.circleci/config.yml:31-72`). The replacement `.github/workflows/ci.yml` runs backend `pytest` only (line 56) and frontend `yarn build` only (86-92) — and sets `TSC_COMPILE_ON_ERROR: 'true'`, which tells CRA to *warn* instead of fail on TypeScript errors. So type regressions, lint rot, and frontend test failures all ship silently, while `.flake8`, `mypy.ini`, and `black` still sit in the repo implying they're enforced. `docs/ops-runbook.md:91-105` still lists all these checks as validation.

**Fix:** Add lint/format/typecheck/test steps to both CI jobs; delete `TSC_COMPILE_ON_ERROR`.

**Rough thoughts:** For a solo project CI is your only reviewer — this is the cheapest possible "second pair of eyes" and it's currently off.

=== ISSUE ===
TITLE: [security][deps] Upgrade gunicorn (CVE-2024-1135) and requests (CVE-2023-32681); add Dependabot + pip-audit
LABELS: audit,security,devops
BODY:
**Lens:** Backend + DevOps audit · **Severity: Medium-High**

- `requirements.txt:7` pins `gunicorn==19.9.0` (2018) — the production WSGI server (`Procfile`, `Dockerfile.prod`) — which predates CVE-2024-1135 (HTTP request smuggling via malformed Transfer-Encoding; fixed in 22.0).
- `requirements.txt:11` pins `requests==2.25.1`, predating CVE-2023-32681 (proxy credential leak on redirect; fixed 2.31).
- `algoliasearch==2.6.1`, `dj-database-url==0.5.0` are years stale. Django 4.2.x and psycopg2 are fine.
- No `.github/dependabot.yml`, no CodeQL, no `pip-audit`/`yarn audit` in CI.

**Fix:** Bump gunicorn ≥23 and requests ≥2.32; add `dependabot.yml` covering pip + npm + github-actions; add a `pip-audit` CI step.

**Rough thoughts:** Gunicorn behind a proxy/tunnel is precisely the topology where request smuggling matters. Dependabot on a personal project is set-and-forget insurance.

=== ISSUE ===
TITLE: [data] TRUNCATE→COPY loads can silently wipe tables — add staging-swap and minimum-row guards
LABELS: audit,data,P1
BODY:
**Lens:** Data engineering audit · **Severity: High**

`dbtool.py:628-688` truncates the target table, COPYs whatever the CSV contains, and records `status="success"` even with `row_count=0`. Only a *missing header* raises; a header-only or short file (one Socrata hiccup away) destroys existing data and logs success. Same pattern in `scripts/load_supplemental_data.py:237-241` and `scripts/load_source_expansion.py:131-135`.

**Fix:**
- Load into a staging table and swap only after validation, or assert `row_count >= per-dataset floor` before TRUNCATE.
- Treat `row_count=0` as `failed`.
- Compare against the previous audit row count and abort on large negative deltas (this also delivers the TODO's "drift alerts" for free).

**Rough thoughts:** This is the concrete mechanism behind several vaguer TODO items ("avoid destructive reloads"). Staging-and-swap is the one structural fix that makes the whole pipeline safe by default.

=== ISSUE ===
TITLE: [data] Violations/311 counts are multiplied across co-located PINs — condo buildings overcount by unit count
LABELS: audit,data,P1
BODY:
**Lens:** Data engineering audit · **Severity: High**

`sql/create_indicators_table.sql:35-77` joins violations and 311 requests to parcels purely on normalized address string (`v.addr_norm = p.addr_norm`), then counts per `pin`. Condo units and multi-PIN buildings share the same address, so one violation at "1234 N CLARK ST" is counted once **per unit**: a 20-unit condo reports 20× its true violations, and portfolio aggregates (sums of these) inflate correspondingly.

**Fix:** Count distinct source events (violation `id` / `sr_number`) per *building* key (e.g. pin10) and attribute at building level rather than replicating per PIN. Add a QA assertion: `sum(violations_total) == count(distinct chi_violations.id)` within tolerance.

**Rough thoughts:** Distress indicators are the second-biggest product claim after portfolio linking, and this bug biases them systematically upward for exactly the building types organizers care about. Fix before anyone uses the numbers in outreach material.

=== ISSUE ===
TITLE: [data] chi_owners and chi_parcels use different city filters — owner rows silently dropped for valid parcels
LABELS: audit,data,P1
BODY:
**Lens:** Data engineering audit · **Severity: High**

`scripts/fetch_chi_data.py:47` filters parcels on `cook_municipality_name = 'CITY OF CHICAGO'` but lines 214/237 filter owners on `prop_address_city_name = 'CHICAGO'` — different fields, different vocabularies. Any Chicago parcel whose owner record has a blank/variant city string (common in assessor data) is fetched as a parcel but not as an owner. The `LEFT JOIN` then yields no `mail_address_name`, the parcel becomes a singleton "portfolio" keyed on `row_id`, and it drops out of owner search and linking entirely. No owner-join match rate is reported anywhere.

**Fix:** Filter owners by PIN membership in the fetched parcel set (or identical municipality logic); log and alert on the parcel→owner join rate after each load.

**Rough thoughts:** Silent coverage loss is worse than an error — you can't see what's missing. The join-rate metric is the real deliverable here; it will catch this whole class of bug forever.

=== ISSUE ===
TITLE: [data] Replace Socrata $offset deep paging with keyset pagination + natural-key dedupe
LABELS: audit,data,P1
BODY:
**Lens:** Data engineering audit · **Severity: High**

`scripts/fetch_chi_data.py:364` pages `chi_311` (13.5M rows) with increasing `$offset` in 50k chunks — a ~5-hour crawl during which any upstream update shifts rows across offset windows, causing silent skips/duplicates (Socrata explicitly discourages this). Nothing dedupes downstream: tables have `primary_key=None` and loads are raw COPY, so duplicates permanently inflate count-based indicators. Termination on `page_rows < limit` (line 402) also stops early on a transient short page.

**Fix:** Keyset-paginate (`$where=:id > last_id` ordered by `:id`); add unique constraints on natural keys (`sr_number`, violation id, `pin+year`); reconcile fetched counts against the dataset's metadata count and store in the load audit.

**Rough thoughts:** Pairs with the staging-swap issue — do them together and the pipeline goes from "hope it worked" to verifiable.

=== ISSUE ===
TITLE: [data] Loaders fail silently or fail whole batches — numeric COPY casts, contact orchestrator, IHS parser, BOR scraper
LABELS: audit,data,P2
BODY:
**Lens:** Data engineering audit · **Severity: Medium**

Grab-bag of failure-handling defects, all "quiet wrongness":

- **Typed COPY, no cleaning:** `scripts/load_supplemental_data.py:43-53` COPYs into `numeric`/`boolean` columns after only `.strip()`. One `$1,234` or `N/A` aborts the whole batch — after TRUNCATE, leaving the table empty. Load raw as text, cast with `NULLIF`/regex in SQL, keep a reject log.
- **Orchestrator swallows failures:** `scripts/run_contact_ingestion.py:118-152` prints a warning and continues when a step fails; `capture_output=True` also buffers entire citywide extractions in RAM. Stream output; fail the run or record per-step audit rows.
- **IHS parser drops rows silently:** `scripts/parse_ihs_html.py:97-99` discards any row whose cell count mismatches headers. Validate year span/indicator set; fail loudly on drift.
- **BOR scraper returns [] on captcha** (`scripts/scrape_bor_decisions.py:159-161`) with a spoofed Chrome UA — a "successful" run with zero rows and a ToS gray area. Treat captcha/empty as failed status; decide whether this source stays at all.

**Rough thoughts:** Common thread: a run that produced nothing should never look like a run that succeeded.

=== ISSUE ===
TITLE: [data] PIN normalization is one-sided in tax-sale/recorder joins — latent zero-match failure
LABELS: audit,data,P2
BODY:
**Lens:** Data engineering audit · **Severity: Medium**

`sql/create_tax_sale_summary.sql` (lines 6/21/58) and the analogous recorder summary strip non-digits from the event-side PIN (`pin_norm`) but join against **raw** `wow_parcels.pin`. This works only while the parcel source emits digit-only PINs; the day it emits dashed Cook County format (`17-04-100-001-0000`), every summary silently becomes zero with no error.

**Fix:** Materialize `pin_norm` on `wow_parcels` and join on it everywhere; add a QA assertion that tax-sale/recorder summaries cover a plausible fraction of the parcel universe.

**Rough thoughts:** Five-minute fix, and the coverage assertion generalizes to every derived-summary table.

=== ISSUE ===
TITLE: [frontend] Three package-manager lockfiles are committed and drifting — pick one
LABELS: audit,frontend,P1
BODY:
**Lens:** Frontend audit · **Severity: High**

`client/bun.lock`, `client/yarn.lock`, and `client/package-lock.json` are all git-tracked and resolve **different** dependency trees (bun pins `react-scripts@4.0.3` exact; yarn resolves `^4.0.3`; npm is a third resolution). Prod builds use `yarn install --frozen-lockfile` (`client/Dockerfile.prod:19`), so the other two look authoritative but are unused — and anyone running `bun install`/`npm install` locally gets a different tree than CI/prod.

**Fix:** Keep `yarn.lock` (matches `"packageManager": "yarn@1.22.22"`), delete the other two, gitignore them.

**Rough thoughts:** Ten-minute cleanup that eliminates a whole category of "works on my machine."

=== ISSUE ===
TITLE: [frontend] Migrate off deprecated CRA (react-scripts 4, webpack 4, React 16, openssl-legacy hack)
LABELS: audit,frontend,P1
BODY:
**Lens:** Frontend audit · **Severity: High**

`client/package.json`: `react-scripts ^4.0.3` (2021, webpack 4), React 16.11, and `NODE_OPTIONS=--openssl-legacy-provider` forced into `start`/`build` — the tell-tale hack for running webpack 4's crypto on modern Node. CRA is officially deprecated with no upgrade path; the transitive tree carries many unfixable advisories and pins the app to React 16.

**Fix:** Migrate to Vite (mechanical for a CRA app of this shape: index.html to root, `import.meta.env` swap, `vite-plugin-svgr`, jest→vitest or keep jest). Then unblock React 18.

**Rough thoughts:** This is the enabling move for half the other frontend issues (bundle trimming, dropping polyfills/es5, faster CI). Worth doing early rather than investing more in the dying toolchain. Pairs naturally with the lockfile cleanup.

=== ISSUE ===
TITLE: [frontend] Remove dead map/chart libraries and raise the build target — major bundle savings
LABELS: audit,frontend,P2
BODY:
**Lens:** Frontend audit · **Severity: Medium (bundle size)**

The Chicago maps all use react-leaflet now, but `client/package.json` still ships:
- `mapbox-gl` + `react-mapbox-gl` — imported **nowhere** (verified by grep); ~1MB dead weight.
- `react-google-maps@9.4.5` (archived 2019) — kept alive for `StreetView.tsx` alone; replace with a static/embed iframe.
- Duplicate chart libs: `react-chartjs-2` **and** `react-chartjs2`, on EOL `chart.js@2.9.4`.
- `tsconfig` `target: es5` + `ie 11` browserslist + three polyfill packages nobody needs in 2026.

**Fix:** Delete the dead deps, single chart lib, `target: es2019`, drop ie11 + polyfills.

**Rough thoughts:** For a mobile-heavy audience (organizers in the field), initial-load weight is a real activation factor, not vanity.

=== ISSUE ===
TITLE: [frontend][bug] Autocomplete keystroke failures fire the search-submit error path
LABELS: audit,frontend,P2
BODY:
**Lens:** Frontend audit · **Severity: Medium**

`client/src/components/AddressSearch.tsx:229`: when a *background* type-ahead fetch fails (network blip while typing), the debounced catch calls `onFormSubmit(makeEmptySearchAddress(), e)` — the same callback as an intentional submit. On `FindOwnersPage` this flips the whole page into a red error state mid-typing (`FindOwnersPage.tsx:164-176`); on `HomePage` it fires spurious `search-error` analytics.

**Fix:** In the type-ahead path, set `{isLoading:false, results:[]}` on error and nothing else; reserve `onFormSubmit(..., error)` for explicit submits (lines 309/315).

**Rough thoughts:** Small fix, outsized UX effect — transient blips currently look like the product breaking.

=== ISSUE ===
TITLE: [frontend][bug] OwnerPage renders network errors as "no results"; FindOwnersPage shows raw Error.message
LABELS: audit,frontend,P2
BODY:
**Lens:** Frontend audit · **Severity: Medium**

- `client/src/containers/OwnerPage.tsx:52-56,102-107`: the fetch `.catch` just sets `data = null`, which falls through to the empty state — a backend 500 renders as *"No current parcel records found for this owner key."* No error branch, no retry. (`PropertyPage` does this right with `networkErrorOccurred`.)
- `client/src/containers/FindOwnersPage.tsx:149,428-431`: the opposite smell — raw `error.message` strings surface directly to end users.

**Fix:** Add an `error` state + retry block to OwnerPage; map FindOwnersPage errors to friendly copy.

**Rough thoughts:** "Empty" and "broken" are the two states users must never confuse in a data-trust product.

=== ISSUE ===
TITLE: [frontend][perf] Debounce map viewport fetches and abort superseded requests
LABELS: audit,frontend,P2
BODY:
**Lens:** Frontend audit · **Severity: Medium**

`OverviewMap.tsx:130-131` emits bounds on every `moveend`/`zoomend`, and the `HomePage.tsx:58-87` effect fires an overview-map request (up to 1200 parcels) synchronously for each. One drag across the city = a dozen+ heavy requests. The `requestIdRef` guard prevents out-of-order *rendering* but not the request spam. Bonus loop: `fitBounds` after marker click itself triggers `moveend` → refetch. Also `OverviewMap.tsx:115-137` re-subscribes Leaflet listeners every render on OwnerPage because it receives an inline `() => undefined` callback.

**Fix:** Debounce `emitBounds` (~300ms), cancel superseded requests with `AbortController`, hoist a stable noop/`useCallback`.

**Rough thoughts:** This is also backend load — combined with the broken rate limiting, map panning is currently your own DoS vector.

=== ISSUE ===
TITLE: [frontend] Saved lists: localStorage JSON.parse inside the render loop, writes unguarded against quota errors
LABELS: audit,frontend,P2
BODY:
**Lens:** Frontend audit · **Severity: Medium**

`FindOwnersPage.tsx:531-536` calls `isSavedNearbyItem(...)` per owner card during render — each call does a full `JSON.parse(localStorage.getItem(...))`, so O(owners) synchronous storage reads per render, with a throwaway `setSavedVersion` counter (lines 118/301) faking reactivity. `savedNearbyLists.ts:51-53` writes with no try/catch, so `QuotaExceededError` (or Safari private mode) throws uncaught from the click handler.

**Fix:** Read the saved set once into state/context as a `Set`, derive membership from it; wrap writes in try/catch with a user-visible failure toast.

**Rough thoughts:** TODO already tracks moving saved lists server-side; this is the interim correctness/perf fix so the current feature isn't flaky meanwhile.

=== ISSUE ===
TITLE: [frontend][a11y] Map parcels are unreachable by keyboard or screen reader
LABELS: audit,frontend,P2,a11y
BODY:
**Lens:** Frontend audit · **Severity: Medium**

The primary interaction — clicking a `CircleMarker` to open a property modal (`OverviewMap.tsx:159-187`, also `OwnerSearchMap`, `PropertiesMap`) — is mouse-only. SVG circle markers get no tab focus, no role/aria-label, no Enter/Space activation, and there's no alternative list of in-viewport parcels.

**Fix:** Add a keyboard-navigable list view of visible parcels beside the map (also helps SEO and no-JS), or wire `keyboard`/aria onto marker layers and move focus into the modal on open.

**Rough thoughts:** For a tenant-organizing tool, accessibility is mission-aligned, not a checkbox. The parallel list view is the pragmatic fix and doubles as crawlable content.

=== ISSUE ===
TITLE: [growth] Property pages are invisible to search engines and social scrapers — add prerendering + sitemap
LABELS: audit,growth,P1
BODY:
**Lens:** Growth audit · **Impact: HIGH**

The app is a pure CRA SPA serving an empty `<div id="root">`; every title/OG tag is injected client-side via react-helmet. Social scrapers (iMessage, Slack, FB, LinkedIn) run no JS and see nothing; Googlebot's JS rendering is unreliable for a 160k-page long tail. There is no `sitemap.xml` — `robots.txt` only disallows `/api/`. For a "look up any building" tool, programmatic SEO on `/pin/:pin` pages ("who owns 1234 N Clark St Chicago") is *the* organic growth channel, and it's fully dark.

**Fix:** Serve crawlers rendered HTML — a Cloudflare Worker that injects real title/OG/description per PIN is the lightest path given the existing tunnel setup; or prerender at build time; or move the property surface to SSG. Generate chunked `sitemap.xml` from the parcel table and reference it in robots.txt.

**Rough thoughts:** Highest-leverage growth item in the audit. Every other acquisition idea is pushing a rope until property pages are indexable.

=== ISSUE ===
TITLE: [growth] "How it works" page still describes New York — the tool's trust anchor is wrong
LABELS: audit,growth,P1
BODY:
**Lens:** Growth audit · **Impact: HIGH**

`client/src/data/how-it-works.en.json` and `.es.json` (route `/how-it-works`, `Methodology.tsx`) still explain portfolio linking via HPD registrations, "Head Officer" contacts, NYC business addresses, PLUTO, ACRIS, NYC eviction data — none of which power this product. A skeptical organizer who clicks "how it works" to verify a surprising ownership claim finds a description of a different city's data and rightly distrusts everything.

**Fix:** Rewrite both locales to describe the actual Chicago pipeline: Cook County parcels/owners, business-linkage matching, IHS indicators — including an honest limitations section (2025–2026 owner snapshot depth, current-owner-only grouping).

**Rough thoughts:** Candor about limitations is itself a growth asset for civic tools; JustFix's original methodology page earned trust precisely by being specific. This is mostly a writing task and could ship this week.

=== ISSUE ===
TITLE: [growth] All analytics point at JustFix accounts (incl. a dead UA property) — you're flying blind
LABELS: audit,growth,P1
BODY:
**Lens:** Growth audit · **Impact: HIGH**

`client/public/index.html` hardcodes JustFix's `GTM-NMPT5JP`, `UA-67069242-5` (Universal Analytics — Google stopped processing UA hits in July 2023, so it records nothing), FB Pixel `2758942167460891`, FullStory org `MBQ2E`, and a `facebook-domain-verification` meta attributing the domain to JustFix. What data does flow goes to JustFix, not you. The only owner-controllable path, Amplitude, has an all-NYC event enum (`hpd-overview-tab`, `acris-timeline-tab`…).

**Fix:** Rip out all JustFix snippets; add your own GA4 or a privacy-friendly option (Plausible/Umami — on-brand for this tool); rebuild the Amplitude/GA event taxonomy around the Chicago funnel: search → property view → portfolio view → export/save → follow.

**Rough thoughts:** Do this before any launch push — you can't iterate on a funnel you can't see, and third parties silently receiving your users' data is its own problem.

=== ISSUE ===
TITLE: [growth] No share affordances on the property/owner pages; generic OG cards; no canonical URLs
LABELS: audit,growth,P2
BODY:
**Lens:** Growth audit · **Impact: HIGH (share loop) / MEDIUM (metadata)**

The most viral artifact this product produces is a building's ownership page — what a tenant screenshots and texts to neighbors. But:
- A working `SocialShareAddressPage` component exists and is wired only into the legacy `DetailView`; the new `PropertyPage` toolbar has just "New Search" + "Export Data". `OwnerPage` and `SavedListsPage` are also share dead-ends.
- `Page.tsx` hardcodes one Imgur image as the OG card for everything and sets `og:url` to the site root on every page; no `rel="canonical"` anywhere (`/en`, `/es`, `/legacy` variants dilute).

**Fix:** Render share buttons + copy-link on PropertyPage/OwnerPage; per-property OG image endpoint (Worker + Satori: address, owner, portfolio count); correct `og:url` and canonical per route.

**Rough thoughts:** Pre-filled share text like "1234 N Clark is one of 47 buildings tied to ACME LLC" turns every share into an ad. Depends on the prerendering issue for scrapers to actually see the tags.

=== ISSUE ===
TITLE: [growth] "Follow this building" email alerts exist but aren't reachable from the Chicago property page
LABELS: audit,growth,P2
BODY:
**Lens:** Growth audit · **Impact: MEDIUM (retention)**

`EmailAlertSignup.tsx` (weekly alert on complaints/violations/permits/311) renders only inside the legacy `DetailView` — the new primary `PropertyPage` has no follow/subscribe affordance at all. The button also just routes to `/account/login`, and it's unclear the Chicago backend actually sends building-alert digests.

**Fix:** Surface "Follow this building" on `PropertyPage`; verify/build the Chicago subscription + weekly digest pipeline; add owner-level alerts ("email me when this owner acquires a building / gets a violation") as the power feature.

**Rough thoughts:** Watchlists are the single strongest return-visit lever for a lookup tool. Owner-level alerts especially — that's a feature not even most paid real-estate tools do well.

=== ISSUE ===
TITLE: [growth] Weak first-visit activation: bare map with no explainer; manifest still says "Create React App Sample"
LABELS: audit,growth,P2
BODY:
**Lens:** Growth audit · **Impact: MEDIUM**

`HomePage.tsx` drops new visitors onto a parcel map with a one-line H1 and a search box — no "what this reveals / why it matters," no example portfolio to click, nothing to convert a cold visitor arriving from a shared link. Meanwhile `client/public/manifest.json` still ships `"short_name": "React App"`, `"name": "Create React App Sample"`, default favicon — visible in the tab, add-to-homescreen, and some link unfurls.

**Fix:** One-sentence hero + "See an example: [notable Chicago portfolio]" button + 2–3 example searches above the map; real manifest name/theme/maskable icons.

**Rough thoughts:** The example-portfolio button is the cheapest activation win available — it demonstrates the aha moment (one owner, many buildings) in one click.

=== ISSUE ===
TITLE: [backend] Blanket ProgrammingError→empty-200 fallback masks real query bugs
LABELS: audit,backend,P2
BODY:
**Lens:** Backend audit · **Severity: Medium**

`wow/views.py:463-470` (`is_missing_db_object_error`) treats any Postgres `42P01` (undefined table) or `42883` (undefined function) as "tables not deployed yet" and returns empty 200s with a `logger.warning`, across ~10 endpoints plus `views_entity.py`. A typo'd function name or broken migration produces the same silent empty response as "not initialized" — invisible to monitoring and tests. Inconsistently, `address_aggregate` (views.py:704) and `address_export` (:830) *lack* the fallback and 500 instead.

**Fix:** Narrow detection to specific known object names, emit a distinct high-severity log/metric, and include `degraded: true` in responses so alerting can fire; make the sibling endpoints consistent either way.

**Rough thoughts:** Degraded-mode is a fine idea — it just needs to be *observable* degraded, not indistinguishable-from-fine degraded.

=== ISSUE ===
TITLE: [backend] Misc robustness: PropStream xlsx parser, unbounded owner_current query, dead code, .env fallback
LABELS: audit,backend,P2
BODY:
**Lens:** Backend audit · **Severity: Low-Medium (grouped)**

- `wow/views.py:107-119`: xlsx parser hardcodes `xl/worksheets/sheet1.xml` (first sheet isn't guaranteed that name — valid uploads KeyError), reads whole zip members with no size cap (zip-bomb/OOM), and `normalize_propstream_pin` (:92) accepts any digit string without a 14-digit check. Resolve the sheet via workbook rels; cap sizes; validate PINs.
- `wow/sql/owner_current.sql` has no LIMIT — a big institutional `owner_name` serializes thousands of rows per request. Add LIMIT + pagination + total_count.
- `wow/views.py:79-89` `ensure_propstream_table` is dead code (only referenced by a test asserting it *isn't* called). Delete.
- `wow/dbutil.py:36-37` re-reads SQL files from disk per request — memoize. Also mutable default `params: Dict = {}` (:30).
- `project/settings.py:16-25`: the no-dotenv fallback doesn't strip quotes, so `SECRET_KEY="..."` differs between envs depending on whether python-dotenv is installed. Strip matched quotes or require dotenv.

**Rough thoughts:** None urgent alone; together they're an afternoon of cleanup that removes several classes of confusing failure.

=== ISSUE ===
TITLE: [ops] Django production hardening: secure cookies/HSTS, ALLOWED_HOSTS wildcard default, health-endpoint leak, unserved admin
LABELS: audit,backend,devops,P1
BODY:
**Lens:** Backend + DevOps audit · **Severity: Medium**

- No `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, or HSTS in `project/settings.py`, while the full Django admin is mounted (`project/urls.py:6`) and TLS terminates at a proxy (`SECURE_PROXY_SSL_HEADER` set). `manage.py check --deploy` would flag all of this.
- `docker-compose.prod.yml:36` defaults `ALLOWED_HOSTS=${ALLOWED_HOSTS:-*}` with `USE_X_FORWARDED_HOST=True` — Host-header spoofing/cache-poisoning surface if the env var is ever missing. Fail closed instead.
- `/api/health/` returns `str(e)` on DB failure (`wow/views.py:876-878`) — psycopg2 messages embed host/port/db/user. Return a static string.
- Admin has no STATIC_ROOT/collectstatic and its default DB is an ephemeral in-image sqlite (settings.py:105) that resets each deploy. Either remove `django.contrib.admin` + auth middleware (less surface), or serve it properly with a persistent store.

**Rough thoughts:** I'd remove the admin entirely — nothing in the API path needs it, and it deletes attack surface plus the static/sqlite questions in one move.

=== ISSUE ===
TITLE: [ops] Remove stale deploy artifacts (CircleCI, Procfile, runtime.txt), align Python/Node versions, fix or drop the nginx profile
LABELS: audit,devops,P2
BODY:
**Lens:** DevOps audit · **Severity: Medium**

- `.circleci/config.yml` still pulls `justfixnyc/wow-ci:latest` and deploys `master` to a **Cloudflare Pages** project that `deploy.md` says is not the live app. If CircleCI is still connected, pushes trigger a conflicting stale deploy; if not, it's misleading dead config. Delete `.circleci/`.
- `Procfile` + `runtime.txt` (python-3.10.14) are Heroku leftovers; nothing deploys there. Meanwhile dev `Dockerfile` = Python 3.10/Node 16, `Dockerfile.prod` = 3.11, CI = 3.11, frontend build = Node 20. Align on 3.11/Node 20 or document the split.
- The `with-nginx` failover profile mounts `nginx/nginx.conf` with placeholder `YOUR_DOMAIN` cert paths (won't start) and probes `/health` while the app serves `/api/health/` (would 404) — a landmine for exactly the emergency it exists for. Parameterize + fix, or delete.

**Rough thoughts:** Pure debt-clearing, but this stuff is what makes a project feel sharp vs abandoned when you (or a collaborator) return in six months.

=== ISSUE ===
TITLE: [ops] Nothing produces the DB dumps that dev deploys depend on — add scheduled pg_dump with retention
LABELS: audit,devops,P1
BODY:
**Lens:** DevOps audit · **Severity: High** (adds mechanism to TODO's "automate backups")

`scripts/bootstrap_dev_db_from_latest_dump.sh:44-53` restores the newest `/backup-pool/dump/wow-backups/wow-*.dump` and hard-fails if none exists, and `.github/workflows/deploy-dev.yml:231` runs it on every dev deploy. But no script in the repo *creates* those dumps — `pg_dump` appears only in docs as a manual command. So dev provisioning depends on a human remembering to back up, and prod has no automated backup at all.

**Fix:** Scheduled `pg_dump -Fc` (cron/systemd timer or compose sidecar) into the backup pool with retention + a periodic restore drill; this closes the backup gap and the dev-deploy coupling in one move.

**Rough thoughts:** TODO already wants backups "someday" — the new finding is that a *deploy path already depends on them existing*, which upgrades it from nice-to-have to load-bearing.
