#!/usr/bin/env python3
import argparse
import csv
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
class SupplementalDatasetSpec:
    name: str
    table: str
    csv_relpath: str
    sql_create_file: str
    columns: list[tuple[str, str, str]]


SUPPLEMENTAL_DATASETS = [
    SupplementalDatasetSpec(
        name="chi_tax_sale_annual",
        table="chi_tax_sale_annual",
        csv_relpath="tax/treasurer_annual_tax_sale.csv",
        sql_create_file="create_tax_sale_tables.sql",
        columns=[
            ("Tax Sale Year", "tax_sale_year", "text"),
            ("PIN", "pin", "text"),
            ("Classification", "classification", "text"),
            ("Township Name", "township_name", "text"),
            ("Sold at Sale", "sold_at_sale", "text"),
            ("Tax Amount Offered", "tax_amount_offered", "numeric"),
            ("Penalty Amount Offered", "penalty_amount_offered", "numeric"),
            (
                "Total Tax and Penalty Amount Offered",
                "total_tax_and_penalty_amount_offered",
                "numeric",
            ),
            ("Cost", "cost", "numeric"),
            ("Total Amount Paid", "total_amount_paid", "numeric"),
            ("Total Amount Forfeited", "total_amount_forfeited", "numeric"),
            ("Winning Bid Percent", "winning_bid_percent", "numeric"),
            ("Buyer Name", "buyer_name", "text"),
            ("location_1", "location_1", "text"),
        ],
    ),
    SupplementalDatasetSpec(
        name="chi_tax_sale_scavenger",
        table="chi_tax_sale_scavenger",
        csv_relpath="tax/treasurer_scavenger_tax_sale.csv",
        sql_create_file="create_tax_sale_tables.sql",
        columns=[
            ("Tax Sale Year", "tax_sale_year", "text"),
            ("PIN", "pin", "text"),
            ("From Year", "from_year", "text"),
            ("To Year", "to_year", "text"),
            ("Total Amount Paid", "total_amount_paid", "numeric"),
            ("Sold at Sale", "sold_at_sale", "text"),
            ("VOL", "vol", "text"),
            ("Township Name", "township_name", "text"),
            ("Buyer Number", "buyer_number", "text"),
            ("Buyer Name", "buyer_name", "text"),
            ("location_1", "location_1", "text"),
        ],
    ),
    SupplementalDatasetSpec(
        name="chi_recorder_documents",
        table="chi_recorder_documents",
        csv_relpath="recorder/recorder_foreclosures_mortgages_quitclaim_2013_2015.csv",
        sql_create_file="create_recorder_tables.sql",
        columns=[
            ("PIN", "pin", "text"),
            ("Document Number", "document_number", "text"),
            ("Document Type", "document_type", "text"),
            ("Recorded Date", "recorded_date", "text"),
            ("Execution Date", "execution_date", "text"),
            ("Consideration Amount", "consideration_amount", "numeric"),
            ("Street", "street", "text"),
            ("City", "city", "text"),
            ("State", "state", "text"),
            ("Zip code", "zip_code", "text"),
            ("Location", "location", "text"),
        ],
    ),
    SupplementalDatasetSpec(
        name="chi_business_owners",
        table="chi_business_owners",
        csv_relpath="corporate/chicago_business_owners.csv",
        sql_create_file="create_business_linkage_tables.sql",
        columns=[
            ("Account Number", "account_number", "text"),
            ("Legal Name", "legal_name", "text"),
            ("Owner First Name", "owner_first_name", "text"),
            ("Owner Middle Initial", "owner_middle_initial", "text"),
            ("Owner Last Name", "owner_last_name", "text"),
            ("Suffix", "suffix", "text"),
            ("Legal Entity Owner", "legal_entity_owner", "text"),
            ("Title", "title", "text"),
        ],
    ),
    SupplementalDatasetSpec(
        name="chi_business_licenses",
        table="chi_business_licenses",
        csv_relpath="corporate/chicago_business_licenses.csv",
        sql_create_file="create_business_linkage_tables.sql",
        columns=[
            ("ID", "id", "text"),
            ("LICENSE ID", "license_id", "text"),
            ("ACCOUNT NUMBER", "account_number", "text"),
            ("SITE NUMBER", "site_number", "text"),
            ("LEGAL NAME", "legal_name", "text"),
            ("DOING BUSINESS AS NAME", "doing_business_as_name", "text"),
            ("ADDRESS", "address", "text"),
            ("CITY", "city", "text"),
            ("STATE", "state", "text"),
            ("ZIP CODE", "zip_code", "text"),
            ("WARD", "ward", "text"),
            ("PRECINCT", "precinct", "text"),
            ("WARD PRECINCT", "ward_precinct", "text"),
            ("POLICE DISTRICT", "police_district", "text"),
            ("COMMUNITY AREA", "community_area", "text"),
            ("COMMUNITY AREA NAME", "community_area_name", "text"),
            ("NEIGHBORHOOD", "neighborhood", "text"),
            ("LICENSE CODE", "license_code", "text"),
            ("LICENSE DESCRIPTION", "license_description", "text"),
            ("BUSINESS ACTIVITY ID", "business_activity_id", "text"),
            ("BUSINESS ACTIVITY", "business_activity", "text"),
            ("LICENSE NUMBER", "license_number", "text"),
            ("APPLICATION TYPE", "application_type", "text"),
            ("APPLICATION CREATED DATE", "application_created_date", "text"),
            (
                "APPLICATION REQUIREMENTS COMPLETE",
                "application_requirements_complete",
                "text",
            ),
            ("PAYMENT DATE", "payment_date", "text"),
            ("CONDITIONAL APPROVAL", "conditional_approval", "text"),
            ("LICENSE TERM START DATE", "license_term_start_date", "text"),
            (
                "LICENSE TERM EXPIRATION DATE",
                "license_term_expiration_date",
                "text",
            ),
            (
                "LICENSE APPROVED FOR ISSUANCE",
                "license_approved_for_issuance",
                "text",
            ),
            ("DATE ISSUED", "date_issued", "text"),
            ("LICENSE STATUS", "license_status", "text"),
            ("LICENSE STATUS CHANGE DATE", "license_status_change_date", "text"),
            ("SSA", "ssa", "text"),
            ("LATITUDE", "latitude", "numeric"),
            ("LONGITUDE", "longitude", "numeric"),
            ("LOCATION", "location", "text"),
        ],
    ),
]

