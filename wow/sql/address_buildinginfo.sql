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
    i.permits_total,
    i.violations_open,
    i.violations_total,
    i.requests_311_total
FROM wow_parcels AS p
LEFT JOIN wow_indicators AS i USING(pin)
WHERE p.pin = %(pin)s;
