#!/usr/bin/env python3
"""
Run a low-cost targeted business-license pilot for parcels near a target PIN.
"""

import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext


def find_nearby_pins(conn, target_pin: str, radius_m: int) -> list[str]:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            WITH target AS (
                SELECT lat, lng
                FROM wow_parcels
                WHERE pin = %s
            )
            SELECT wp.pin
            FROM wow_parcels wp, target t
            WHERE ST_DWithin(
                ST_SetSRID(ST_MakePoint(wp.lng, wp.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)::geography,
                %s
            )
            ORDER BY ST_Distance(
                ST_SetSRID(ST_MakePoint(wp.lng, wp.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)::geography
            )
            """,
            (target_pin, radius_m),
        )
        return [row[0] for row in cursor.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run targeted SQL pilot for nearby parcels."
    )
    parser.add_argument("--target-pin", default="13262040080000")
    parser.add_argument("--radius", type=int, default=500)
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    conn = DbContext.from_url(database_url).connection()

    nearby_pins = find_nearby_pins(conn, args.target_pin, args.radius)
    if not nearby_pins:
        raise SystemExit(f"No nearby parcels found for {args.target_pin}")

    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT * FROM load_business_license_contacts(%s)", (nearby_pins,)
        )
        (
            inserted_entities,
            inserted_aliases,
            inserted_contacts,
            inserted_mappings,
        ) = cursor.fetchone()

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM entity_parcel_mappings
            WHERE pin = ANY(%s)
              AND source_system = 'chi_business_licenses_address_link'
            """,
            (nearby_pins,),
        )
        total_existing_mappings = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT ce.canonical_name, epm.mapping_confidence, ec.contact_value
            FROM entity_parcel_mappings epm
            JOIN canonical_entities ce ON ce.id = epm.entity_id
            LEFT JOIN entity_contacts ec
              ON ec.entity_id = ce.id
             AND ec.contact_type = 'mailing_address'
             AND ec.source_system = 'chi_business_licenses'
            WHERE epm.pin = %s
              AND epm.source_system = 'chi_business_licenses_address_link'
            ORDER BY epm.mapping_confidence DESC, ce.canonical_name
            LIMIT 5
            """,
            (args.target_pin,),
        )
        sample_rows = cursor.fetchall()

    conn.commit()

    print("=" * 60)
    print("TARGETED BUSINESS LICENSE PILOT")
    print("=" * 60)
    print(f"Target PIN: {args.target_pin}")
    print(f"Radius: {args.radius}m")
    print(f"Nearby parcels considered: {len(nearby_pins):,}")
    print(f"Inserted entities: {inserted_entities:,}")
    print(f"Inserted aliases: {inserted_aliases:,}")
    print(f"Inserted contacts: {inserted_contacts:,}")
    print(f"Inserted mappings: {inserted_mappings:,}")
    print(f"Existing mappings in pilot area: {total_existing_mappings:,}")

    if sample_rows:
        print("Sample rows for target parcel:")
        for name, confidence, address in sample_rows:
            print(f"  {name} | {confidence}% | {address or 'no address'}")
    else:
        print("No business-license mappings on the target parcel.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
