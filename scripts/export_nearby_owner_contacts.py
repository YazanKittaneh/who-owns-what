#!/usr/bin/env python3
"""
Export nearby owner contact data for a target parcel.

Outputs:
- a detailed parcel-contact CSV
- a grouped owner summary CSV
"""

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext


NEARBY_SQL = """
WITH seed AS (
    SELECT pin, address, lat, lng, owner_id, owner_name
    FROM wow_parcels
    WHERE pin = %s
      AND lat IS NOT NULL
      AND lng IS NOT NULL
), candidates AS (
    SELECT
        p.pin,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.owner_id,
        p.owner_name,
        p.mailing_address,
        p.mailing_city,
        p.mailing_state,
        p.mailing_zip,
        (
            6371000 * acos(
                LEAST(
                    1,
                    GREATEST(
                        -1,
                        cos(radians(s.lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(s.lng))
                        + sin(radians(s.lat)) * sin(radians(p.lat))
                    )
                )
            )
        ) AS distance_m,
        (
            (coalesce(p.owner_id, '') <> '' AND p.owner_id = s.owner_id)
            OR (coalesce(p.owner_name, '') <> '' AND p.owner_name = s.owner_name)
        ) AS same_owner
    FROM wow_parcels p
    CROSS JOIN seed s
    WHERE p.pin <> s.pin
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN s.lat - (%s::numeric / 111320.0)
                    AND s.lat + (%s::numeric / 111320.0)
      AND p.lng BETWEEN s.lng - (%s::numeric / (111320.0 * GREATEST(cos(radians(s.lat)), 0.01)))
                    AND s.lng + (%s::numeric / (111320.0 * GREATEST(cos(radians(s.lat)), 0.01)))
)
SELECT pin, address, city, state, zip, owner_id, owner_name, mailing_address, mailing_city,
       mailing_state, mailing_zip, round(distance_m)::integer AS distance_m, same_owner
FROM candidates
WHERE distance_m <= %s
ORDER BY same_owner DESC, distance_m ASC, address ASC, pin ASC
LIMIT %s
"""


def normalize_lookup_value(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", value.lower()).strip())


def build_contact(
    contact_type: str,
    contact_value: str,
    confidence: int,
    source: str,
    is_verified: bool,
) -> dict:
    return {
        "type": contact_type,
        "value": contact_value,
        "confidence": confidence,
        "source": source,
        "is_verified": is_verified,
    }


def get_seed(conn, pin: str) -> dict:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT pin, address, owner_name FROM wow_parcels WHERE pin = %s LIMIT 1",
            [pin],
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"PIN not found: {pin}")
        return {"pin": row[0], "address": row[1], "owner_name": row[2]}


