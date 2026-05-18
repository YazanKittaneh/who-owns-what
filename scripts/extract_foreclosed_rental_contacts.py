#!/usr/bin/env python3
"""
Load contact data from chi_foreclosed_rental_properties using SQL-first bulk operations.
"""

import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext
from load_audit import build_run_id, ensure_load_audit_table, record_load_audit


def apply_contact_sql(conn, sql_dir: Path) -> None:
    with conn.cursor() as cursor:
        cursor.execute((sql_dir / "create_contact_tables.sql").read_text())
        cursor.execute((sql_dir / "create_contact_functions.sql").read_text())
        cursor.execute((sql_dir / "create_contact_integration.sql").read_text())
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Load contacts from chi_foreclosed_rental_properties with SQL-first bulk operations."
    )
    parser.add_argument(
        "--link-parcels",
        action="store_true",
        help="Kept for compatibility. Parcel mapping is included in the SQL load.",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    db = DbContext.from_url(database_url)
    conn = db.connection()
    sql_dir = ROOT_DIR / "sql"

    print("Ensuring contact schema is up to date...")
    apply_contact_sql(conn, sql_dir)

    run_id = build_run_id("contact_ingest_foreclosed_rental")
    ensure_load_audit_table(conn)

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT to_regclass('chi_foreclosed_rental_properties')")
            if cursor.fetchone()[0] is None:
                raise RuntimeError(
                    "chi_foreclosed_rental_properties table is missing. Run scripts/fetch_chi_data.py and dbtool.py builddb first."
                )

            cursor.execute("SELECT COUNT(*) FROM chi_foreclosed_rental_properties")
            if cursor.fetchone()[0] == 0:
                raise RuntimeError(
                    "chi_foreclosed_rental_properties has no rows. Fetch and load the source dataset before contact ingestion."
                )

            cursor.execute("SELECT * FROM load_foreclosed_rental_contacts(NULL)")
            inserted_entities, inserted_aliases, inserted_contacts, inserted_mappings = cursor.fetchone()
        conn.commit()

        details = {
            "mode": "sql_first",
            "inserted_entities": inserted_entities,
            "inserted_aliases": inserted_aliases,
            "inserted_contacts": inserted_contacts,
            "inserted_mappings": inserted_mappings,
            "link_parcels_flag": args.link_parcels,
        }

        record_load_audit(
            conn,
            dataset_name="contact_ingest_foreclosed_rental",
            table_name="entity_contacts",
            row_count=inserted_contacts,
            source_ref="chi_foreclosed_rental_properties",
            run_id=run_id,
            status="success",
            details=details,
        )

        print("=" * 60)
        print("FORECLOSED RENTAL CONTACT LOAD COMPLETE")
        print("=" * 60)
        print(f"Inserted entities: {inserted_entities:,}")
        print(f"Inserted aliases: {inserted_aliases:,}")
        print(f"Inserted contacts: {inserted_contacts:,}")
        print(f"Inserted parcel mappings: {inserted_mappings:,}")
        return 0
    except Exception as exc:
        conn.rollback()
        record_load_audit(
            conn,
            dataset_name="contact_ingest_foreclosed_rental",
            table_name="entity_contacts",
            row_count=0,
            source_ref="chi_foreclosed_rental_properties",
            run_id=run_id,
            status="failed",
            details={"error": str(exc), "mode": "sql_first"},
        )
        raise


if __name__ == "__main__":
    raise SystemExit(main())
