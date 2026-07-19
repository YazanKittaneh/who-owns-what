#!/usr/bin/env python3
"""
Build Kimball-specific enrichment prep files from nearby owner export.

Outputs:
- a prioritized business-target CSV for vendor/manual lookup
- a prefilled import-template CSV with blank phone/email values ready to complete
"""

import argparse
import csv
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]


BUSINESS_HINTS = (
    "llc",
    "inc",
    "corp",
    "corporation",
    "properties",
    "property",
    "management",
    "plaza",
    "gateway",
    "associates",
    "homes",
    "walgreens",
    "trust",
    "estate",
    "attention",
    "tax dept",
    "company",
    "co ",
)


def is_business_name(name: str) -> bool:
    lowered = (name or "").strip().lower()
    return any(token in lowered for token in BUSINESS_HINTS)


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Kimball enrichment prep files")
    parser.add_argument(
        "--summary-csv",
        default="data/exports/nearby-owner-outreach/3137-n-kimball-ave-nearby-owner-summary.csv",
    )
    parser.add_argument(
        "--out-dir",
        default="data/exports/nearby-owner-outreach",
    )
    args = parser.parse_args()

    summary_csv = (ROOT_DIR / args.summary_csv).resolve()
    out_dir = (ROOT_DIR / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    lookup_csv = out_dir / "3137-n-kimball-ave-business-targets.csv"
    import_csv = out_dir / "3137-n-kimball-ave-enrichment-import-template.csv"

    rows = []
    with summary_csv.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            owner_name = normalize_name(row.get("owner_name", ""))
            if not owner_name:
                continue
            row["owner_name"] = owner_name
            rows.append(row)

    business_rows = [row for row in rows if is_business_name(row["owner_name"])]

    with lookup_csv.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "owner_name",
            "owner_id",
            "nearest_distance_m",
            "parcel_count",
            "mailing_address",
            "mailing_city",
            "mailing_state",
            "mailing_zip",
            "parcels",
            "recommended_lookup",
            "notes",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in business_rows:
            writer.writerow(
                {
                    "owner_name": row["owner_name"],
                    "owner_id": row.get("owner_id", ""),
                    "nearest_distance_m": row.get("nearest_distance_m", ""),
                    "parcel_count": row.get("parcel_count", ""),
                    "mailing_address": row.get("mailing_address", ""),
                    "mailing_city": row.get("mailing_city", ""),
                    "mailing_state": row.get("mailing_state", ""),
                    "mailing_zip": row.get("mailing_zip", ""),
                    "parcels": row.get("parcels", ""),
                    "recommended_lookup": "Bizapedia, OpenCorporates, manual call/research",
                    "notes": "Prioritized because owner name looks like business/landlord entity",
                }
            )

    with import_csv.open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "pin",
            "entity_name",
            "contact_type",
            "contact_value",
            "source_system",
            "source_record_id",
            "confidence_score",
            "is_primary",
            "is_verified",
            "verification_method",
            "notes",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in business_rows:
            parcel_entries = [
                entry for entry in (row.get("parcels", "").split(" | ")) if entry
            ]
            for parcel_entry in parcel_entries:
                pin = parcel_entry.split(":", 1)[0]
                for contact_type in ("phone", "email"):
                    writer.writerow(
                        {
                            "pin": pin,
                            "entity_name": row["owner_name"],
                            "contact_type": contact_type,
                            "contact_value": "",
                            "source_system": "manual_verified",
                            "source_record_id": "",
                            "confidence_score": "95",
                            "is_primary": "true",
                            "is_verified": "true",
                            "verification_method": "manual",
                            "notes": f"Target parcel {parcel_entry}; fill from Bizapedia/OpenCorporates/manual research",
                        }
                    )

    print(f"Wrote {lookup_csv}")
    print(f"Wrote {import_csv}")
    print(f"Business targets: {len(business_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