def get_nearby_rows(conn, pin: str, radius_m: int, limit: int) -> list[dict]:
    with conn.cursor() as cursor:
        cursor.execute(
            NEARBY_SQL, [pin, radius_m, radius_m, radius_m, radius_m, radius_m, limit]
        )
        cols = [desc[0] for desc in cursor.description]
        rows = [dict(zip(cols, row)) for row in cursor.fetchall()]

    owner_name_keys = sorted(
        {
            normalize_lookup_value(row.get("owner_name"))
            for row in rows
            if row.get("owner_name")
        }
    )
    mailing_keys = sorted(
        {
            (row.get("mailing_address") or "").strip().lower()
            for row in rows
            if row.get("mailing_address")
        }
    )

    contacts_by_owner: dict[str, list[dict]] = defaultdict(list)
    contacts_by_mailing: dict[str, list[dict]] = defaultdict(list)

    with conn.cursor() as cursor:
        if owner_name_keys:
            cursor.execute(
                """
                SELECT DISTINCT ea.normalized_alias, ec.contact_type, ec.contact_value,
                                ec.confidence_score, ec.source_system, ec.is_verified
                FROM entity_aliases ea
                JOIN entity_contacts ec ON ec.entity_id = ea.entity_id
                WHERE ea.normalized_alias = ANY(%s)
                ORDER BY ea.normalized_alias, ec.confidence_score DESC, ec.contact_value ASC
                """,
                [owner_name_keys],
            )
            for (
                normalized_alias,
                contact_type,
                contact_value,
                confidence_score,
                source_system,
                is_verified,
            ) in cursor.fetchall():
                contacts_by_owner[normalized_alias].append(
                    build_contact(
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        bool(is_verified),
                    )
                )

        if mailing_keys:
            cursor.execute(
                """
                SELECT DISTINCT normalized_value, contact_type, contact_value,
                                confidence_score, source_system, is_verified
                FROM entity_contacts
                WHERE normalized_value = ANY(%s)
                ORDER BY normalized_value, confidence_score DESC, contact_value ASC
                """,
                [mailing_keys],
            )
            for (
                normalized_value,
                contact_type,
                contact_value,
                confidence_score,
                source_system,
                is_verified,
            ) in cursor.fetchall():
                contacts_by_mailing[normalized_value].append(
                    build_contact(
                        contact_type,
                        contact_value,
                        confidence_score,
                        source_system,
                        bool(is_verified),
                    )
                )

    enriched = []
    for row in rows:
        contacts = []
        seen = set()
        mailing_parts = [
            row.get("mailing_address"),
            row.get("mailing_city"),
            row.get("mailing_state"),
            row.get("mailing_zip"),
        ]
        mailing_full = ", ".join([part for part in mailing_parts if part])
        if mailing_full:
            contact = build_contact(
                "mailing_address", mailing_full, 80, "wow_parcels_owner_record", True
            )
            contacts.append(contact)
            seen.add((contact["type"], contact["value"], contact["source"]))

        owner_key = normalize_lookup_value(row.get("owner_name"))
        mailing_key = (row.get("mailing_address") or "").strip().lower()
        for contact in contacts_by_owner.get(owner_key, []) + contacts_by_mailing.get(
            mailing_key, []
        ):
            dedupe = (contact["type"], contact["value"], contact["source"])
            if dedupe in seen:
                continue
            seen.add(dedupe)
            contacts.append(contact)

        enriched.append({**row, "contacts": contacts})
    return enriched


