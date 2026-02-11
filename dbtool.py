import os
import sys
import argparse
import csv
import time
import yaml
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple, Iterable, Literal
from urllib.parse import urlparse

from portfoliograph.table import export_portfolios_table_json, populate_portfolios_table

try:
    from dotenv import load_dotenv

    load_dotenv()
    dotenv_loaded = False
except ModuleNotFoundError:
    dotenv_loaded = False


ROOT_DIR = Path(__file__).parent.resolve()
SQL_DIR = ROOT_DIR / "sql"
WOW_YML = yaml.full_load((ROOT_DIR / "who-owns-what.yml").read_text())
TESTS_DIR = ROOT_DIR / "tests"

# Just an alias for our database connection.
DbConnection = Any


class DbContext(tuple):
    host: str
    database: str
    user: str
    password: str
    port: int

    def __new__(cls, host: str, database: str, user: str, password: str, port: int):
        return super().__new__(cls, (host, database, user, password, port))

    @property
    def host(self) -> str:
        return self[0]

    @property
    def database(self) -> str:
        return self[1]

    @property
    def user(self) -> str:
        return self[2]

    @property
    def password(self) -> str:
        return self[3]

    @property
    def port(self) -> int:
        return self[4]

    @staticmethod
    def from_url(url: str) -> "DbContext":
        parsed = urlparse(url)
        if parsed.scheme != "postgres":
            raise ValueError("Database URL schema must be postgres")
        if parsed.username is None:
            raise ValueError("Database URL must have a username")
        if parsed.password is None:
            raise ValueError("Database URL must have a password")
        if parsed.hostname is None:
            raise ValueError("Database URL must have a hostname")
        database = parsed.path[1:]
        if not database:
            raise ValueError("Database URL must have a database name")
        port = parsed.port or 5432
        return DbContext(
            host=parsed.hostname,
            database=database,
            user=parsed.username,
            password=parsed.password,
            port=port,
        )

    def psycopg2_connect_kwargs(self) -> Dict[str, Any]:
        return dict(
            user=self.user,
            password=self.password,
            host=self.host,
            database=self.database,
            port=self.port,
        )

    def connection(self) -> DbConnection:
        import psycopg2

        tries_left = 5
        secs_between_tries = 2

        def connect():
            return psycopg2.connect(**self.psycopg2_connect_kwargs())

        while tries_left > 1:
            try:
                return connect()
            except psycopg2.OperationalError:
                print("Failed to connect to db, retrying...")
                time.sleep(secs_between_tries)
                tries_left -= 1
        return connect()

    def get_pg_env_and_args(self) -> Tuple[Dict[str, str], List[str]]:
        env = os.environ.copy()
        env["PGPASSWORD"] = self.password
        args = ["-h", self.host, "-p", str(self.port), "-U", self.user, "-d", self.database]
        return (env, args)


@dataclass(frozen=True)
class DatasetSpec:
    name: str
    table: str
    csv_filename: str
    columns: List[Tuple[str, str]]
    primary_key: str | None = None


