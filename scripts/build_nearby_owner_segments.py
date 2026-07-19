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


def split_mailing_address(value: str | None) -> tuple[str, str]:
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text:
        return "", ""

    patterns = [
        r"^(.*?)(?:\s+#\s*([A-Z0-9-]+))$",
        r"^(.*?)(?:\s+(APT|UNIT|STE|SUITE|FL|FLOOR)\s*#?\s*([A-Z0-9-]+.*))$",
    ]
    for pattern in patterns:
        match = re.match(pattern, text, re.IGNORECASE)
        if not match:
            continue
        if len(match.groups()) == 2:
            address, unit = match.groups()
        else:
            address = match.group(1)
            unit = " ".join([part for part in match.groups()[1:] if part])
        return address.strip(), unit.strip()

    return text, ""


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
    parcel_base = normalize_street_base(
        get_primary_parcel_address(row.get("parcels", ""))
    )
    return bool(mailing_base and parcel_base and mailing_base != parcel_base)


def is_entity_owner(owner_name: str) -> bool:
    normalized = f" {normalize_text(owner_name)} "
    return any(token in normalized for token in ENTITY_TOKENS)


def build_reason(
    row: dict[str, str],
    absentee_flag: bool,
    entity_flag: bool,
    multi_parcel_flag: bool,
    out_of_state_flag: bool,
) -> str:
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
    investor_reason = build_reason(
        row, absentee_flag, entity_flag, multi_parcel_flag, out_of_state_flag
    )
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


def get_primary_pin(parcels: str) -> str:
    first = (parcels or "").split(" | ")[0]
    if ":" in first:
        return first.split(":", 1)[0].strip()
    return ""


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def build_simple_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    simple_rows = []
    for row in rows:
        address, unit = split_mailing_address(row.get("mailing_address", ""))
        simple_rows.append(
            {
                "Address": address,
                "Unit#": unit,
                "City": row.get("mailing_city", ""),
                "State": row.get("mailing_state", ""),
                "Zip": row.get("mailing_zip", ""),
                "County": "Cook",
                "FIPS": "17031",
                "APN#": get_primary_pin(row.get("parcels", "")),
            }
        )
    return simple_rows


def dedupe_simple_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str, str, str, str], dict[str, str]] = {}
    grouped_apns: dict[tuple[str, str, str, str, str], list[str]] = {}

    for row in rows:
        key = (
            row.get("Address", "").strip().upper(),
            row.get("Unit#", "").strip().upper(),
            row.get("City", "").strip().upper(),
            row.get("State", "").strip().upper(),
            row.get("Zip", "").strip(),
        )
        if key not in grouped:
            grouped[key] = row.copy()
            grouped_apns[key] = []

        apn = row.get("APN#", "").strip()
        if apn and apn not in grouped_apns[key]:
            grouped_apns[key].append(apn)

    deduped_rows = []
    for key, row in grouped.items():
        row["APN#"] = " | ".join(grouped_apns[key])
        deduped_rows.append(row)

    return deduped_rows


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
    combined_rows = []
    seen_owner_keys: set[str] = set()
    for row in absentee_rows + likely_investor_rows:
        owner_key = row.get("owner_key", "")
        if owner_key in seen_owner_keys:
            continue
        seen_owner_keys.add(owner_key)
        combined_rows.append(row)

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

    write_csv(
        out_dir / f"{base_name}-absentee-owners.csv", absentee_rows, enriched_fields
    )
    write_csv(
        out_dir / f"{base_name}-likely-investors.csv",
        likely_investor_rows,
        enriched_fields,
    )
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
    write_csv(
        out_dir / f"{base_name}-absentee-owners-simple.csv",
        build_simple_rows(absentee_rows),
        ["Address", "Unit#", "City", "State", "Zip", "County", "FIPS", "APN#"],
    )
    write_csv(
        out_dir / f"{base_name}-likely-investors-simple.csv",
        build_simple_rows(likely_investor_rows),
        ["Address", "Unit#", "City", "State", "Zip", "County", "FIPS", "APN#"],
    )
    combined_simple_rows = build_simple_rows(combined_rows)
    write_csv(
        out_dir / f"{base_name}-combined-simple.csv",
        combined_simple_rows,
        ["Address", "Unit#", "City", "State", "Zip", "County", "FIPS", "APN#"],
    )
    write_csv(
        out_dir / f"{base_name}-combined-simple-deduped.csv",
        dedupe_simple_rows(combined_simple_rows),
        ["Address", "Unit#", "City", "State", "Zip", "County", "FIPS", "APN#"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
