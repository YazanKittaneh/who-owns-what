from .factories.chi_parcels import ChiParcels
from .factories.chi_owners import ChiOwners
from .factories.chi_violations import ChiViolations


def test_loading_violations_works(db, nycdb_ctx):
    nycdb_ctx.write_csv(
        "chi_violations.csv",
        [
            ChiViolations(
                id="V123",
                violation_status="Open",
                street_number="123",
                street_name="FUNKY",
                street_type="ST",
            )
        ],
    )
    nycdb_ctx.load_dataset("chi_violations")
    with db.cursor() as cur:
        cur.execute("select * from chi_violations where id='V123'")
        row = cur.fetchone()
        assert row["violation_status"] == "Open"


def test_loading_parcels_with_owners_works(db, nycdb_ctx):
    nycdb_ctx.write_csv(
        "chi_parcels.csv",
        [
            ChiParcels(
                pin="12345678901234",
                pin10="1234567890",
                year="2024",
                PY_class="2",
                zip_code="60601",
                lat="41.88",
                lon="-87.63",
                ward_num="42",
                chicago_community_area_name="Loop",
                census_tract_geoid="17031010100",
            )
        ],
    )
    nycdb_ctx.write_csv(
        "chi_owners.csv",
        [
            ChiOwners(
                pin="12345678901234",
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
            )
        ],
    )
    nycdb_ctx.load_dataset("chi_parcels")
    nycdb_ctx.load_dataset("chi_owners")
    with db.cursor() as cur:
        cur.execute("select * from chi_parcels where pin='12345678901234'")
        assert cur.fetchone()["zip_code"] == "60601"
        cur.execute("select * from chi_owners where row_id='OWN1'")
        assert cur.fetchone()["mail_address_name"] == "FUNKY HOLDINGS LLC"