DATASETS: Dict[str, DatasetSpec] = {
    "chi_parcels": DatasetSpec(
        name="chi_parcels",
        table="chi_parcels",
        csv_filename="chi_parcels.csv",
        columns=[
            ("pin", "text"),
            ("pin10", "text"),
            ("year", "text"),
            ("class", "text"),
            ("triad_name", "text"),
            ("triad_code", "text"),
            ("township_name", "text"),
            ("township_code", "text"),
            ("nbhd_code", "text"),
            ("tax_code", "text"),
            ("zip_code", "text"),
            ("lon", "text"),
            ("lat", "text"),
            ("x_3435", "text"),
            ("y_3435", "text"),
            ("census_block_group_geoid", "text"),
            ("census_block_geoid", "text"),
            ("census_congressional_district_geoid", "text"),
            ("census_congressional_district_num", "text"),
            ("census_county_subdivision_geoid", "text"),
            ("census_place_geoid", "text"),
            ("census_puma_geoid", "text"),
            ("census_school_district_elementary_geoid", "text"),
            ("census_school_district_secondary_geoid", "text"),
            ("census_school_district_unified_geoid", "text"),
            ("census_state_representative_geoid", "text"),
            ("census_state_representative_num", "text"),
            ("census_state_senate_geoid", "text"),
            ("census_state_senate_num", "text"),
            ("census_tract_geoid", "text"),
            ("census_zcta_geoid", "text"),
            ("census_data_year", "text"),
            ("census_acs5_congressional_district_geoid", "text"),
            ("census_acs5_congressional_district_num", "text"),
            ("census_acs5_county_subdivision_geoid", "text"),
            ("census_acs5_place_geoid", "text"),
            ("census_acs5_puma_geoid", "text"),
            ("census_acs5_school_district_elementary_geoid", "text"),
            ("census_acs5_school_district_secondary_geoid", "text"),
            ("census_acs5_school_district_unified_geoid", "text"),
            ("census_acs5_state_representative_geoid", "text"),
            ("census_acs5_state_representative_num", "text"),
            ("census_acs5_state_senate_geoid", "text"),
            ("census_acs5_state_senate_num", "text"),
            ("census_acs5_tract_geoid", "text"),
            ("census_acs5_data_year", "text"),
            ("cook_board_of_review_district_num", "text"),
            ("cook_board_of_review_district_data_year", "text"),
            ("cook_commissioner_district_num", "text"),
            ("cook_commissioner_district_data_year", "text"),
            ("cook_judicial_district_num", "text"),
            ("cook_judicial_district_data_year", "text"),
            ("cook_municipality_num", "text"),
            ("cook_municipality_name", "text"),
            ("cook_municipality_data_year", "text"),
            ("ward_num", "text"),
            ("ward_chicago_data_year", "text"),
            ("ward_evanston_data_year", "text"),
            ("chicago_community_area_num", "text"),
            ("chicago_community_area_name", "text"),
            ("chicago_community_area_data_year", "text"),
            ("chicago_industrial_corridor_num", "text"),
            ("chicago_industrial_corridor_name", "text"),
            ("chicago_industrial_corridor_data_year", "text"),
            ("chicago_police_district_num", "text"),
            ("chicago_police_district_data_year", "text"),
            ("econ_coordinated_care_area_num", "text"),
            ("econ_coordinated_care_area_data_year", "text"),
            ("econ_enterprise_zone_num", "text"),
            ("econ_enterprise_zone_data_year", "text"),
            ("econ_industrial_growth_zone_num", "text"),
            ("econ_industrial_growth_zone_data_year", "text"),
            ("econ_qualified_opportunity_zone_num", "text"),
            ("econ_qualified_opportunity_zone_data_year", "text"),
            ("econ_central_business_district_num", "text"),
            ("econ_central_business_district_data_year", "text"),
            ("env_flood_fema_sfha", "text"),
            ("env_flood_fema_data_year", "text"),
            ("env_flood_fs_factor", "text"),
            ("env_flood_fs_risk_direction", "text"),
            ("env_flood_fs_data_year", "text"),
            ("env_ohare_noise_contour_no_buffer_bool", "text"),
            ("env_ohare_noise_contour_half_mile_buffer_bool", "text"),
            ("env_ohare_noise_contour_data_year", "text"),
            ("env_airport_noise_dnl", "text"),
            ("env_airport_noise_data_year", "text"),
            ("school_elementary_district_geoid", "text"),
            ("school_elementary_district_name", "text"),
            ("school_secondary_district_geoid", "text"),
            ("school_secondary_district_name", "text"),
            ("school_unified_district_geoid", "text"),
            ("school_unified_district_name", "text"),
            ("school_school_year", "text"),
            ("school_data_year", "text"),
            ("tax_municipality_num", "text"),
            ("tax_municipality_name", "text"),
            ("tax_school_elementary_district_num", "text"),
            ("tax_school_elementary_district_name", "text"),
            ("tax_school_secondary_district_num", "text"),
            ("tax_school_secondary_district_name", "text"),
            ("tax_school_unified_district_num", "text"),
            ("tax_school_unified_district_name", "text"),
            ("tax_community_college_district_num", "text"),
            ("tax_community_college_district_name", "text"),
            ("tax_fire_protection_district_num", "text"),
            ("tax_fire_protection_district_name", "text"),
            ("tax_library_district_num", "text"),
            ("tax_library_district_name", "text"),
            ("tax_park_district_num", "text"),
            ("tax_park_district_name", "text"),
            ("tax_sanitation_district_num", "text"),
            ("tax_sanitation_district_name", "text"),
            ("tax_special_service_area_num", "text"),
            ("tax_special_service_area_name", "text"),
            ("tax_tif_district_num", "text"),
            ("tax_tif_district_name", "text"),
            ("tax_data_year", "text"),
            ("access_cmap_walk_id", "text"),
            ("access_cmap_walk_nta_score", "text"),
            ("access_cmap_walk_total_score", "text"),
            ("access_cmap_walk_data_year", "text"),
            ("misc_subdivision_id", "text"),
            ("misc_subdivision_data_year", "text"),
            ("row_id", "text"),
        ],
    ),
    "chi_owners": DatasetSpec(
        name="chi_owners",
        table="chi_owners",
        csv_filename="chi_owners.csv",
        columns=[
            ("pin", "text"),
            ("pin10", "text"),
            ("year", "text"),
            ("prop_address_full", "text"),
            ("prop_address_city_name", "text"),
            ("prop_address_state", "text"),
            ("prop_address_zipcode_1", "text"),
            ("mail_address_name", "text"),
            ("mail_address_full", "text"),
            ("mail_address_city_name", "text"),
            ("mail_address_state", "text"),
            ("mail_address_zipcode_1", "text"),
            ("row_id", "text"),
        ],
    ),
    "chi_permits": DatasetSpec(
        name="chi_permits",
        table="chi_permits",
        csv_filename="chi_permits.csv",
        columns=[
            ("id", "text"),
            ("permit_", "text"),
            ("permit_status", "text"),
            ("permit_milestone", "text"),
            ("permit_type", "text"),
            ("review_type", "text"),
            ("application_start_date", "text"),
            ("issue_date", "text"),
            ("processing_time", "text"),
            ("street_number", "text"),
            ("street_direction", "text"),
            ("street_name", "text"),
            ("work_type", "text"),
            ("work_description", "text"),
            ("permit_condition", "text"),
            ("building_fee_paid", "text"),
            ("zoning_fee_paid", "text"),
            ("other_fee_paid", "text"),
            ("subtotal_paid", "text"),
            ("building_fee_unpaid", "text"),
            ("zoning_fee_unpaid", "text"),
            ("other_fee_unpaid", "text"),
            ("subtotal_unpaid", "text"),
            ("building_fee_waived", "text"),
            ("building_fee_subtotal", "text"),
            ("zoning_fee_subtotal", "text"),
            ("other_fee_subtotal", "text"),
            ("zoning_fee_waived", "text"),
            ("other_fee_waived", "text"),
            ("subtotal_waived", "text"),
            ("total_fee", "text"),
            ("contact_1_type", "text"),
            ("contact_1_name", "text"),
            ("contact_1_city", "text"),
            ("contact_1_state", "text"),
            ("contact_1_zipcode", "text"),
            ("contact_2_type", "text"),
            ("contact_2_name", "text"),
            ("contact_2_city", "text"),
            ("contact_2_state", "text"),
            ("contact_2_zipcode", "text"),
            ("contact_3_type", "text"),
            ("contact_3_name", "text"),
            ("contact_3_city", "text"),
            ("contact_3_state", "text"),
            ("contact_3_zipcode", "text"),
            ("contact_4_type", "text"),
            ("contact_4_name", "text"),
            ("contact_4_city", "text"),
            ("contact_4_state", "text"),
            ("contact_4_zipcode", "text"),
            ("contact_5_type", "text"),
            ("contact_5_name", "text"),
            ("contact_5_city", "text"),
            ("contact_5_state", "text"),
            ("contact_5_zipcode", "text"),
            ("contact_6_type", "text"),
            ("contact_6_name", "text"),
            ("contact_6_city", "text"),
            ("contact_6_state", "text"),
            ("contact_6_zipcode", "text"),
            ("contact_7_type", "text"),
            ("contact_7_name", "text"),
            ("contact_7_city", "text"),
            ("contact_7_state", "text"),
            ("contact_7_zipcode", "text"),
            ("contact_8_type", "text"),
            ("contact_8_name", "text"),
            ("contact_8_city", "text"),
            ("contact_8_state", "text"),
            ("contact_8_zipcode", "text"),
            ("contact_9_type", "text"),
            ("contact_9_name", "text"),
            ("contact_9_city", "text"),
            ("contact_9_state", "text"),
            ("contact_9_zipcode", "text"),
            ("contact_10_type", "text"),
            ("contact_10_name", "text"),
            ("contact_10_city", "text"),
            ("contact_10_state", "text"),
            ("contact_10_zipcode", "text"),
            ("contact_11_type", "text"),
            ("contact_11_name", "text"),
            ("contact_11_city", "text"),
            ("contact_11_state", "text"),
            ("contact_11_zipcode", "text"),
            ("contact_12_type", "text"),
            ("contact_12_name", "text"),
            ("contact_12_city", "text"),
            ("contact_12_state", "text"),
            ("contact_12_zipcode", "text"),
            ("contact_13_type", "text"),
            ("contact_13_name", "text"),
            ("contact_13_city", "text"),
            ("contact_13_state", "text"),
            ("contact_13_zipcode", "text"),
            ("contact_14_type", "text"),
            ("contact_14_name", "text"),
            ("contact_14_city", "text"),
            ("contact_14_state", "text"),
            ("contact_14_zipcode", "text"),
            ("contact_15_type", "text"),
            ("contact_15_name", "text"),
            ("contact_15_city", "text"),
            ("contact_15_state", "text"),
            ("contact_15_zipcode", "text"),
            ("reported_cost", "text"),
            ("pin_list", "text"),
            ("community_area", "text"),
            ("census_tract", "text"),
            ("ward", "text"),
            ("xcoordinate", "text"),
            ("ycoordinate", "text"),
            ("latitude", "text"),
            ("longitude", "text"),
            ("location", "text"),
        ],
    ),
    "chi_violations": DatasetSpec(
        name="chi_violations",
        table="chi_violations",
        csv_filename="chi_violations.csv",
        columns=[
            ("id", "text"),
            ("violation_last_modified_date", "text"),
            ("violation_date", "text"),
            ("violation_code", "text"),
            ("violation_status", "text"),
            ("violation_status_date", "text"),
            ("violation_description", "text"),
            ("violation_location", "text"),
            ("violation_inspector_comments", "text"),
            ("violation_ordinance", "text"),
            ("inspector_id", "text"),
            ("inspection_number", "text"),
            ("inspection_status", "text"),
            ("inspection_waived", "text"),
            ("inspection_category", "text"),
            ("department_bureau", "text"),
            ("address", "text"),
            ("street_number", "text"),
            ("street_direction", "text"),
            ("street_name", "text"),
            ("street_type", "text"),
            ("property_group", "text"),
            ("ssa", "text"),
            ("latitude", "text"),
            ("longitude", "text"),
            ("location", "text"),
        ],
    ),
    "chi_311": DatasetSpec(
        name="chi_311",
        table="chi_311",
        csv_filename="chi_311.csv",
        columns=[
            ("sr_number", "text"),
            ("sr_type", "text"),
            ("sr_short_code", "text"),
            ("created_department", "text"),
            ("owner_department", "text"),
            ("status", "text"),
            ("origin", "text"),
            ("created_date", "text"),
            ("last_modified_date", "text"),
            ("closed_date", "text"),
            ("street_address", "text"),
            ("city", "text"),
            ("state", "text"),
            ("zip_code", "text"),
            ("street_number", "text"),
            ("street_direction", "text"),
            ("street_name", "text"),
            ("street_type", "text"),
            ("duplicate", "text"),
            ("legacy_record", "text"),
            ("legacy_sr_number", "text"),
            ("parent_sr_number", "text"),
            ("community_area", "text"),
            ("ward", "text"),
            ("electrical_district", "text"),
            ("electricity_grid", "text"),
            ("police_sector", "text"),
            ("police_district", "text"),
            ("police_beat", "text"),
            ("precinct", "text"),
            ("sanitation_division_days", "text"),
            ("created_hour", "text"),
            ("created_day_of_week", "text"),
            ("created_month", "text"),
            ("x_coordinate", "text"),
            ("y_coordinate", "text"),
            ("latitude", "text"),
            ("longitude", "text"),
            ("location", "text"),
        ],
    ),
    "chi_geographies": DatasetSpec(
        name="chi_geographies",
        table="chi_geographies",
        csv_filename="chi_geographies.csv",
        columns=[
            ("geo_type", "text"),
            ("area_num_1", "text"),
            ("area_numbe", "text"),
            ("community", "text"),
            ("edit_date", "text"),
            ("globalid", "text"),
            ("objectid", "text"),
            ("shape_area", "text"),
            ("shape_len", "text"),
            ("st_area_sh", "text"),
            ("st_length_", "text"),
            ("the_geom", "text"),
            ("ward", "text"),
            ("ward_id", "text"),
            ("zip", "text"),
        ],
    ),
}


