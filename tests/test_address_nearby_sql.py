from pathlib import Path

from .factories.chi_owners import ChiOwners
from .factories.chi_parcels import ChiParcels


SQL_DIR = Path(__file__).resolve().parents[1] / "wow" / "sql"
ROOT_SQL_DIR = Path(__file__).resolve().parents[1] / "sql"

SEED_PIN = "20000000000001"
NEAR_SAME_OWNER_PIN = "20000000000002"
NEAR_OTHER_OWNER_PIN = "20000000000003"
FAR_PIN = "20000000000004"


class TestAddressNearbySql:
    def exec_query(self, db, sql_name, params):
        with db.cursor() as cur:
            cur.execute((SQL_DIR / sql_name).read_text(), params)
            return cur.fetchall()

    def load(self, nycdb_ctx):
        nycdb_ctx.write_csv(
            "chi_parcels.csv",
            [
                ChiParcels(
                    pin=SEED_PIN,
                    pin10="2000000000",
                    year="2024",
                    PY_class="211",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8800",
                ),
                ChiParcels(
                    pin=NEAR_SAME_OWNER_PIN,
                    pin10="2000000001",
                    year="2024",
                    PY_class="212",
                    zip_code="60601",
                    lon="-87.6300",
                    lat="41.8803",
                ),
                ChiParcels(
                    pin=NEAR_OTHER_OWNER_PIN,
                    pin10="2000000002",
                    year="2024",
                    PY_class="278",
                    zip_code="60601",
                    lon="-87.6295",
                    lat="41.8801",
                ),
                ChiParcels(
                    pin=FAR_PIN,
                    pin10="2000000003",
                    year="2024",
                    PY_class="278",
                    zip_code="60601",
                    lon="-87.6200",
                    lat="41.8900",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_owners.csv",
            [
                ChiOwners(
                    pin=SEED_PIN,
                    pin10="2000000000",
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
                    row_id="NEARBY_OWNER1",
                ),
                ChiOwners(
                    pin=NEAR_SAME_OWNER_PIN,
                    pin10="2000000001",
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
                    row_id="NEARBY_OWNER1",
                ),
                ChiOwners(
                    pin=NEAR_OTHER_OWNER_PIN,
                    pin10="2000000002",
                    year="2024",
                    prop_address_full="104 N STATE ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="OTHER OWNER LLC",
                    mail_address_full="2 OWNER WAY",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="NEARBY_OWNER2",
                ),
                ChiOwners(
                    pin=FAR_PIN,
                    pin10="2000000003",
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
                    row_id="NEARBY_OWNER3",
                ),
            ],
        )
        nycdb_ctx.builder.ensure_dataset("chi_parcels", force_refresh=True)
        nycdb_ctx.builder.ensure_dataset("chi_owners", force_refresh=True)
        nycdb_ctx.builder.run_sql_file(ROOT_SQL_DIR / "create_parcels_table.sql")

    def test_returns_only_parcels_inside_radius(self, db, nycdb_ctx):
        self.load(nycdb_ctx)

        rows = self.exec_query(
            db,
            "address_nearby.sql",
            {"pin": SEED_PIN, "radius_m": 200, "limit": 10},
        )

        pins = {row["pin"] for row in rows}
        assert pins == {NEAR_SAME_OWNER_PIN, NEAR_OTHER_OWNER_PIN}
        assert FAR_PIN not in pins

    def test_same_owner_parcels_sort_first_and_carry_flag(self, db, nycdb_ctx):
        self.load(nycdb_ctx)

        rows = self.exec_query(
            db,
            "address_nearby.sql",
            {"pin": SEED_PIN, "radius_m": 200, "limit": 10},
        )

        assert rows[0]["pin"] == NEAR_SAME_OWNER_PIN
        assert rows[0]["same_owner"] is True
        assert rows[-1]["pin"] == NEAR_OTHER_OWNER_PIN
        assert rows[-1]["same_owner"] is False
        assert all(row["distance_m"] is not None for row in rows)
