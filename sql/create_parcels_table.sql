DROP TABLE IF EXISTS wow_parcels CASCADE;

CREATE TABLE wow_parcels AS
WITH latest_parcels AS (
    SELECT DISTINCT ON (pin)
        *
    FROM chi_parcels
    ORDER BY
        pin,
        NULLIF(regexp_replace(year::text, '\.0+$', ''), '')::int DESC NULLS LAST
),
latest_owners AS (
    SELECT DISTINCT ON (pin)
        *
    FROM chi_owners
    ORDER BY
        pin,
        NULLIF(regexp_replace(year::text, '\.0+$', ''), '')::int DESC NULLS LAST
),
parcels_with_owner AS (
    SELECT
        p.pin,
        p.pin10,
        p.class,
        p.zip_code,
        p.lat,
        p.lon,
        p.ward_num,
        p.chicago_community_area_name,
        p.census_tract_geoid,
        o.prop_address_full,
        o.prop_address_city_name,
        o.prop_address_state,
        o.prop_address_zipcode_1,
        o.mail_address_name,
        o.mail_address_full,
        o.mail_address_city_name,
        o.mail_address_state,
        o.mail_address_zipcode_1,
        o.row_id
    FROM latest_parcels AS p
    LEFT JOIN latest_owners AS o ON o.pin = p.pin
)
SELECT
    p.pin,
    substring(p.prop_address_full from '^(\\d+[A-Za-z]?)') AS housenumber,
    nullif(regexp_replace(p.prop_address_full, '^\\s*\\d+[A-Za-z]?\\s+', ''), '') AS streetname,
    p.prop_address_full AS address,
    p.prop_address_city_name AS city,
    p.prop_address_state AS state,
    COALESCE(p.prop_address_zipcode_1, p.zip_code) AS zip,
    NULL::integer AS units_res,
    p.class AS land_class,
    NULL::text AS building_class,
    p.row_id AS owner_id,
    p.mail_address_name AS owner_name,
    p.mail_address_full AS mailing_address,
    p.mail_address_city_name AS mailing_city,
    p.mail_address_state AS mailing_state,
    p.mail_address_zipcode_1 AS mailing_zip,
    NULLIF(p.lat, '')::numeric AS lat,
    NULLIF(p.lon, '')::numeric AS lng,
    p.ward_num AS ward,
    p.chicago_community_area_name AS community_area,
    p.census_tract_geoid AS census_tract,
    p.pin10
FROM parcels_with_owner AS p;

CREATE INDEX ON wow_parcels (pin);
CREATE INDEX ON wow_parcels (owner_id);
CREATE INDEX ON wow_parcels (zip);
CREATE INDEX ON wow_parcels (ward);
CREATE INDEX ON wow_parcels (community_area);
CREATE INDEX IF NOT EXISTS wow_parcels_address_trgm_idx ON wow_parcels USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS wow_parcels_address_lower_prefix_idx
    ON wow_parcels (lower(address) text_pattern_ops);
CREATE INDEX IF NOT EXISTS wow_parcels_streetname_lower_prefix_idx
    ON wow_parcels (lower(streetname) text_pattern_ops);
CREATE INDEX IF NOT EXISTS wow_parcels_housenumber_lower_prefix_idx
    ON wow_parcels (lower(housenumber) text_pattern_ops);
CREATE INDEX IF NOT EXISTS wow_parcels_fulladdr_lower_prefix_idx
    ON wow_parcels (
        (coalesce(lower(housenumber), '') || ' ' || coalesce(lower(streetname), '')) text_pattern_ops
    );
