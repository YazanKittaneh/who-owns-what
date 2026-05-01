# Data Storage Map

Last updated: 2026-04-12

## Purpose

This file tracks where WoW data files and backups live, what is local vs pooled storage,
and what to clean up after refresh runs.

## Current Storage Layout

### Active data path

- Repo data root: `/root/who-owns-what/data`
- Primary loaded CSVs live in this directory (for local processing and DB loads).

### Backup pool path

- Pool mount: `/backup-pool`
- Backup root: `/backup-pool/dump/wow-backups`
- DB dumps now live on pool storage.
- Weekly staging archive lives on pool storage.

## Directory Trees

### `/root/who-owns-what/data`

```text
/root/who-owns-what/data
├── exports/
│   └── nearby-owner-outreach/
├── fetch-smoke/
├── full-refresh-20260328/
├── mvp/
├── normalized/
├── pre-full-refresh-20260328/
├── supplemental-20260329/
├── supplemental-20260331/
├── weekly-refresh-staging -> /backup-pool/dump/wow-backups/staging/weekly-refresh-staging
├── chi_311.csv
├── chi_foreclosed_rental_properties.csv
├── chi_geographies.csv
├── chi_owners.csv
├── chi_parcels.csv
├── chi_permits.csv
└── chi_violations.csv
```

### `/backup-pool/dump/wow-backups`

```text
/backup-pool/dump/wow-backups
├── staging/
│   └── weekly-refresh-staging/
│       ├── chi_owners.csv
│       ├── chi_parcels.csv
│       ├── chi_foreclosed_rental_properties.csv
│       ├── chi_permits.csv
│       └── chi_violations.csv
├── wow-20260328T045133Z.dump
└── wow-20260329T033249Z.dump
```

## Conventions

1. Keep backups on pool storage, not root disk.
2. Keep only active/needed source files on root disk.
3. Move stale staging artifacts to pool storage.
4. Delete stale `.tmp` and `.progress` files after interrupted fetches.
5. Keep generated outreach exports under `data/exports/nearby-owner-outreach/` so they are easy to prune or move to pooled storage later.

## Update Checklist (Required)

Update this file whenever any of the following changes:

- a backup location/path changes
- a staging location/path changes
- new large data directories are introduced
- retention policy changes
- symlinks between local and pool paths change

When updating this file:

1. Refresh both trees above.
2. Update `Last updated` date.
3. Add/remove affected files/paths in the conventions/checklist.
