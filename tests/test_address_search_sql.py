from pathlib import Path

from .factories.chi_owners import ChiOwners
from .factories.chi_parcels import ChiParcels


WABASH_2460_PIN = "12345678901230"
WABASH_2462_PIN = "12345678901232"
WABASH_2464_PIN = "12345678901234"
WABASH_3000_S_PIN = "12345678901236"
STATE_3000_PIN = "22345678901234"

SQL_DIR = Path(__file__).resolve().parents[1] / "wow" / "sql"
ROOT_SQL_DIR = Path(__file__).resolve().parents[1] / "sql"


class TestAddressSearchSql:
    def search(self, db, query):
        with db.cursor() as cur:
            cur.execute((SQL_DIR / "address_search.sql").read_text(), {"q": query})
            return cur.fetchall()

    def load_search_data(self, nycdb_ctx, include_state_address=True):
        parcels = [
            ChiParcels(
                pin=WABASH_2460_PIN,
                pin10="1234567890",
                year="2024",
                PY_class="2",
                zip_code="60611",
                ward_num="42",
            ),
            ChiParcels(
                pin=WABASH_2462_PIN,
                pin10="1234567891",
                year="2024",
                PY_class="2",
                zip_code="60611",
                ward_num="42",
            ),
            ChiParcels(
                pin=WABASH_2464_PIN,
                pin10="1234567892",
                year="2024",
                PY_class="2",
                zip_code="60611",
                ward_num="42",
            ),
            ChiParcels(
                pin=WABASH_3000_S_PIN,
                pin10="1234567893",
                year="2024",
                PY_class="2",
                zip_code="60616",
                ward_num="4",
            ),
        ]
        owners = [
            ChiOwners(
                pin=WABASH_2460_PIN,
                pin10="1234567890",
                year="2024",
                prop_address_full="2460 N WABASH AVE",
                prop_address_city_name="CHICAGO",
                prop_address_state="IL",
                prop_address_zipcode_1="60611",
                row_id="OWN1",
            ),
            ChiOwners(
                pin=WABASH_2462_PIN,
                pin10="1234567891",
                year="2024",
                prop_address_full="2462 N WABASH AVE",
                prop_address_city_name="CHICAGO",
                prop_address_state="IL",
                prop_address_zipcode_1="60611",
                row_id="OWN2",
            ),
            ChiOwners(
                pin=WABASH_2464_PIN,
                pin10="1234567892",
                year="2024",
                prop_address_full="2464 N WABASH AVE",
                prop_address_city_name="CHICAGO",
                prop_address_state="IL",
                prop_address_zipcode_1="60611",
                row_id="OWN3",
            ),
            ChiOwners(
                pin=WABASH_3000_S_PIN,
                pin10="1234567893",
                year="2024",
                prop_address_full="3000 S WABASH AVE",
                prop_address_city_name="CHICAGO",
                prop_address_state="IL",
                prop_address_zipcode_1="60616",
                row_id="OWN5",
            ),
        ]

        if include_state_address:
            parcels.append(
                ChiParcels(
                    pin=STATE_3000_PIN,
                    pin10="2234567890",
                    year="2024",
                    PY_class="2",
                    zip_code="60610",
                    ward_num="2",
                )
            )
            owners.append(
                ChiOwners(
                    pin=STATE_3000_PIN,
                    pin10="2234567890",
                    year="2024",
                    prop_address_full="3000 S STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60610",
                    row_id="OWN4",
                )
            )

        nycdb_ctx.write_csv("chi_parcels.csv", parcels)
        nycdb_ctx.write_csv("chi_owners.csv", owners)
        nycdb_ctx.builder.ensure_dataset("chi_parcels", force_refresh=True)
        nycdb_ctx.builder.ensure_dataset("chi_owners", force_refresh=True)
        nycdb_ctx.builder.run_sql_file(ROOT_SQL_DIR / "create_parcels_table.sql")

    def test_search_matches_street_substrings(self, db, nycdb_ctx):
        self.load_search_data(nycdb_ctx)

        results = self.search(db, "wabash")

        assert [row["address"] for row in results[:3]] == [
            "2460 N WABASH AVE",
            "2462 N WABASH AVE",
            "2464 N WABASH AVE",
        ]

    def test_search_suggests_nearby_house_numbers(self, db, nycdb_ctx):
        self.load_search_data(nycdb_ctx, include_state_address=False)

        results = self.search(db, "2462 n")

        assert [row["address"] for row in results[:3]] == [
            "2462 N WABASH AVE",
            "2460 N WABASH AVE",
            "2464 N WABASH AVE",
        ]

    def test_search_prefers_matching_direction_prefixes(self, db, nycdb_ctx):
        self.load_search_data(nycdb_ctx)

        results = self.search(db, "n wabash")

        assert [row["address"] for row in results[:4]] == [
            "2460 N WABASH AVE",
            "2462 N WABASH AVE",
            "2464 N WABASH AVE",
            "3000 S WABASH AVE",
        ]

        results = self.search(db, "north wabash")

        assert [row["address"] for row in results[:4]] == [
            "2460 N WABASH AVE",
            "2462 N WABASH AVE",
            "2464 N WABASH AVE",
            "3000 S WABASH AVE",
        ]

        results = self.search(db, "wabash n")

        assert [row["address"] for row in results[:4]] == [
            "2460 N WABASH AVE",
            "2462 N WABASH AVE",
            "2464 N WABASH AVE",
            "3000 S WABASH AVE",
        ]
