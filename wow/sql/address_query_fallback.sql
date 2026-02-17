WITH latest_parcels AS (
    SELECT DISTINCT ON (pin)
        pin,
        pin10,
        class,
        zip_code,
        lat,
        lon,
        ward_num,
        chicago_community_area_name,
        census_tract_geoid
    FROM chi_parcels
    ORDER BY
        pin,
        NULLIF(regexp_replace(year::text, '\.0+$', ''), '')::int DESC NULLS LAST
),
latest_owners AS (
    SELECT DISTINCT ON (pin)
        pin,
        prop_address_full,
        prop_address_city_name,
        prop_address_state,
        prop_address_zipcode_1,
        mail_address_name,
        mail_address_full,
        mail_address_city_name,
        mail_address_state,
        mail_address_zipcode_1,
        row_id
    FROM chi_owners
    ORDER BY
        pin,
        NULLIF(regexp_replace(year::text, '\.0+$', ''), '')::int DESC NULLS LAST
)
SELECT
    p.pin,
    substring(o.prop_address_full from '^(\\d+[A-Za-z]?)') AS housenumber,
    nullif(regexp_replace(coalesce(o.prop_address_full, ''), '^\\s*\\d+[A-Za-z]?\\s+', ''), '') AS streetname,
    o.prop_address_full AS address,
    o.prop_address_city_name AS city,
    o.prop_address_state AS state,
    COALESCE(o.prop_address_zipcode_1, p.zip_code) AS zip,
    o.row_id AS owner_id,
    o.mail_address_name AS owner_name,
    o.mail_address_full AS mailing_address,
    o.mail_address_city_name AS mailing_city,
    o.mail_address_state AS mailing_state,
    o.mail_address_zipcode_1 AS mailing_zip,
    NULL::integer AS units_res,
    p.class AS land_class,
    NULL::text AS building_class,
    NULLIF(p.lat::text, '')::numeric AS lat,
    NULLIF(p.lon::text, '')::numeric AS lng,
    p.ward_num AS ward,
    p.chicago_community_area_name AS community_area,
    p.census_tract_geoid AS census_tract,
    NULL::integer AS permits_total,
    NULL::integer AS violations_open,
    NULL::integer AS violations_total,
    NULL::integer AS requests_311_total
FROM latest_parcels AS p
LEFT JOIN latest_owners AS o USING(pin)
WHERE p.pin = %(pin)s;
