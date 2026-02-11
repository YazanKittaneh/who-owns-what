from io import StringIO
import json
import pytest

from portfoliograph.table import export_portfolios_table_json

from .factories.chi_parcels import ChiParcels
from .factories.chi_owners import ChiOwners
from .factories.chi_permits import ChiPermits
from .factories.chi_violations import ChiViolations
from .factories.chi_311 import Chi311
from .factories.chi_geographies import ChiGeographies


FUNKY_PIN = "12345678901234"
MONKEY_PIN = "12345678901235"
UNRELATED_PIN = "22345678901234"


class TestSQL:
    @pytest.fixture(autouse=True, scope="class")
    def setup_class_fixture(self, db, nycdb_ctx):
        nycdb_ctx.write_csv(
            "chi_parcels.csv",
            [
                ChiParcels(
                    pin=FUNKY_PIN,
                    pin10="1234567890",
                    year="2024",
                    PY_class="2",
                    zip_code="60601",
                    lon="-87.63",
                    lat="41.88",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=MONKEY_PIN,
                    pin10="1234567891",
                    year="2024",
                    PY_class="2",
                    zip_code="60601",
                    lon="-87.63",
                    lat="41.88",
                    ward_num="42",
                    chicago_community_area_name="Loop",
                    census_tract_geoid="17031010100",
                ),
                ChiParcels(
                    pin=UNRELATED_PIN,
                    pin10="2234567890",
                    year="2024",
                    PY_class="2",
                    zip_code="60602",
                    lon="-87.64",
                    lat="41.89",
                    ward_num="1",
                    chicago_community_area_name="Near North",
                    census_tract_geoid="17031010200",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_owners.csv",
            [
                ChiOwners(
                    pin=FUNKY_PIN,
                    pin10="1234567890",
                    year="2024",
                    prop_address_full="100 FUNKY ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="FUNKY HOLDINGS LLC",
                    mail_address_full="1 MAIN ST",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWN1",
                ),
                ChiOwners(
                    pin=MONKEY_PIN,
                    pin10="1234567891",
                    year="2024",
                    prop_address_full="200 FUNKY ST",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60601",
                    mail_address_name="FUNKY HOLDINGS LLC",
                    mail_address_full="1 MAIN ST",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60601",
                    row_id="OWN1",
                ),
                ChiOwners(
                    pin=UNRELATED_PIN,
                    pin10="2234567890",
                    year="2024",
                    prop_address_full="300 UNRELATED AVE",
                    prop_address_city_name="CHICAGO",
                    prop_address_state="IL",
                    prop_address_zipcode_1="60602",
                    mail_address_name="UNRELATED OWNER",
                    mail_address_full="9 OTHER ST",
                    mail_address_city_name="CHICAGO",
                    mail_address_state="IL",
                    mail_address_zipcode_1="60602",
                    row_id="OWN2",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_geographies.csv",
            [
                ChiGeographies(geo_type="ward", ward="42", ward_id="42"),
                ChiGeographies(geo_type="ward", ward="1", ward_id="1"),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_permits.csv",
            [
                ChiPermits(pin_list="1234567890", street_number="100", street_name="FUNKY"),
                ChiPermits(pin_list="1234567890", street_number="100", street_name="FUNKY"),
                ChiPermits(pin_list="1234567891", street_number="200", street_name="FUNKY"),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_violations.csv",
            [
                ChiViolations(
                    violation_status="OPEN",
                    street_number="100",
                    street_name="FUNKY",
                    street_type="ST",
                ),
                ChiViolations(
                    violation_status="CLOSED",
                    street_number="100",
                    street_name="FUNKY",
                    street_type="ST",
                ),
                ChiViolations(
                    violation_status="CLOSED",
                    street_number="200",
                    street_name="FUNKY",
                    street_type="ST",
                ),
            ],
        )
        nycdb_ctx.write_csv(
            "chi_311.csv",
            [
                Chi311(street_number="100", street_name="FUNKY", street_type="ST"),
                Chi311(street_number="200", street_name="FUNKY", street_type="ST"),
                Chi311(street_number="200", street_name="FUNKY", street_type="ST"),
            ],
        )
        nycdb_ctx.build_everything()

    @pytest.fixture(autouse=True)
    def setup_fixture(self, db):
        self.db = db

    def query_one(self, query):
        results = self.query_all(query)
        assert len(results) == 1
        return results[0]

    def query_all(self, query):
        with self.db.cursor() as cur:
            cur.execute(query)
            return cur.fetchall()

    def get_assoc_addrs_from_pin(self, pin, expected_pins=None):
        results = self.query_all(f"SELECT * FROM get_assoc_addrs_from_pin('{pin}')")
        results_by_pin = {result["pin"]: result for result in results}
        if expected_pins is not None:
            assert set(results_by_pin.keys()) == set(expected_pins)
        return results_by_pin

    def test_wow_parcels_is_populated(self):
        r = self.query_one(f"SELECT * FROM wow_parcels WHERE pin='{FUNKY_PIN}'")
        assert r["housenumber"] == "100"
        assert r["streetname"] == "FUNKY ST"
        assert r["owner_name"] == "FUNKY HOLDINGS LLC"
        assert r["ward"] == "42"

    def test_wow_indicators_counts(self):
        r = self.query_one(f"SELECT * FROM wow_indicators WHERE pin='{FUNKY_PIN}'")
        assert r["permits_total"] == 2
        assert r["violations_open"] == 1
        assert r["violations_total"] == 2
        assert r["requests_311_total"] == 1

        r = self.query_one(f"SELECT * FROM wow_indicators WHERE pin='{MONKEY_PIN}'")
        assert r["permits_total"] == 1
        assert r["violations_open"] == 0
        assert r["violations_total"] == 1
        assert r["requests_311_total"] == 2

    def test_get_assoc_addrs_from_pin_returns_portfolio(self):
        results = self.get_assoc_addrs_from_pin(
            FUNKY_PIN, expected_pins=[FUNKY_PIN, MONKEY_PIN]
        )
        assert results[FUNKY_PIN]["address"] == "100 FUNKY ST"
        assert results[MONKEY_PIN]["address"] == "200 FUNKY ST"

    def test_get_assoc_addrs_from_pin_invalid_returns_empty(self):
        assert self.get_assoc_addrs_from_pin("00000000000000") == {}

    def test_portfolios_table_is_populated(self):
        r = self.query_one(
            "SELECT * FROM wow_portfolios WHERE owner_names @> ARRAY['FUNKY HOLDINGS LLC']"
        )
        assert set(r["pins"]) == {FUNKY_PIN, MONKEY_PIN}

    def test_export_portfolios_table_json_works(self):
        with self.db.connect() as conn:
            f = StringIO()
            export_portfolios_table_json(conn, f)
            data = json.loads(f.getvalue())
            assert any(
                row["pins"] == [FUNKY_PIN, MONKEY_PIN] for row in data
            )