class ChiDbBuilder:
    db: DbContext
    conn: DbConnection
    data_dir: Path
    is_testing: bool

    def __init__(self, db: DbContext, is_testing: bool, data_dir: Path | None = None) -> None:
        self.db = db
        self.is_testing = is_testing

        if data_dir is None:
            if is_testing:
                data_dir = ROOT_DIR / "tests" / "data"
            else:
                data_dir = ROOT_DIR / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir = data_dir

        self.conn = db.connection()

    def do_tables_exist(self, *names: str) -> bool:
        with self.conn:
            for name in names:
                with self.conn.cursor() as cursor:
                    cursor.execute(f"SELECT to_regclass('public.{name}')")
                    if cursor.fetchone()[0] is None:
                        return False
        return True

    def drop_tables(self, *names: str) -> None:
        with self.conn:
            for name in names:
                with self.conn.cursor() as cursor:
                    cursor.execute(f"DROP TABLE IF EXISTS {name}")

    def create_table(self, spec: DatasetSpec) -> None:
        column_defs = [f"{name} {sql_type}" for name, sql_type in spec.columns]
        if spec.primary_key:
            column_defs.append(f"PRIMARY KEY ({spec.primary_key})")
        columns_sql = ",\n    ".join(column_defs)
        sql = f"""
        CREATE TABLE IF NOT EXISTS {spec.table} (
            {columns_sql}
        );
        """
        with self.conn:
            with self.conn.cursor() as cursor:
                cursor.execute(sql)

    def load_csv(self, spec: DatasetSpec) -> None:
        csv_path = self.data_dir / spec.csv_filename
        if not csv_path.exists():
            print(f"Skipping {spec.name}: {csv_path.name} not found in {self.data_dir}.")
            return

        expected_column_set = {name for name, _ in spec.columns}
        with self.conn:
            with self.conn.cursor() as cursor:
                cursor.execute(f"TRUNCATE {spec.table}")
                with csv_path.open("r", newline="") as f:
                    header = next(csv.reader(f), None)
                    if not header:
                        raise ValueError(f"{csv_path} is missing a CSV header row.")

                    columns_to_load = [name for name in header if name in expected_column_set]
                    if not columns_to_load:
                        raise ValueError(
                            f"{csv_path} has no columns matching table {spec.table}."
                        )

                    columns = ",".join(columns_to_load)
                    has_unknown_columns = len(columns_to_load) != len(header)
                    f.seek(0)

                    if has_unknown_columns:
                        # Legacy fixtures can include columns that are no longer
                        # present in the table schema; write a filtered CSV stream.
                        reader = csv.DictReader(f)
                        with tempfile.NamedTemporaryFile(mode="w+", newline="") as filtered:
                            writer = csv.DictWriter(filtered, fieldnames=columns_to_load)
                            writer.writeheader()
                            for row in reader:
                                writer.writerow({name: row.get(name, "") for name in columns_to_load})
                            filtered.seek(0)
                            cursor.copy_expert(
                                f"COPY {spec.table} ({columns}) FROM STDIN WITH CSV HEADER",
                                filtered,
                            )
                    else:
                        cursor.copy_expert(
                            f"COPY {spec.table} ({columns}) FROM STDIN WITH CSV HEADER",
                            f,
                        )
        print(f"Loaded {spec.name} from {csv_path.name}.")

    def ensure_dataset(self, name: str, force_refresh: bool = False) -> None:
        spec = DATASETS[name]
        print(f"Ensuring Chicago dataset '{name}' is loaded...")

        if force_refresh:
            self.drop_tables(spec.table)

        if not self.do_tables_exist(spec.table):
            self.create_table(spec)

        if not self.is_testing or force_refresh:
            self.load_csv(spec)
        else:
            # For tests, always load from fixtures if present.
            self.load_csv(spec)

    def run_sql_file(self, sqlpath: Path) -> None:
        sql = sqlpath.read_text()
        with self.conn:
            with self.conn.cursor() as cursor:
                cursor.execute(sql)

    def build(self, force_refresh: bool) -> None:
        if self.is_testing:
            print("Loading the database with Chicago test data.")
        else:
            print("Loading the database with Chicago data (this could take a while).")

        for dataset in get_dataset_dependencies(for_api=True):
            self.ensure_dataset(dataset, force_refresh=force_refresh)

        for sqlpath in get_sqlfile_paths("pre"):
            print(f"Running {sqlpath.name}...")
            self.run_sql_file(sqlpath)

        with self.conn:
            populate_portfolios_table(self.conn)

        for sqlpath in get_sqlfile_paths("post"):
            print(f"Running {sqlpath.name}...")
            self.run_sql_file(sqlpath)


