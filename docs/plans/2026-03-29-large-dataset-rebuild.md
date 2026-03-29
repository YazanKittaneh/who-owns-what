# Large Dataset Rebuild Plan

## Goal

Document the safe operational workflow for refreshing the full Chicago source CSVs and rebuilding WOW without exhausting local disk.

## What happened

- We successfully fetched the full upstream Socrata snapshots, including `chi_311` with more than 13 million rows.
- Rebuilding from inside the long-running `wow-api` container after copying the full CSVs into `/app/data` caused `psycopg2.errors.DiskFull`.
- The failure mode was not the SQL itself; it was duplicate storage. The host already held the large CSVs, and copying them into the container created a second large copy in Docker's writable layer.

## Implementation detail

For large dataset refreshes, do not copy the giant source files into the long-running `api` container before rebuilding. That duplicates the CSV storage in Docker's writable layer and can exhaust disk during the SQL build.

Instead, run the rebuild from a one-off `api` container with the host `data/` directory mounted into `/app/data`.

## Recommended workflow

1. Fetch the refreshed CSVs into a staging directory with the resumable Socrata fetcher.
2. Verify row counts and file sizes before replacing the active `data/chi_*.csv` files.
3. Swap the staged CSVs into the host `data/` directory.
4. Ensure `pg_trgm` exists in Postgres.
5. Run the rebuild from a one-off host-mounted container.
6. Verify row counts and a few live API queries.
7. Back up both the refreshed CSV snapshot and a fresh `pg_dump` to MinIO.

## Commands

Enable the required Postgres extension:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  psql -U wow -d wow -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
```

Run the large rebuild safely:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api python dbtool.py builddb --update
```

Verify the rebuilt database:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  psql -U wow -d wow -c "select (select count(*) from chi_parcels) as chi_parcels, (select count(*) from chi_owners) as chi_owners, (select count(*) from chi_permits) as chi_permits, (select count(*) from chi_violations) as chi_violations, (select count(*) from chi_311) as chi_311, (select count(*) from wow_parcels) as wow_parcels, (select count(*) from wow_portfolios) as wow_portfolios;"
```

## Why this is the default now

- It avoids duplicate multi-gigabyte CSV copies inside Docker.
- It preserves disk headroom for index creation and derived table builds.
- It works with the existing Compose setup without needing image rebuilds.
- It is easier to reason about because the source of truth stays on the host in `data/`.
