WITH seed AS (
    SELECT
        pin,
        lat,
        lng,
        owner_id,
        owner_name
    FROM wow_parcels
    WHERE pin = %(pin)s
      AND lat IS NOT NULL
      AND lng IS NOT NULL
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
        (
            6371000 * acos(
                LEAST(
                    1,
                    GREATEST(
                        -1,
                        cos(radians(s.lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(s.lng))
                        + sin(radians(s.lat)) * sin(radians(p.lat))
                    )
                )
            )
        ) AS distance_m,
        (coalesce(p.owner_id, '') <> '' AND p.owner_id = s.owner_id)
          OR (coalesce(p.owner_name, '') <> '' AND p.owner_name = s.owner_name) AS same_owner
    FROM wow_parcels AS p
    CROSS JOIN seed AS s
    WHERE p.pin <> s.pin
      AND p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN s.lat - (%(radius_m)s::numeric / 111320.0)
                    AND s.lat + (%(radius_m)s::numeric / 111320.0)
      AND p.lng BETWEEN s.lng - (%(radius_m)s::numeric / (111320.0 * GREATEST(cos(radians(s.lat)), 0.01)))
                    AND s.lng + (%(radius_m)s::numeric / (111320.0 * GREATEST(cos(radians(s.lat)), 0.01)))
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
WHERE distance_m <= %(radius_m)s
ORDER BY same_owner DESC, distance_m ASC, address ASC, pin ASC
LIMIT %(limit)s;
