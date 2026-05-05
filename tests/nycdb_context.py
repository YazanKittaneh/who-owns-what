import os
from pathlib import Path
import csv
import tempfile

EMPTY_TAX_SALE_SUMMARY_SQL = """
CREATE TABLE IF NOT EXISTS wow_tax_sale_summary (
    pin text PRIMARY KEY,
    annual_tax_sale_count bigint,
    scavenger_tax_sale_count bigint,
    tax_sale_event_count bigint,
    latest_tax_sale_year integer,
    latest_tax_sale_buyer_name text,
    latest_tax_sale_sold_at_sale boolean,
    total_tax_sale_amount_paid numeric
);
"""

EMPTY_RECORDER_SUMMARY_SQL = """
CREATE TABLE IF NOT EXISTS wow_recorder_summary (
    pin text PRIMARY KEY,
    recorder_doc_count bigint,
    mortgage_doc_count bigint,
    quitclaim_doc_count bigint,
    foreclosure_doc_count bigint,
    latest_recorder_doc_date date,
    latest_mortgage_date date,
    latest_mortgage_amount numeric,
    latest_quitclaim_date date,
    latest_quitclaim_amount numeric
);
"""

EMPTY_TAX_SALE_SOURCE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS chi_tax_sale_annual (
    pin text,
    tax_sale_year text,
    sold_at_sale text,
    buyer_name text,
    total_amount_paid numeric
);

CREATE TABLE IF NOT EXISTS chi_tax_sale_scavenger (
    pin text,
    tax_sale_year text,
    sold_at_sale text,
    buyer_name text,
    total_amount_paid numeric
);
"""

EMPTY_RECORDER_SOURCE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS chi_recorder_documents (
    pin text,
    document_type text,
    recorded_date text,
    execution_date text,
    consideration_amount numeric,
    document_number text
);
"""

import dbtool
from .generate_factory_from_csv import unmunge_colname

if "TEST_DATABASE_URL" in os.environ:
    TEST_DB_URL = os.environ["TEST_DATABASE_URL"]
else:
    TEST_DB_URL = os.environ["DATABASE_URL"] + "_test"

TEST_DB = dbtool.DbContext.from_url(TEST_DB_URL)


class ChiDbContext:
    """
    An object facilitating interactions with the Chicago test data loader.
    """

    def __init__(self, root_dir, get_cursor):
        self.root_dir = Path(root_dir)
        self.get_cursor = get_cursor
        self.builder = dbtool.ChiDbBuilder(
            TEST_DB,
            is_testing=True,
            data_dir=self.root_dir,
        )

    def load_dataset(self, name: str):
        """Load the given Chicago dataset into the database."""

        self.builder.ensure_dataset(name, force_refresh=True)

    def _write_csv_to_file(self, csvfile, namedtuples):
        header_row = [unmunge_colname(colname) for colname in namedtuples[0]._fields]
        writer = csv.writer(csvfile)
        writer.writerow(header_row)
        for row in namedtuples:
            writer.writerow(row)

    def write_csv(self, filename, namedtuples):
        """
        Write the given rows (as a list of named tuples) into
        the given CSV file in the NYCDB data directory.
        """

        path = self.root_dir / filename
        with path.open("w", newline="") as csvfile:
            self._write_csv_to_file(csvfile, namedtuples)

    def build_everything(self) -> None:
        """
        Load all the Chicago datasets required for Who Owns What,
        and then run all our custom SQL.
        """
        self.ensure_supplemental_source_tables()
        self.builder.build(force_refresh=True)
        self.ensure_summary_tables()

    def ensure_supplemental_source_tables(self) -> None:
        """Create empty supplemental source tables so summary SQL can run in isolated tests."""

        with TEST_DB.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(EMPTY_TAX_SALE_SOURCE_TABLES_SQL)
                cursor.execute(EMPTY_RECORDER_SOURCE_TABLE_SQL)

    def ensure_summary_tables(self) -> None:
        """Create empty summary tables required by runtime SQL when tests omit those source feeds."""

        with TEST_DB.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(EMPTY_TAX_SALE_SUMMARY_SQL)
                cursor.execute(EMPTY_RECORDER_SUMMARY_SQL)


def nycdb_ctx(get_cursor):
    """
    Yield a Chicago DB context whose data directory is
    a temporary directory.
    """

    with tempfile.TemporaryDirectory() as dirname:
        yield ChiDbContext(dirname, get_cursor)
