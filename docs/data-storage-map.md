# Data Storage Map

Last updated: 2026-05-18

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
- Fresh dev DB volumes bootstrap from the newest `wow-*.dump` in this backup root.

## Directory Trees

### `/root/who-owns-what/data`

```text
/root/who-owns-what/data
├── exports/
│   └── nearby-owner-outreach/
│       ├── README.md
│       ├── 1443-w-berteau-ave/
│       │   ├── nearby-owner-contacts.csv
│       │   ├── nearby-owner-summary.csv
│       │   └── owners-250m-propstream-no-apn.csv
│       ├── 2436-n-albany-ave/
│       │   ├── absentee-owners-simple.csv
│       │   ├── absentee-owners.csv
│       │   ├── combined-simple-deduped.csv
│       │   ├── combined-simple.csv
│       │   ├── likely-investors-simple.csv
│       │   ├── likely-investors.csv
│       │   ├── mailing-list-ready.csv
│       │   ├── nearby-owner-contacts.csv
│       │   └── nearby-owner-summary.csv
│       ├── 3134-n-kimball-ave/
│       │   ├── nearby-owner-contacts.csv
│       │   ├── nearby-owner-simple.csv
│       │   └── nearby-owner-summary.csv
│       ├── 3137-n-kimball-ave/
│       │   ├── business-targets.csv
│       │   ├── enrichment-import-template.csv
│       │   ├── nearby-owner-contacts.csv
│       │   └── nearby-owner-summary.csv
│       ├── 833-w-newport-ave/
│       │   ├── nearby-owner-contacts.csv
│       │   ├── nearby-owner-summary.csv
│       │   └── owners-250m-propstream-no-apn.csv
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
├── chi_owners.csv.tmp
├── chi_parcels.csv
├── chi_permits.csv
├── chi_violations.csv
├── kimball_nearby_landlords.csv
└── Property Export 2436+N+Albany+Prospecting.xlsx
```

### `/backup-pool/dump/wow-backups`

```text
/backup-pool/dump/wow-backups
├── staging/
│   └── weekly-refresh-staging/
│       ├── chi_311.csv.progress
│       ├── chi_311.csv.tmp
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
5. Keep curated outreach exports under `data/exports/nearby-owner-outreach/<searched-address-slug>/` so they are easy to prune or move to pooled storage later. Generated/ad hoc exports remain ignored unless they are intentionally force-added.
6. Keep at least one recent `wow-*.dump` at the backup-root top level so fresh dev DB volumes can auto-restore.
7. PropStream uploads can be staged from `data/` and imported into the runtime `propstream_parcel_records` table keyed by normalized PIN/APN.

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
