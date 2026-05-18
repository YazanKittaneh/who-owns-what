#!/usr/bin/env python3
"""Find nearby parcels from a PIN or address search."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Find nearby parcels for a Chicago parcel")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--pin", help="Seed parcel PIN")
    target.add_argument("--address", help="Address search text, matched with ILIKE")
    parser.add_argument("--radius-m", type=int, default=500, help="Search radius in meters")
    parser.add_argument("--limit", type=int, default=200, help="Maximum nearby parcels to print")
    return parser.parse_args()


def get_seed(cursor, pin: str | None, address: str | None) -> tuple:
    if pin:
        cursor.execute(
            """
            SELECT pin, address, lat, lng
            FROM wow_parcels
            WHERE pin = %s
              AND lat IS NOT NULL
              AND lng IS NOT NULL
            LIMIT 1
            """,
            [pin],
        )
    else:
        cursor.execute(
            """
            SELECT pin, address, lat, lng
            FROM wow_parcels
            WHERE address ILIKE %s
              AND lat IS NOT NULL
              AND lng IS NOT NULL
            ORDER BY CASE WHEN address ILIKE %s THEN 0 ELSE 1 END, address, pin
            LIMIT 1
            """,
            [f"%{address}%", f"{address}%"],
        )

    seed = cursor.fetchone()
    if not seed:
        raise SystemExit("No mapped seed parcel found.")
    return seed


def main() -> int:
    args = parse_args()
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    conn = DbContext.from_url(database_url).connection()
    with conn.cursor() as cursor:
        seed_pin, seed_address, seed_lat, seed_lng = get_seed(cursor, args.pin, args.address)
        cursor.execute(
            """
            SELECT pin, address,
                   round(
                       6371000 * acos(
                           LEAST(
                               1,
                               GREATEST(
                                   -1,
                                   cos(radians(%s)) * cos(radians(lat)) * cos(radians(lng) - radians(%s))
                                   + sin(radians(%s)) * sin(radians(lat))
                               )
                           )
                       )
                   )::integer AS distance_m
            FROM wow_parcels
            WHERE pin <> %s
              AND lat IS NOT NULL
              AND lng IS NOT NULL
              AND lat BETWEEN %s - (%s::numeric / 111320.0)
                          AND %s + (%s::numeric / 111320.0)
              AND lng BETWEEN %s - (%s::numeric / (111320.0 * GREATEST(cos(radians(%s)), 0.01)))
                          AND %s + (%s::numeric / (111320.0 * GREATEST(cos(radians(%s)), 0.01)))
            ORDER BY distance_m ASC, address ASC, pin ASC
            LIMIT %s
            """,
            [
                seed_lat,
                seed_lng,
                seed_lat,
                seed_pin,
                seed_lat,
                args.radius_m,
                seed_lat,
                args.radius_m,
                seed_lng,
                args.radius_m,
                seed_lat,
                seed_lng,
                args.radius_m,
                seed_lat,
                args.limit,
            ],
        )
        rows = [row for row in cursor.fetchall() if row[2] <= args.radius_m]

    print(f"Seed: {seed_pin} {seed_address}")
    print(f"Found {len(rows)} nearby parcels within {args.radius_m}m")
    for pin, address, distance_m in rows:
        print(f"{distance_m}m\t{pin}\t{address}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