def get_dataset_dependencies(for_api: bool) -> List[str]:
    result = WOW_YML["dependencies"]
    if for_api:
        result += WOW_YML["api_dependencies"]
    return result


def get_sqlfile_paths(type: Literal["pre", "post", "all"]) -> List[Path]:
    pre_sql = [SQL_DIR / sqlfile for sqlfile in WOW_YML["wow_pre_sql"]]
    post_sql = [SQL_DIR / sqlfile for sqlfile in WOW_YML["wow_post_sql"]]
    if type == "pre":
        return pre_sql
    if type == "post":
        return post_sql
    return pre_sql + post_sql


def dbshell(db: DbContext):
    env, args = db.get_pg_env_and_args()
    import subprocess

    retval = subprocess.call(["psql", *args], env=env)
    sys.exit(retval)


def loadtestdata(db: DbContext):
    ChiDbBuilder(db, is_testing=True).build(force_refresh=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers()

    parser.add_argument(
        "-u",
        "--database-url",
        help="Set database URL. Defaults to the DATABASE_URL env variable.",
        default=os.environ.get("DATABASE_URL", ""),
    )

    parser_exportgraph = subparsers.add_parser("exportgraph")
    parser_exportgraph.set_defaults(cmd="exportgraph")
    parser_exportgraph.add_argument(
        "-o", "--outfile", help="JSON filename to export to.", default="portfolios.json"
    )

    parser_loadtestdata = subparsers.add_parser("loadtestdata")
    parser_loadtestdata.set_defaults(cmd="loadtestdata")

    parser_builddb = subparsers.add_parser("builddb")
    parser_builddb.add_argument(
        "--update",
        action="store_true",
        help=(
            "Delete tables for the datasets so they can be re-installed."
        ),
    )
    parser_builddb.set_defaults(cmd="builddb")

    parser_dbshell = subparsers.add_parser("dbshell")
    parser_dbshell.set_defaults(cmd="dbshell")

    args = parser.parse_args()

    database_url: str = args.database_url

    if not database_url:
        print(
            "Please define DATABASE_URL in the environment or pass one in\n"
            "via the --database-url option."
        )
        if dotenv_loaded:
            print("You can also define it in a .env file.")
        else:
            print(
                'If you run "pip install dotenv", you can also define it '
                "in a .env file."
            )
        sys.exit(1)

    db = DbContext.from_url(args.database_url)

    cmd = getattr(args, "cmd", "")

    if cmd == "loadtestdata":
        loadtestdata(db)
    elif cmd == "dbshell":
        dbshell(db)
    elif cmd == "builddb":
        ChiDbBuilder(db, is_testing=False).build(force_refresh=args.update)
    elif cmd == "exportgraph":
        with open(args.outfile, "w") as f:
            with db.connection() as conn:
                export_portfolios_table_json(conn, f)
        print(f"Wrote portfolio graph to {args.outfile}.")
    else:
        parser.print_help()
        sys.exit(1)
