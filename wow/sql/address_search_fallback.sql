WITH latest_parcels AS (
    SELECT DISTINCT ON (pin)
        pin,
        zip_code
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
        prop_address_zipcode_1
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
    COALESCE(o.prop_address_zipcode_1, p.zip_code) AS zip
FROM latest_parcels AS p
LEFT JOIN latest_owners AS o USING(pin)
WHERE coalesce(o.prop_address_full, '') ILIKE '%%' || %(q)s || '%%'
   OR (
       coalesce(substring(o.prop_address_full from '^(\\d+[A-Za-z]?)'), '')
       || ' '
       || coalesce(nullif(regexp_replace(coalesce(o.prop_address_full, ''), '^\\s*\\d+[A-Za-z]?\\s+', ''), ''), '')
   ) ILIKE '%%' || %(q)s || '%%'
ORDER BY o.prop_address_full
LIMIT 5;
