# Project Audit — 2026-07-19

A full-project audit run from five role perspectives — backend developer,
frontend developer, DevOps/platform engineer, data engineer, and growth
engineer — each reviewing the codebase independently, then deduplicated
against `TODO.md` (which is already a strong backlog; nothing here repeats it
without adding new mechanism-level detail).

- **Issue drafts:** [`issues.md`](./issues.md) — 32 ready-to-file GitHub issues.
- **Filing script:** [`file_issues.sh`](./file_issues.sh) — files all of them
  via `gh` once Issues is enabled on the repo (Settings → General → Features).

## Executive summary

The project is in far better shape than most personal forks — real CI, a rate
limiting/CORS pass already done, PostGIS radius queries, an honest TODO. The
audit found the gaps are concentrated in four places:

1. **Two critical, fix-first items.**
   - Real people's names/home addresses (skip-trace exports) are committed to
     git and its history.
   - The core value prop — shell-company portfolio linking — is currently an
     exact-string `GROUP BY` on mailing name; the entire fuzzy-match graph
     engine inherited from JustFix is dead code. Everything else the product
     claims sits on top of this.

2. **Security controls that look done but don't hold.** Rate limiting is
   defeatable via spoofed `X-Forwarded-For` *and* void in prod (per-worker
   LocMemCache × 4 gunicorn workers). Admin token auth is non-constant-time,
   unthrottled, and silently falls back to the alerts token. CORS regexes are
   unanchored. CI lost every lint/typecheck/test gate in the CircleCI →
   GitHub Actions migration.

3. **Data-quality landmines that bias the headline numbers.** Violations/311
   counts are multiplied across condo PINs (a 20-unit building reports ~20× its
   violations); owners and parcels are fetched with mismatched city filters
   (silently dropping owner rows); loads TRUNCATE before validating (a
   header-only CSV wipes a table and logs "success"); Socrata `$offset` deep
   paging over 13.5M rows skips/duplicates with no dedupe key.

4. **A dark growth surface.** The SPA serves an empty div — all 160k property
   pages are invisible to Google and link unfurlers; there's no sitemap; the
   methodology page still describes New York; every analytics tag belongs to
   JustFix (one is a dead UA property); the primary property page has no share
   button even though a working share component exists in the legacy view.

## Suggested sequencing

| Phase | Items | Why |
|---|---|---|
| This week | PII purge · admin-token/CORS/rate-limit fixes · CI gates | Cheap, high-risk-reduction, and the PII rewrite gets worse with every commit |
| Next | Portfolio linking engine · violations dedupe · owner/parcel filter alignment · staging-swap loads | Makes the data trustworthy — prerequisite for showing it to anyone |
| Then | Prerender + sitemap · methodology rewrite · own analytics · share affordances | Growth work, in dependency order (SEO before sharing polish) |
| Ongoing | Frontend toolchain migration (Vite/React 18) · dead-dep removal · ops debt clearing | Enabling work; batch opportunistically |

## Creative external data ideas (Chicago)

The ask: what data would make this *more* than an ownership lookup — in the
spirit of "tree-planting data to predict when a street blooms." Ranked
roughly by mission-fit × feasibility. Most are on the Chicago/Cook County
open data portals with PINs, addresses, or lat/lon — the pipeline already
knows how to ingest exactly this shape.

**Directly mission-reinforcing (landlord accountability):**
- **Building Code Scofflaw List + Problem Landlord List** (City of Chicago,
  published datasets): the city's own "worst landlords" designations. Joining
  these to portfolios is a headline feature — "this owner has 3 buildings on
  the scofflaw list" — and pure credibility since it's the city's judgment.
- **Cook County eviction filings** (Circuit Court / Eviction Lab): per-address
  eviction pressure over time; the NYC original treats evictions as a core
  signal and the Chicago fork currently has nothing.
- **Cook County Assessor appeals + assessment history**: owners who
  aggressively appeal assessments while racking up violations tell a story;
  also predicts *future* tax-pressure on tenants (assessment spikes precede
  rent pushes).
- **TIF districts + city land sales**: overlay public subsidy flowing to the
  same owners the tool tracks — organizer catnip.
- **Chicago energy benchmarking** (buildings ≥50k sq ft, public by ordinance):
  energy grades per building → "this landlord's portfolio averages an F" and a
  proxy for deferred maintenance.
- **Lead service line inventory** (Chicago DWM) and **lead paint violations**:
  block-level health risk tied to buildings/owners; high organizing salience.

**Quality-of-life / "flora bloom" class (neighborhood texture and future-cast):**
- **Chicago tree inventory + 311 tree plantings** (Chicago Bureau of Forestry
  / OpenTreeMap derivatives): species + planting date per location → a bloom
  calendar per block ("the honey locusts on this street leaf out mid-May; 40
  new trees planted 2025 will mature canopy by ~2032"). Exactly the original
  idea, and it's real data.
- **311 rodent-baiting requests**: the classic proxy for building neglect at
  block granularity — pairs beautifully with per-owner rollups.
- **CTA/Divvy proximity + planned expansions** (Red Line Extension, RPM):
  "transit future" score per parcel — where access is about to improve.
- **Basement-flooding 311 calls + FEMA claims by zip**: chronic water issues
  by block; a renter's question no listing site answers.
- **New construction/demolition permits** (already partially ingested):
  trend per block → early gentrification/displacement-pressure signal, which
  is the organizer-facing framing of "what will this street look like."
- **Landmark districts + zoning changes** (Chicago Cityscape-style): predicts
  both protection and development pressure.

**Wildcard:** ward + alderperson per parcel (trivial spatial join) so every
property page says *who to call* — turns lookup into action, which is the
whole point of the tool.

## Sources

Full role reports were generated by five independent review passes on
2026-07-19; findings were verified against code (file:line refs in each
issue) before inclusion.
