WITH address_prefix AS (
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        0 AS priority
    FROM wow_parcels AS p
    WHERE trim(%(q)s) <> ''
      AND p.address IS NOT NULL
      AND lower(p.address) LIKE lower(trim(%(q)s)) || '%%'
    LIMIT 5
),
street_prefix AS (
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        1 AS priority
    FROM wow_parcels AS p
    WHERE trim(%(q)s) <> ''
      AND p.streetname IS NOT NULL
      AND lower(p.streetname) LIKE lower(trim(%(q)s)) || '%%'
    LIMIT 5
),
housenumber_prefix AS (
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        3 AS priority
    FROM wow_parcels AS p
    WHERE trim(%(q)s) <> ''
      AND p.housenumber IS NOT NULL
      AND lower(p.housenumber) LIKE lower(trim(%(q)s)) || '%%'
    LIMIT 5
),
full_address_prefix AS (
    SELECT
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        4 AS priority
    FROM wow_parcels AS p
    WHERE trim(%(q)s) <> ''
      AND (coalesce(lower(p.housenumber), '') || ' ' || coalesce(lower(p.streetname), ''))
            LIKE lower(trim(%(q)s)) || '%%'
    LIMIT 5
),
candidates AS (
    SELECT * FROM address_prefix
    UNION ALL
    SELECT * FROM street_prefix
    UNION ALL
    SELECT * FROM housenumber_prefix
    UNION ALL
    SELECT * FROM full_address_prefix
),
deduped AS (
    SELECT DISTINCT ON (c.pin)
        c.pin,
        c.housenumber,
        c.streetname,
        c.address,
        c.city,
        c.state,
        c.zip,
        c.priority
    FROM candidates AS c
    ORDER BY c.pin, c.priority
)
SELECT
    d.pin,
    d.housenumber,
    d.streetname,
    d.address,
    d.city,
    d.state,
    d.zip
FROM deduped AS d
ORDER BY d.priority, d.address
LIMIT 5;
