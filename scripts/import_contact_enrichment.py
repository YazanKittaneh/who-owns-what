#!/usr/bin/env python3
"""
Import manually verified or commercial landlord contact enrichment from CSV.

Expected columns:
- entity_name or owner_name (optional if pin is provided and wow_parcels has owner_name)
- pin (optional)
- contact_type (phone, email, website, mailing_address)
- contact_value
- source_system (optional; defaults to manual_verified)
- source_record_id (optional)
- confidence_score (optional)
- is_primary (optional; true/false)
- is_verified (optional; defaults to true for manual_verified)
- verification_method (optional)
- notes (optional)
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext
from load_audit import build_run_id, ensure_load_audit_table, record_load_audit


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y"}


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def ensure_contact_schema(conn) -> None:
    sql_dir = ROOT_DIR / "sql"
    with conn.cursor() as cursor:
        cursor.execute((sql_dir / "create_contact_tables.sql").read_text())
        cursor.execute((sql_dir / "create_contact_functions.sql").read_text())
        cursor.execute((sql_dir / "create_contact_integration.sql").read_text())
    conn.commit()


def lookup_owner_name_for_pin(cursor, pin: str) -> str | None:
    cursor.execute(
        """
        SELECT owner_name
        FROM wow_parcels
        WHERE pin = %s
        LIMIT 1
        """,
        [pin],
    )
    row = cursor.fetchone()
    return row[0] if row and row[0] else None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import landlord contact enrichment from CSV"
    )
    parser.add_argument("csv_path", help="Path to enrichment CSV")
    parser.add_argument(
        "--default-source-system",
        default="manual_verified",
        help="Default source system when the CSV omits source_system",
    )
    parser.add_argument(
        "--automated",
        action="store_true",
        help="Disable row-level audit logging for this import session",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate rows without writing changes",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_path).resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")

    conn = DbContext.from_url(database_url).connection()
    ensure_contact_schema(conn)
    ensure_load_audit_table(conn)
    run_id = build_run_id("contact_enrichment_import")

    stats = {
        "rows_read": 0,
        "rows_loaded": 0,
        "rows_skipped": 0,
        "entities_resolved": 0,
        "parcel_links_created": 0,
        "contact_rows_upserted": 0,
        "source_system": args.default_source_system,
        "dry_run": args.dry_run,
        "automated": args.automated,
    }

    try:
        with conn.cursor() as cursor, csv_path.open(
            "r", newline="", encoding="utf-8-sig"
        ) as handle:
            if args.automated:
                cursor.execute(
                    "SELECT set_config('wow.contact_audit_enabled', 'off', true)"
                )

            reader = csv.DictReader(handle)
            required = {"contact_type", "contact_value"}
            missing = required.difference(set(reader.fieldnames or []))
            if missing:
                raise ValueError(
                    f"Missing required columns: {', '.join(sorted(missing))}"
                )

            for row in reader:
                stats["rows_read"] += 1

                pin = clean(row.get("pin"))
                entity_name = clean(row.get("entity_name")) or clean(
                    row.get("owner_name")
                )
                if not entity_name and pin:
                    entity_name = lookup_owner_name_for_pin(cursor, pin)

                contact_type = clean(row.get("contact_type"))
                contact_value = clean(row.get("contact_value"))
                source_system = (
                    clean(row.get("source_system")) or args.default_source_system
                )
                source_record_id = clean(row.get("source_record_id"))
                verification_method = clean(row.get("verification_method")) or (
                    "manual" if source_system == "manual_verified" else None
                )
                notes = clean(row.get("notes"))
                confidence_score = clean(row.get("confidence_score"))

                if not entity_name or not contact_type or not contact_value:
                    stats["rows_skipped"] += 1
                    continue

                cursor.execute(
                    "SELECT resolve_canonical_entity(%s, classify_entity_type(%s), %s, TRUE)",
                    [entity_name, entity_name, source_system],
                )
                entity_id = cursor.fetchone()[0]
                stats["entities_resolved"] += 1

                if pin and not args.dry_run:
                    cursor.execute(
                        "SELECT map_entity_to_parcel(%s, %s, %s, %s, %s)",
                        [entity_id, pin, entity_name, 90, source_system],
                    )
                    stats["parcel_links_created"] += 1

                if not args.dry_run:
                    cursor.execute(
                        """
                        SELECT upsert_entity_contact(
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                        """,
                        [
                            entity_id,
                            contact_type,
                            contact_value,
                            source_system,
                            source_record_id,
                            int(confidence_score) if confidence_score else None,
                            parse_bool(row.get("is_primary"), False),
                            parse_bool(
                                row.get("is_verified"),
                                source_system == "manual_verified",
                            ),
                            verification_method,
                            "contact_enrichment_csv",
                            contact_type,
                            json.dumps({"pin": pin} if pin else {}),
                            notes,
                        ],
                    )
                    stats["contact_rows_upserted"] += 1

                stats["rows_loaded"] += 1

        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()

        record_load_audit(
            conn,
            dataset_name="contact_enrichment_import",
            table_name="entity_contacts",
            row_count=stats["contact_rows_upserted"],
            source_ref=str(csv_path),
            run_id=run_id,
            status="success",
            details=stats,
        )

        print(json.dumps(stats, indent=2))
        return 0
    except Exception as exc:
        conn.rollback()
        record_load_audit(
            conn,
            dataset_name="contact_enrichment_import",
            table_name="entity_contacts",
            row_count=0,
            source_ref=str(csv_path),
            run_id=run_id,
            status="failed",
            details={"error": str(exc), **stats},
        )
        raise


if __name__ == "__main__":
    raise SystemExit(main())
