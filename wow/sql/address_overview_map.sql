WITH viewport AS (
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.owner_name,
        p.units_res,
        p.lat,
        p.lng
    FROM wow_parcels AS p
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN %(south)s AND %(north)s
      AND p.lng BETWEEN %(west)s AND %(east)s
), ranked AS (
    SELECT
        v.pin,
        v.housenumber,
        v.streetname,
        v.address,
        v.city,
        v.state,
        v.zip,
        v.owner_name,
        v.lat,
        v.lng,
        row_number() OVER (
            ORDER BY coalesce(v.units_res, 0) DESC, v.address ASC, v.pin ASC
        ) AS row_num,
        count(*) OVER ()::integer AS total_count
    FROM viewport AS v
)
SELECT
    pin,
    housenumber,
    streetname,
    address,
    city,
    state,
    zip,
    owner_name,
    lat,
    lng,
    total_count
FROM ranked
WHERE row_num <= %(limit)s
ORDER BY row_num;