def write_detail_csv(path: Path, seed: dict, rows: list[dict]) -> None:
    fieldnames = [
        "seed_pin",
        "seed_address",
        "nearby_pin",
        "nearby_address",
        "distance_m",
        "same_owner",
        "owner_name",
        "owner_id",
        "mailing_address",
        "mailing_city",
        "mailing_state",
        "mailing_zip",
        "contact_type",
        "contact_value",
        "confidence",
        "source",
        "is_verified",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            if row["contacts"]:
                for contact in row["contacts"]:
                    writer.writerow(
                        {
                            "seed_pin": seed["pin"],
                            "seed_address": seed["address"],
                            "nearby_pin": row["pin"],
                            "nearby_address": row["address"],
                            "distance_m": row["distance_m"],
                            "same_owner": row["same_owner"],
                            "owner_name": row["owner_name"],
                            "owner_id": row["owner_id"],
                            "mailing_address": row["mailing_address"],
                            "mailing_city": row["mailing_city"],
                            "mailing_state": row["mailing_state"],
                            "mailing_zip": row["mailing_zip"],
                            "contact_type": contact["type"],
                            "contact_value": contact["value"],
                            "confidence": contact["confidence"],
                            "source": contact["source"],
                            "is_verified": contact["is_verified"],
                        }
                    )
            else:
                writer.writerow(
                    {
                        "seed_pin": seed["pin"],
                        "seed_address": seed["address"],
                        "nearby_pin": row["pin"],
                        "nearby_address": row["address"],
                        "distance_m": row["distance_m"],
                        "same_owner": row["same_owner"],
                        "owner_name": row["owner_name"],
                        "owner_id": row["owner_id"],
                        "mailing_address": row["mailing_address"],
                        "mailing_city": row["mailing_city"],
                        "mailing_state": row["mailing_state"],
                        "mailing_zip": row["mailing_zip"],
                        "contact_type": "",
                        "contact_value": "",
                        "confidence": "",
                        "source": "",
                        "is_verified": "",
                    }
                )


def write_owner_summary_csv(path: Path, seed: dict, rows: list[dict]) -> None:
    grouped: dict = {}
    for row in rows:
        owner_key = row.get("owner_id") or row.get("owner_name") or row.get("pin")
        group = grouped.setdefault(
            owner_key,
            {
                "seed_pin": seed["pin"],
                "seed_address": seed["address"],
                "owner_key": owner_key,
                "owner_name": row.get("owner_name"),
                "owner_id": row.get("owner_id"),
                "nearest_distance_m": row.get("distance_m"),
                "parcel_count": 0,
                "same_owner": bool(row.get("same_owner")),
                "mailing_address": row.get("mailing_address"),
                "mailing_city": row.get("mailing_city"),
                "mailing_state": row.get("mailing_state"),
                "mailing_zip": row.get("mailing_zip"),
                "parcels": [],
                "phones": set(),
                "emails": set(),
                "other_contacts": set(),
            },
        )
        group["parcel_count"] += 1
        group["parcels"].append(f"{row['pin']}:{row['address']}")
        if group["nearest_distance_m"] is None or (
            row.get("distance_m") is not None
            and row["distance_m"] < group["nearest_distance_m"]
        ):
            group["nearest_distance_m"] = row["distance_m"]
        for contact in row["contacts"]:
            if contact["type"] == "phone":
                group["phones"].add(contact["value"])
            elif contact["type"] == "email":
                group["emails"].add(contact["value"])
            else:
                group["other_contacts"].add(f"{contact['type']}:{contact['value']}")

    fieldnames = [
        "seed_pin",
        "seed_address",
        "owner_key",
        "owner_name",
        "owner_id",
        "nearest_distance_m",
        "parcel_count",
        "same_owner",
        "mailing_address",
        "mailing_city",
        "mailing_state",
        "mailing_zip",
        "phones",
        "emails",
        "other_contacts",
        "parcels",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for group in sorted(
            grouped.values(),
            key=lambda item: (
                not item["same_owner"],
                item["nearest_distance_m"] or 10**9,
                -item["parcel_count"],
            ),
        ):
            writer.writerow(
                {
                    **{key: group[key] for key in fieldnames if key in group},
                    "phones": " | ".join(sorted(group["phones"])),
                    "emails": " | ".join(sorted(group["emails"])),
                    "other_contacts": " | ".join(sorted(group["other_contacts"])),
                    "parcels": " | ".join(group["parcels"]),
                }
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export nearby owner contacts for a target parcel"
    )
    parser.add_argument("--pin", default="13262040080000")
    parser.add_argument("--radius-m", type=int, default=250)
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument(
        "--out-dir",
        default="data/exports/nearby-owner-outreach",
        help="Directory for generated CSVs",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    out_dir = (ROOT_DIR / args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = DbContext.from_url(database_url).connection()
    seed = get_seed(conn, args.pin)
    rows = get_nearby_rows(conn, args.pin, args.radius_m, args.limit)

    slug = seed["address"].lower().replace(" ", "-")
    detail_path = out_dir / f"{slug}-nearby-owner-contacts.csv"
    summary_path = out_dir / f"{slug}-nearby-owner-summary.csv"

    write_detail_csv(detail_path, seed, rows)
    write_owner_summary_csv(summary_path, seed, rows)

    print(
        json.dumps(
            {
                "seed_pin": seed["pin"],
                "seed_address": seed["address"],
                "radius_m": args.radius_m,
                "rows_exported": len(rows),
                "detail_csv": str(detail_path),
                "summary_csv": str(summary_path),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
