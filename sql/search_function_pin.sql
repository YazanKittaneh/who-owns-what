DROP FUNCTION IF EXISTS get_assoc_addrs_from_pin(text);

CREATE OR REPLACE FUNCTION get_assoc_addrs_from_pin(_pin text)
RETURNS TABLE (
    pin text,
    housenumber text,
    streetname text,
    address text,
    city text,
    state text,
    zip text,
    owner_id text,
    owner_name text,
    mailing_address text,
    mailing_city text,
    mailing_state text,
    mailing_zip text,
    units_res integer,
    land_class text,
    building_class text,
    lat numeric,
    lng numeric,
    ward text,
    community_area text,
    census_tract text,
    permits_total integer,
    violations_open integer,
    violations_total integer,
    requests_311_total integer
) AS $$
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.owner_id,
        p.owner_name,
        p.mailing_address,
        p.mailing_city,
        p.mailing_state,
        p.mailing_zip,
        p.units_res,
        p.land_class,
        p.building_class,
        p.lat,
        p.lng,
        p.ward,
        p.community_area,
        p.census_tract,
        i.permits_total::integer,
        i.violations_open::integer,
        i.violations_total::integer,
        i.requests_311_total::integer
    FROM wow_parcels AS p
    LEFT JOIN wow_indicators AS i USING(pin)
    WHERE p.pin = ANY(
        SELECT unnest(pins)
        FROM wow_portfolios
        WHERE _pin = ANY(pins)
    )
    ORDER BY p.pin;
$$ LANGUAGE SQL;