SUMMARY_SQL_FILES = [
    "create_tax_sale_summary.sql",
    "create_recorder_summary.sql",
    "create_business_linkage_summary.sql",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load supplemental WOW datasets into Postgres.")
    parser.add_argument(
        "--data-dir",
        default="data/supplemental-20260329",
        help="Directory containing the staged supplemental CSVs.",
    )
    parser.add_argument(
        "--summaries-only",
        action="store_true",
        help="Skip raw CSV loads and only rebuild the derived WOW supplemental summaries.",
    )
    return parser.parse_args()


def run_sql_file(conn, sql_path: Path) -> None:
    sql = sql_path.read_text()
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)


def load_dataset(conn, data_dir: Path, spec: SupplementalDatasetSpec, run_id: str) -> None:
    csv_path = data_dir / spec.csv_relpath
    if not csv_path.exists():
        record_load_audit(
            conn,
            dataset_name=spec.name,
            table_name=spec.table,
            row_count=0,
            source_ref=str(csv_path),
            run_id=run_id,
            status="failed",
            details={"reason": "source_csv_missing"},
        )
        raise FileNotFoundError(f"Missing CSV for {spec.name}: {csv_path}")

    source_headers = [source for source, _, _ in spec.columns]
    dest_headers = [dest for _, dest, _ in spec.columns]
    column_sql = ",".join(dest_headers)

    try:
        with csv_path.open("r", newline="", encoding="utf-8", errors="replace") as src:
            reader = csv.DictReader(src)
            row_count = 0
            with tempfile.NamedTemporaryFile(mode="w+", newline="", encoding="utf-8") as filtered:
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
        details={"loader": "supplemental"},
    )
    print(f"Loaded {spec.name} from {csv_path}")


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
    run_id = build_run_id("supplemental")
    ensure_load_audit_table(conn)

    create_files = []
    for spec in SUPPLEMENTAL_DATASETS:
        if spec.sql_create_file not in create_files:
            create_files.append(spec.sql_create_file)

    if not args.summaries_only:
        for sql_name in create_files:
            print(f"Running {sql_name}...")
            run_sql_file(conn, sql_dir / sql_name)

        for spec in SUPPLEMENTAL_DATASETS:
            load_dataset(conn, data_dir, spec, run_id)

    for sql_name in SUMMARY_SQL_FILES:
        print(f"Running {sql_name}...")
        run_sql_file(conn, sql_dir / sql_name)


if __name__ == "__main__":
    main()
