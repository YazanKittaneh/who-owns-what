# Ops Runbook

Last validated: 2026-04-09

This runbook is the canonical repo-specific guide for refreshing data, validating the build, checking coverage, and recovering from common failure modes.

## Current State

- Core, supplemental, and expansion refreshes are separate commands.
- All loaders now write `data_load_audit` rows with `success`, `skipped`, or `failed` status.
- `/api/health/` and token-protected `/api/admin/data-coverage` are the quickest runtime verification endpoints.

## Desired State

- One documented refresh sequence.
- Consistent audits across all loaders.
- Clear smoke checks and recovery steps.

## Required Changes

- Extend loader audits beyond expansion datasets.
- Protect admin endpoints before exposing them more broadly.
- Add automated data-quality checks and smoke tests.

## Preconditions

- `DATABASE_URL` must be set.
- `ADMIN_API_TOKEN` should be set for admin-only API access. If omitted, the app falls back to `ALERTS_API_TOKEN`.
- For Socrata fetches, `SOCRATA_APP_TOKEN` is recommended.
- Ensure enough free disk exists before deep-history fetches, especially for `chi_311` and `chi_owners`.
- In the production Docker stack, use one-off `docker compose ... run -v "$PWD/data:/app/data" api ...` refreshes because `.dockerignore` excludes `data/` from the image.

## Standard Refresh Sequence

### 1. Refresh core Chicago CSVs

```bash
python scripts/fetch_chi_data.py --output-dir data
```

Owner-history examples:

```bash
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years latest --output-dir data
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years 2024-2026 --output-dir data
python scripts/fetch_chi_data.py --datasets chi_owners --chi-owners-years all --output-dir data
```

The fetcher warns when you request `all` years or large bounded ranges. Prefer bounded ranges first and use `--resume` for interrupted backfills.

### 2. Rebuild core DB objects

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api python dbtool.py builddb --update
```

This rebuilds the objects defined by `who-owns-what.yml`, including:

- `wow_parcels`
- `wow_portfolios`
- `wow_indicators`
- `wow_indicatorhistory_monthly`
- SQL functions used by the address APIs

### 3. Load supplemental package

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api python scripts/load_supplemental_data.py --data-dir data/supplemental-20260329
```

### 4. Refresh and load expansion datasets

```bash
python scripts/fetch_source_expansion.py --output-dir data/supplemental-20260331
python scripts/parse_ihs_html.py
python scripts/extract_woodstock_metadata.py
python scripts/scrape_bor_decisions.py
docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api python scripts/load_source_expansion.py --data-dir data/supplemental-20260331
```

## Validation Commands

### Backend and data

```bash
pytest
black --check .
flake8
mypy .
```

### Frontend

```bash
yarn --cwd client build
yarn --cwd client test --watchAll=false
yarn --cwd client typecheck
yarn --cwd client prettier:check
```

### Runtime smoke checks

```bash
curl http://127.0.0.1:8000/api/health/
curl 'http://127.0.0.1:8000/api/address/search?q=118%20n%20clark'
curl 'http://127.0.0.1:8000/api/address?pin=<PIN_FROM_SEARCH>'
curl 'http://127.0.0.1:8000/api/address/indicatorhistory?pin=<PIN_FROM_SEARCH>'
curl -H "Authorization: Token $ADMIN_API_TOKEN" http://127.0.0.1:8000/api/admin/data-coverage
```

## How To Inspect Data Coverage

- Primary endpoint: `GET /api/admin/data-coverage`
- Verify:
  - table presence
  - row counts
  - min and max year for datasets with time coverage
  - `data_load_audit` entries for core, supplemental, and expansion datasets
  - explicit missing or partial reasons for blocked sources

## How To Verify Freshness

- Check the latest timestamps returned by `/api/admin/data-coverage`.
- Inspect the newest `data_load_audit` rows and confirm the latest `run_id` includes the expected core, supplemental, and expansion loader batches.
- Cross-check staged files in `data/` and `data/supplemental-*` with the refresh run you just executed.
- For IHS, verify that `wow/sql/address_indicatorhistory_chi_with_ihs.sql` is still the active Chicago timeline path.

## Recovery Steps

### Core build fails during `builddb`

- Confirm `DATABASE_URL` is correct.
- Check that raw CSVs exist in `data/`.
- Re-run the failed source fetch for the affected dataset.
- Re-run the mounted one-off rebuild command for `dbtool.py builddb --update`.

### Supplemental load fails

- Confirm the expected files exist under `data/supplemental-20260329/`.
- Re-run the mounted one-off supplemental loader command.
- If only summaries need rebuild, use `--summaries-only`.

### Expansion load fails

- Check whether the normalized files exist under `data/supplemental-20260331/normalized/`.
- Re-run the relevant normalization step.
- Re-run the mounted one-off expansion loader command.
- Inspect `data_load_audit` for `success` vs `skipped` rows.

### Timeline loses IHS data

- Confirm `ihs_indicators` exists and is populated.
- Confirm the API is still using `wow/sql/address_indicatorhistory_chi_with_ihs.sql`.
- If the table is missing, Chicago timeline should fall back to `wow/sql/address_indicatorhistory_chi.sql`.

## Common Issues

| Symptom | Likely cause | Check |
|---|---|---|
| Empty address search from WoW tables | Derived tables missing | confirm `wow_parcels` exists; fallback search should still work |
| Missing recorder or tax-sale columns in address responses | Supplemental summaries not loaded | rerun `load_supplemental_data.py` |
| No IHS metrics in timeline | `ihs_indicators` missing or stale | rerun expansion load and coverage check |
| Coverage endpoint returns 401 | missing or wrong `ADMIN_API_TOKEN` | retry with `Authorization: Token $ADMIN_API_TOKEN` |
| Chicago UI shows NYC concepts | frontend still using legacy fields and copy | audit `UsefulLinks.tsx`, `PortfolioTable.tsx`, `PortfolioFilters.tsx`, `IndicatorsDatasets.tsx` |

## Production Docker Commands

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  psql -U wow -d wow -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python dbtool.py builddb --update

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python scripts/load_supplemental_data.py --data-dir data/supplemental-20260329

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python scripts/load_source_expansion.py --data-dir data/supplemental-20260331
```

## Notes

- The current health endpoint is `/api/health/`, not `/health/`.
- This task does not change data placement, backup paths, or retention behavior, so `docs/data-storage-map.md` did not require an update.
