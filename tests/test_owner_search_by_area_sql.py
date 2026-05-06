from pathlib import Path

from .factories.chi_owners import ChiOwners
from .factories.chi_parcels import ChiParcels


SQL_DIR = Path(__file__).resolve().parents[1] / "wow" / "sql"
ROOT_SQL_DIR = Path(__file__).resolve().parents[1] / "sql"

SEED_PIN = "10000000000001"
SAME_OWNER_PIN = "10000000000002"
MULTI_OWNER_PIN_ONE = "10000000000003"
MULTI_OWNER_PIN_TWO = "10000000000004"
FAR_OWNER_PIN = "10000000000005"


class TestOwnerSearchByAreaSql:
    def exec_query(self, db, sql_name, params):
        with db.cursor() as cur:
            cur.execute((SQL_DIR / sql_name).read_text(), params)
            return cur.fetchall()

    def load_owner_search_data(self, nycdb_ctx):
        nycdb_ctx.write_csv(
            "chi_parcels.csv",
            [
                ChiParcels(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    PY_class="211",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8800",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=SAME_OWNER_PIN,
                    pin10="1000000001",
                    year="2024",
                    PY_class="212",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8805",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=MULTI_OWNER_PIN_ONE,
                    pin10="1000000002",
                    year="2024",
                    PY_class="278",
                    zip_code="60601",
                    lon="-87.6295",
                    lat="41.8806",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=MULTI_OWNER_PIN_TWO,
                    pin10="1000000003",
                    year="2024",
                    PY_class="295",
                    zip_code="60601",
                    lon="-87.6290",
                    lat="41.8808",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=FAR_OWNER_PIN,
                    pin10="1000000004",
                    year="2024",
                    PY_class="278",
                    zip_code="60601",
                    lon="-87.6200",
                    lat="41.8900",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_owners.csv",
            [
                ChiOwners(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    prop_address_full="100 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="SEED OWNER LLC",
                    mail_address_full="1 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER1",
                ),
                ChiOwners(
                    pin=SAME_OWNER_PIN,
                    pin10="1000000001",
                    year="2024",
                    prop_address_full="102 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="SEED OWNER LLC",
                    mail_address_full="1 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER1",
                ),
                ChiOwners(
                    pin=MULTI_OWNER_PIN_ONE,
                    pin10="1000000002",
                    year="2024",
                    prop_address_full="104 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="MIDRISE OWNER LLC",
                    mail_address_full="2 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER2",
                ),
                ChiOwners(
                    pin=MULTI_OWNER_PIN_TWO,
                    pin10="1000000003",
                    year="2024",
                    prop_address_full="106 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="MIDRISE OWNER LLC",
                    mail_address_full="2 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER2",
                ),
                ChiOwners(
                    pin=FAR_OWNER_PIN,
                    pin10="1000000004",
                    year="2024",
                    prop_address_full="500 E FAR ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="FAR OWNER LLC",
                    mail_address_full="9 FAR WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER3",
                ),
            ],
        )
        nycdb_ctx.builder.ensure_dataset("chi_parcels", force_refresh=True)
        nycdb_ctx.builder.ensure_dataset("chi_owners", force_refresh=True)
        nycdb_ctx.builder.run_sql_file(ROOT_SQL_DIR / "create_parcels_table.sql")

    def test_seed_query_returns_search_center_parcel(self, db, nycdb_ctx):
        self.load_owner_search_data(nycdb_ctx)

        rows = self.exec_query(db, "owner_search_seed.sql", {"pin": SEED_PIN})

        assert len(rows) == 1
        assert rows[0]["pin"] == SEED_PIN
        assert rows[0]["owner_name"] == "SEED OWNER LLC"

    def test_owner_search_groups_matching_nearby_parcels(self, db, nycdb_ctx):
        self.load_owner_search_data(nycdb_ctx)

        rows = self.exec_query(
            db,
            "owner_search_by_area.sql",
            {
                "pin": SEED_PIN,
                "radius_m": 600,
                "building_types": [],
                "apply_building_type_filter": False,
                "min_parcels": 1,
                "max_parcels": None,
                "limit": 10,
            },
        )

        assert [row["owner_name"] for row in rows] == ["SEED OWNER LLC", "MIDRISE OWNER LLC"]
        assert rows[0]["same_owner"] is True
        assert rows[0]["parcel_count"] == 1
        assert rows[0]["parcels"][0]["pin"] == SAME_OWNER_PIN
        assert rows[1]["parcel_count"] == 2
        assert {parcel["pin"] for parcel in rows[1]["parcels"]} == {
            MULTI_OWNER_PIN_ONE,
            MULTI_OWNER_PIN_TWO,
        }

    def test_owner_search_filters_by_building_type_and_portfolio_size(self, db, nycdb_ctx):
        self.load_owner_search_data(nycdb_ctx)

        rows = self.exec_query(
            db,
            "owner_search_by_area.sql",
            {
                "pin": SEED_PIN,
                "radius_m": 600,
                "building_types": ["multi_family"],
                "apply_building_type_filter": True,
                "min_parcels": 2,
                "max_parcels": 2,
                "limit": 10,
            },
        )

        assert len(rows) == 1
        assert rows[0]["owner_name"] == "MIDRISE OWNER LLC"
        assert rows[0]["parcel_count"] == 2
        assert rows[0]["building_type_counts"][0]["building_type"] == "multi_family"


class TestFindOwnersV2Sql:
    def exec_query(self, db, sql_name, params):
        with db.cursor() as cur:
            cur.execute((SQL_DIR / sql_name).read_text(), params)
            return cur.fetchall()

    def test_viewport_returns_parcels_in_bbox(self, db, nycdb_ctx):
        nycdb_ctx.write_csv(
            "chi_parcels.csv",
            [
                ChiParcels(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    PY_class="211",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8800",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=SAME_OWNER_PIN,
                    pin10="1000000001",
                    year="2024",
                    PY_class="212",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8805",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_owners.csv",
            [
                ChiOwners(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    prop_address_full="100 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="SEED OWNER LLC",
                    mail_address_full="1 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER1",
                ),
            ],
        )
        nycdb_ctx.builder.ensure_dataset("chi_parcels", force_refresh=True)
        nycdb_ctx.builder.ensure_dataset("chi_owners", force_refresh=True)
        nycdb_ctx.builder.run_sql_file(ROOT_SQL_DIR / "create_parcels_table.sql")

        rows = self.exec_query(
            db,
            "find_owners_v2_viewport.sql",
            {
                "north": 41.9,
                "south": 41.87,
                "east": -87.6,
                "west": -87.7,
                "limit": 100,
            },
        )

        assert len(rows) == 2
        pins = {row["pin"] for row in rows}
        assert pins == {SEED_PIN, SAME_OWNER_PIN}
        assert rows[0]["geojson"] is not None

    def test_polygon_search_groups_owners_inside_polygon(self, db, nycdb_ctx):
        nycdb_ctx.write_csv(
            "chi_parcels.csv",
            [
                ChiParcels(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    PY_class="211",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8800",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=SAME_OWNER_PIN,
                    pin10="1000000001",
                    year="2024",
                    PY_class="212",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8805",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=MULTI_OWNER_PIN_ONE,
                    pin10="1000000002",
                    year="2024",
                    PY_class="278",
                    zip_code="60601",
                    lon="-87.6295",
                    lat="41.8806",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_owners.csv",
            [
                ChiOwners(
                    pin=SEED_PIN,
                    pin10="1000000000",
                    year="2024",
                    prop_address_full="100 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="SEED OWNER LLC",
                    mail_address_full="1 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER1",
                ),
                ChiOwners(
                    pin=SAME_OWNER_PIN,
                    pin10="1000000001",
                    year="2024",
                    prop_address_full="102 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="SEED OWNER LLC",
                    mail_address_full="1 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER1",
                ),
                ChiOwners(
                    pin=MULTI_OWNER_PIN_ONE,
                    pin10="1000000002",
                    year="2024",
                    prop_address_full="104 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="MIDRISE OWNER LLC",
                    mail_address_full="2 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWNER2",
                ),
            ],
        )
        nycdb_ctx.builder.ensure_dataset("chi_parcels", force_refresh=True)
        nycdb_ctx.builder.ensure_dataset("chi_owners", force_refresh=True)
        nycdb_ctx.builder.run_sql_file(ROOT_SQL_DIR / "create_parcels_table.sql")

        # Polygon covering all three parcels
        geojson = '{"type":"Polygon","coordinates":[[[-87.64,41.87],[-87.62,41.87],[-87.62,41.89],[-87.64,41.89],[-87.64,41.87]]]}'

        rows = self.exec_query(
            db,
            "find_owners_v2_polygon_search.sql",
            {
                "geojson": geojson,
                "building_types": [],
                "apply_building_type_filter": False,
                "min_parcels": 1,
                "max_parcels": None,
                "limit": 10,
            },
        )

        assert len(rows) == 2
        owner_names = [row["owner_name"] for row in rows]
        assert "SEED OWNER LLC" in owner_names
        assert "MIDRISE OWNER LLC" in owner_names

        seed_owner = next(row for row in rows if row["owner_name"] == "SEED OWNER LLC")
        assert seed_owner["parcel_count"] == 2
        assert len(seed_owner["parcels"]) == 2
        assert len(seed_owner["building_type_counts"]) == 2
