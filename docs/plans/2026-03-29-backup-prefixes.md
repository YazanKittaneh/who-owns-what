# Backup Prefixes

## Purpose

Record the MinIO backup prefixes currently holding Who Owns What CSV snapshots and database dumps.

## Bucket

- `wow-backups`

## Prefixes

### `20260328T045133Z`

- MinIO prefix: `wow-backups/who-owns-what/20260328T045133Z`
- Contents:
  - repo CSV snapshot under `data/`
  - test CSVs under `tests/data/`
  - no full-city refresh; this is the earlier partial snapshot backup

### `20260329T033249Z`

- MinIO prefix: `wow-backups/who-owns-what/20260329T033249Z`
- Contents:
  - full refreshed CSV snapshot under `data/`
  - test CSVs under `tests/data/`
  - PostgreSQL dump under `db/wow-20260329T033249Z.dump`
- Verified size at backup time:
  - about `9.5 GiB`
  - `22` objects

## Notes

- The `20260329T033249Z` backup is the one aligned with the full-city rebuild currently running in production.
- Future backups should follow the same timestamped prefix format.
