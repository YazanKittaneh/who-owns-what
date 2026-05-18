# Nearby Owner Outreach Exports

This directory contains curated nearby-owner exports that are intentionally kept in git even though generated data exports are ignored by default.

## Layout

Use one folder per searched address, named with the lowercase address slug:

```text
nearby-owner-outreach/
├── 833-w-newport-ave/
│   ├── nearby-owner-contacts.csv
│   ├── nearby-owner-summary.csv
│   └── owners-250m-propstream-no-apn.csv
└── 1443-w-berteau-ave/
    ├── nearby-owner-contacts.csv
    ├── nearby-owner-summary.csv
    └── owners-250m-propstream-no-apn.csv
```

## Conventions

1. Keep searched-address exports grouped in their address slug folder.
2. Use `nearby-owner-contacts.csv` for parcel/contact detail exports.
3. Use `nearby-owner-summary.csv` for grouped owner summaries.
4. Use `*-propstream-no-apn.csv` for PropStream-formatted uploads that intentionally omit APN/PIN columns.
5. Force-add only curated exports that need to be shared through git; leave ad hoc/generated exports ignored.
