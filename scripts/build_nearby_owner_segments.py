#!/usr/bin/env python3
"""
Build filtered nearby-owner CSVs from a summary export.

Outputs:
- absentee owners
- likely investors
- mailing-list-ready outreach rows
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


ENTITY_TOKENS = (
    " LLC",
    " L L C",
    " INC",
    " CORP",
    " CORPORATION",
    " TRUST",
    " LAND TRUST",
    " ASSOC",
    " ASSOCIATION",
    " CO ",
    " COMPANY",
    " LP",
    " LLP",
    " BANK",
)

SUFFIX_MAP = {
    " AVENUE": " AVE",
    " AV": " AVE",
    " STREET": " ST",
    " ROAD": " RD",
    " BOULEVARD": " BLVD",
    " PLACE": " PL",
    " DRIVE": " DR",
    " COURT": " CT",
}


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().upper())


def normalize_street_base(value: str | None) -> str:
    text = normalize_text(value)
    text = re.sub(r"\b(APT|UNIT|FL|FLOOR|STE|SUITE|#)\b.*$", "", text).strip()
    text = re.sub(r"[^A-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    for src, dest in SUFFIX_MAP.items():
        if text.endswith(src):
            text = text[: -len(src)] + dest
    return text


def get_primary_parcel_address(parcels: str) -> str:
    first = (parcels or "").split(" | ")[0]
    if ":" in first:
        return first.split(":", 1)[1].strip()
    return ""


def is_absentee(row: dict[str, str]) -> bool:
    mailing_address = row.get("mailing_address", "")
    if not mailing_address:
        return False
    mailing_base = normalize_street_base(mailing_address)
    parcel_base = normalize_street_base(get_primary_parcel_address(row.get("parcels", "")))
    return bool(mailing_base and parcel_base and mailing_base != parcel_base)


def is_entity_owner(owner_name: str) -> bool:
    normalized = f" {normalize_text(owner_name)} "
    return any(token in normalized for token in ENTITY_TOKENS)


def build_reason(row: dict[str, str], absentee_flag: bool, entity_flag: bool, multi_parcel_flag: bool, out_of_state_flag: bool) -> str:
    reasons: list[str] = []
    if absentee_flag:
        reasons.append("absentee")
    if entity_flag:
        reasons.append("entity_owner")
    if multi_parcel_flag:
        reasons.append("multi_parcel")
    if out_of_state_flag:
        reasons.append("out_of_state")
    return "|".join(reasons)


def enrich_row(row: dict[str, str]) -> dict[str, str]:
    absentee_flag = is_absentee(row)
    entity_flag = is_entity_owner(row.get("owner_name", ""))
    multi_parcel_flag = int(row.get("parcel_count") or 0) > 1
    out_of_state_flag = normalize_text(row.get("mailing_state")) not in {"", "IL"}
    investor_reason = build_reason(row, absentee_flag, entity_flag, multi_parcel_flag, out_of_state_flag)
    primary_property_address = get_primary_parcel_address(row.get("parcels", ""))
    return {
        **row,
        "primary_property_address": primary_property_address,
        "absentee_flag": "True" if absentee_flag else "False",
        "entity_flag": "True" if entity_flag else "False",
        "multi_parcel_flag": "True" if multi_parcel_flag else "False",
        "out_of_state_flag": "True" if out_of_state_flag else "False",
        "investor_reason": investor_reason,
    }


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def main() -> int:
    parser = argparse.ArgumentParser(description="Build nearby owner segment CSVs")
    parser.add_argument("summary_csv", help="Path to nearby-owner summary CSV")
    args = parser.parse_args()

    summary_path = Path(args.summary_csv).resolve()
    base_name = summary_path.name.removesuffix("-nearby-owner-summary.csv")
    out_dir = summary_path.parent

    with summary_path.open(newline="", encoding="utf-8") as handle:
        rows = [enrich_row(row) for row in csv.DictReader(handle)]

    absentee_rows = [row for row in rows if row["absentee_flag"] == "True"]
    likely_investor_rows = [row for row in rows if row["investor_reason"]]

    enriched_fields = [
        "seed_pin",
        "seed_address",
        "owner_key",
        "owner_name",
        "owner_id",
        "nearest_distance_m",
        "parcel_count",
        "same_owner",
        "primary_property_address",
        "mailing_address",
        "mailing_city",
        "mailing_state",
        "mailing_zip",
        "phones",
        "emails",
        "absentee_flag",
        "entity_flag",
        "multi_parcel_flag",
        "out_of_state_flag",
        "investor_reason",
        "other_contacts",
        "parcels",
    ]

    mailing_ready_rows = []
    for row in likely_investor_rows:
        mailing_ready_rows.append(
            {
                "owner_name": row.get("owner_name", ""),
                "mailing_address": row.get("mailing_address", ""),
                "mailing_city": row.get("mailing_city", ""),
                "mailing_state": row.get("mailing_state", ""),
                "mailing_zip": row.get("mailing_zip", ""),
                "property_address": row.get("primary_property_address", ""),
                "nearest_distance_m": row.get("nearest_distance_m", ""),
                "parcel_count": row.get("parcel_count", ""),
                "investor_reason": row.get("investor_reason", ""),
                "phones": row.get("phones", ""),
                "emails": row.get("emails", ""),
                "parcels": row.get("parcels", ""),
            }
        )

    write_csv(out_dir / f"{base_name}-absentee-owners.csv", absentee_rows, enriched_fields)
    write_csv(out_dir / f"{base_name}-likely-investors.csv", likely_investor_rows, enriched_fields)
    write_csv(
        out_dir / f"{base_name}-mailing-list-ready.csv",
        mailing_ready_rows,
        [
            "owner_name",
            "mailing_address",
            "mailing_city",
            "mailing_state",
            "mailing_zip",
            "property_address",
            "nearest_distance_m",
            "parcel_count",
            "investor_reason",
            "phones",
            "emails",
            "parcels",
        ],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
