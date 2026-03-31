#!/usr/bin/env python3
import os
import sys

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dbtool import DbContext


QUERIES = [
    (
        "table_counts",
        """
        SELECT
            (SELECT count(*) FROM chi_tax_sale_annual) AS chi_tax_sale_annual,
            (SELECT count(*) FROM chi_tax_sale_scavenger) AS chi_tax_sale_scavenger,
            (SELECT count(*) FROM chi_recorder_documents) AS chi_recorder_documents,
            (SELECT count(*) FROM chi_business_owners) AS chi_business_owners,
            (SELECT count(*) FROM chi_business_licenses) AS chi_business_licenses,
            (SELECT count(*) FROM wow_tax_sale_summary) AS wow_tax_sale_summary,
            (SELECT count(*) FROM wow_recorder_summary) AS wow_recorder_summary,
            (SELECT count(*) FROM wow_business_linkage_summary) AS wow_business_linkage_summary
        """,
    ),
    (
        "tax_sale_examples",
        """
        SELECT p.address, p.pin, s.tax_sale_event_count, s.latest_tax_sale_year, s.latest_tax_sale_buyer_name
        FROM wow_tax_sale_summary AS s
        JOIN wow_parcels AS p USING (pin)
        WHERE s.tax_sale_event_count > 0
        ORDER BY s.tax_sale_event_count DESC, s.latest_tax_sale_year DESC NULLS LAST
        LIMIT 10
        """,
    ),
    (
        "recorder_examples",
        """
        SELECT p.address, p.pin, r.recorder_doc_count, r.mortgage_doc_count, r.latest_mortgage_amount
        FROM wow_recorder_summary AS r
        JOIN wow_parcels AS p USING (pin)
        WHERE r.recorder_doc_count > 0
        ORDER BY r.recorder_doc_count DESC, r.latest_recorder_doc_date DESC NULLS LAST
        LIMIT 10
        """,
    ),
    (
        "business_linkage_examples",
        """
        SELECT p.address, p.pin, b.business_name_match_count, b.business_address_match_count, b.matched_business_names[1:5]
        FROM wow_business_linkage_summary AS b
        JOIN wow_parcels AS p USING (pin)
        WHERE b.business_name_match_count > 0 OR b.business_address_match_count > 0
        ORDER BY b.business_name_match_count DESC, b.business_address_match_count DESC
        LIMIT 10
        """,
    ),
]


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("Please define DATABASE_URL in the environment.")
    db = DbContext.from_url(database_url)
    conn = db.connection()
    with conn:
        with conn.cursor() as cursor:
            for name, sql in QUERIES:
                print(f"\n## {name}")
                cursor.execute(sql)
                rows = cursor.fetchall()
                for row in rows:
                    print(row)


if __name__ == "__main__":
    main()
