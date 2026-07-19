# Nearby Owner Outreach Exports

This directory holds generated nearby-owner exports. As of 2026-07-19 these
exports are **no longer tracked in git** (see issue #6): they contain real
individuals' names, mailing addresses, and skip-trace contact columns, and
PropStream-derived contact data cannot be redistributed under their terms.

The files remain usable locally — `.gitignore` excludes `data/exports/` and
`data/**/*.csv`, so nothing here will be committed again. Do not force-add
exports; store anything that needs to survive a machine loss on the backup
pool (`/backup-pool/`), not in git.

## Layout

One folder per searched address, named with the lowercase address slug:

```text
nearby-owner-outreach/
└── 833-w-newport-ave/
    ├── nearby-owner-contacts.csv
    ├── nearby-owner-summary.csv
    └── owners-250m-propstream-no-apn.csv
```

## Conventions

1. Keep searched-address exports grouped in their address slug folder.
2. Use `nearby-owner-contacts.csv` for parcel/contact detail exports.
3. Use `nearby-owner-summary.csv` for grouped owner summaries.
4. Use `*-propstream-no-apn.csv` for PropStream-formatted uploads that
   intentionally omit APN/PIN columns.

## History note

These exports were previously committed, so they persist in git history until
a history rewrite is run. See `docs/audit/2026-07-19/purge-pii-history.md`.
