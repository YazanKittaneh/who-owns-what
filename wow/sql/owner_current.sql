SELECT
    pin,
    housenumber,
    streetname,
    address,
    city,
    state,
    zip,
    owner_id,
    owner_name,
    mailing_address,
    mailing_city,
    mailing_state,
    mailing_zip,
    units_res,
    land_class,
    building_class,
    lat,
    lng,
    ward,
    community_area,
    census_tract
FROM wow_parcels
WHERE (
    %(owner_id)s IS NOT NULL
    AND %(owner_id)s <> ''
    AND owner_id = %(owner_id)s
)
OR (
    (%(owner_id)s IS NULL OR %(owner_id)s = '')
    AND %(owner_name)s IS NOT NULL
    AND %(owner_name)s <> ''
    AND owner_name = %(owner_name)s
)
ORDER BY address ASC, pin ASC;
