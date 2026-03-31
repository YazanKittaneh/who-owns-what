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
    requests_311_total integer,
    annual_tax_sale_count integer,
    scavenger_tax_sale_count integer,
    tax_sale_event_count integer,
    latest_tax_sale_year integer,
    latest_tax_sale_buyer_name text,
    latest_tax_sale_sold_at_sale boolean,
    total_tax_sale_amount_paid numeric,
    recorder_doc_count integer,
    mortgage_doc_count integer,
    quitclaim_doc_count integer,
    foreclosure_doc_count integer,
    latest_recorder_doc_date date,
    latest_mortgage_date date,
    latest_mortgage_amount numeric,
    latest_quitclaim_date date,
    latest_quitclaim_amount numeric
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
        i.requests_311_total::integer,
        tax.annual_tax_sale_count::integer,
        tax.scavenger_tax_sale_count::integer,
        tax.tax_sale_event_count::integer,
        tax.latest_tax_sale_year::integer,
        tax.latest_tax_sale_buyer_name,
        tax.latest_tax_sale_sold_at_sale,
        tax.total_tax_sale_amount_paid,
        rec.recorder_doc_count::integer,
        rec.mortgage_doc_count::integer,
        rec.quitclaim_doc_count::integer,
        rec.foreclosure_doc_count::integer,
        rec.latest_recorder_doc_date,
        rec.latest_mortgage_date,
        rec.latest_mortgage_amount,
        rec.latest_quitclaim_date,
        rec.latest_quitclaim_amount
    FROM wow_parcels AS p
    LEFT JOIN wow_indicators AS i USING(pin)
    LEFT JOIN wow_tax_sale_summary AS tax USING(pin)
    LEFT JOIN wow_recorder_summary AS rec USING(pin)
    WHERE p.pin = ANY(
        SELECT unnest(pins)
        FROM wow_portfolios
        WHERE _pin = ANY(pins)
    )
    ORDER BY p.pin;
$$ LANGUAGE SQL;
