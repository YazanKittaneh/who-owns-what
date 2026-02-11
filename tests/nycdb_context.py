import os
from pathlib import Path
import csv
import tempfile

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
        self.builder.build(force_refresh=True)


def nycdb_ctx(get_cursor):
    """
    Yield a Chicago DB context whose data directory is
    a temporary directory.
    """

    with tempfile.TemporaryDirectory() as dirname:
        yield ChiDbContext(dirname, get_cursor)
