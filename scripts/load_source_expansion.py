#!/usr/bin/env python3
"""
Load source expansion datasets (IHS, Woodstock, BOR) into Postgres.
This extends the supplemental data loader for the new source families.
"""
import argparse
import csv
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from csv_limits import set_max_csv_field_size_limit
from dbtool import DbContext
from load_audit import build_run_id, ensure_load_audit_table, record_load_audit


set_max_csv_field_size_limit()


@dataclass(frozen=True)
class DatasetSpec:
    name: str
    table: str
    csv_relpath: str
    sql_create_file: str
    columns: list[tuple[str, str, str]]


EXPANSION_DATASETS = [
    DatasetSpec(
        name="ihs_indicators",
        table="ihs_indicators",
        csv_relpath="normalized/ihs_indicators.csv",
        sql_create_file="create_ihs_tables.sql",
        columns=[
            ("indicator_slug", "indicator_slug", "text"),
            ("indicator_title", "indicator_title", "text"),
            ("property_type", "property_type", "text"),
            ("area_slug", "area_slug", "text"),
            ("geography_name", "geography_name", "text"),
            ("year", "year", "text"),
            ("value", "value", "numeric"),
            ("is_percentage", "is_percentage", "boolean"),
        ],
    ),
    DatasetSpec(
        name="bor_search_results",
        table="bor_search_results",
        csv_relpath="normalized/bor_search_results.csv",
        sql_create_file="create_bor_tables.sql",
        columns=[
            ("address", "address", "text"),
            ("pin", "pin", "text"),
            ("year", "year", "text"),
            ("prop_no", "prop_no", "text"),
            ("trunk_no", "trunk_no", "text"),
            ("seq_no", "seq_no", "text"),
            ("result_id", "result_id", "text"),
        ],
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load source expansion datasets into Postgres."
    )
    parser.add_argument(
        "--data-dir",
        default="data/supplemental-20260331",
        help="Directory containing the staged expansion data.",
    )
    parser.add_argument(
        "--dataset",
        choices=[d.name for d in EXPANSION_DATASETS],
        help="Load only a specific dataset.",
    )
    return parser.parse_args()


def run_sql_file(conn, sql_path: Path) -> None:
    sql = sql_path.read_text()
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)


def load_dataset(conn, data_dir: Path, spec: DatasetSpec, run_id: str) -> None:
    csv_path = data_dir / spec.csv_relpath
    if not csv_path.exists():
        print(f"Warning: {csv_path} not found, skipping {spec.name}")
        record_load_audit(
            conn,
            dataset_name=spec.name,
            table_name=spec.table,
            row_count=0,
            source_ref=str(csv_path),
            run_id=run_id,
            status="skipped",
            details={"reason": "source_csv_missing"},
        )
        return

    source_headers = [source for source, _, _ in spec.columns]
    dest_headers = [dest for _, dest, _ in spec.columns]
    column_sql = ",".join(dest_headers)

    try:
        with csv_path.open("r", newline="", encoding="utf-8", errors="replace") as src:
            reader = csv.DictReader(src)
            row_count = 0
            with tempfile.NamedTemporaryFile(
                mode="w+", newline="", encoding="utf-8"
            ) as filtered:
                writer = csv.DictWriter(filtered, fieldnames=dest_headers)
                writer.writeheader()
                for row in reader:
                    row_count += 1
                    writer.writerow(
                        {
                            dest: (row.get(source, "") or "").strip()
                            for source, dest in zip(source_headers, dest_headers)
                        }
                    )
                filtered.seek(0)
                with conn:
                    with conn.cursor() as cursor:
                        cursor.execute(f"TRUNCATE {spec.table}")
                        cursor.copy_expert(
                            f"COPY {spec.table} ({column_sql}) FROM STDIN WITH CSV HEADER",
                            filtered,
                        )
    except Exception as error:
        record_load_audit(
            conn,
            dataset_name=spec.name,
            table_name=spec.table,
            row_count=0,
            source_ref=str(csv_path),
            run_id=run_id,
            status="failed",
            details={"reason": "load_failed", "error": str(error)},
        )
        raise
    record_load_audit(
        conn,
        dataset_name=spec.name,
        table_name=spec.table,
        row_count=row_count,
        source_ref=str(csv_path),
        run_id=run_id,
        status="success",
    )
    print(f"Loaded {spec.name} from {csv_path}")


def load_woodstock_metadata(conn, data_dir: Path, run_id: str) -> None:
    """Load Woodstock metadata from JSON."""
    json_path = data_dir / "normalized" / "woodstock_metadata.json"
    if not json_path.exists():
        print(f"Warning: {json_path} not found, skipping woodstock metadata")
        record_load_audit(
            conn,
            dataset_name="woodstock_mortgage_metadata",
            table_name="woodstock_mortgage_metadata",
            row_count=0,
            source_ref=str(json_path),
            run_id=run_id,
            status="skipped",
            details={"reason": "source_json_missing"},
        )
        return

    try:
        # Run the create SQL first
        sql_path = ROOT_DIR / "sql" / "create_woodstock_tables.sql"
        run_sql_file(conn, sql_path)

        # Load metadata
        metadata = json.loads(json_path.read_text())

        with conn:
            with conn.cursor() as cursor:
                cursor.execute("TRUNCATE woodstock_mortgage_metadata")
                for item in metadata:
                    cursor.execute(
                        """
                        INSERT INTO woodstock_mortgage_metadata
                        (filename, year, sheet_name, sheet_range, row_count, column_count)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            item["filename"],
                            item["year"],
                            item["sheet_name"],
                            item["sheet_range"],
                            item["row_count"],
                            item["column_count"],
                        ),
                    )
    except Exception as error:
        record_load_audit(
            conn,
            dataset_name="woodstock_mortgage_metadata",
            table_name="woodstock_mortgage_metadata",
            row_count=0,
            source_ref=str(json_path),
            run_id=run_id,
            status="failed",
            details={"reason": "load_failed", "error": str(error)},
        )
        raise
    record_load_audit(
        conn,
        dataset_name="woodstock_mortgage_metadata",
        table_name="woodstock_mortgage_metadata",
        row_count=len(metadata),
        source_ref=str(json_path),
        run_id=run_id,
        status="success",
    )
    print(f"Loaded woodstock metadata from {json_path}")


def main() -> None:
    args = parse_args()
    root_dir = ROOT_DIR
    data_dir = (root_dir / args.data_dir).resolve()
    sql_dir = root_dir / "sql"
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")
    db = DbContext.from_url(database_url)
    conn = db.connection()
    run_id = build_run_id("expansion")
    ensure_load_audit_table(conn)

    datasets_to_load = [
        d for d in EXPANSION_DATASETS if not args.dataset or d.name == args.dataset
    ]

    # Run create SQL files
    create_files = []
    for spec in datasets_to_load:
        if spec.sql_create_file not in create_files:
            create_files.append(spec.sql_create_file)

    for sql_name in create_files:
        print(f"Running {sql_name}...")
        run_sql_file(conn, sql_dir / sql_name)

    # Load datasets
    for spec in datasets_to_load:
        load_dataset(conn, data_dir, spec, run_id)

    # Load Woodstock metadata separately (JSON-based, not CSV)
    if not args.dataset or args.dataset == "woodstock_mortgage_metadata":
        load_woodstock_metadata(conn, data_dir, run_id)


if __name__ == "__main__":
    main()
