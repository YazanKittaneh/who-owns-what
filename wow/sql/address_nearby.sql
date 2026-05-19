WITH seed AS (
    SELECT
        pin,
        lat,
        lng,
        geog,
        owner_id,
        owner_name
    FROM wow_parcels
    WHERE pin = %(pin)s
      AND geog IS NOT NULL
), candidates AS (
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
        p.lat,
        p.lng,
        ST_Distance(p.geog, s.geog) AS distance_m,
        (coalesce(p.owner_id, '') <> '' AND p.owner_id = s.owner_id)
          OR (coalesce(p.owner_name, '') <> '' AND p.owner_name = s.owner_name) AS same_owner
    FROM wow_parcels AS p
    CROSS JOIN seed AS s
    WHERE p.pin <> s.pin
      AND p.geog IS NOT NULL
      AND ST_DWithin(p.geog, s.geog, %(radius_m)s)
)
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
    lat,
    lng,
    round(distance_m)::integer AS distance_m,
    same_owner
FROM candidates
ORDER BY same_owner DESC, distance_m ASC, address ASC, pin ASC
LIMIT %(limit)s;
