WITH params AS (
    SELECT
        lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) AS query,
        CASE
            WHEN substring(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) from '^(\d+)') IS NOT NULL
                THEN substring(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) from '^(\d+)')::bigint
            ELSE NULL
        END AS query_housenumber_num,
        CASE
            WHEN substring(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) from '^(\d+)') IS NOT NULL
                THEN substring(
                    substring(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) from '^(\d+)')
                    from 1 for greatest(
                        char_length(substring(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')) from '^(\d+)')) - 1,
                        1
                    )
                )
            ELSE NULL
        END AS query_housenumber_prefix,
        CASE
            WHEN trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'north %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'north'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% north'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'n'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'n %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% n'
                THEN 'n'
            WHEN trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'south %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'south'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% south'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 's'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 's %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% s'
                THEN 's'
            WHEN trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'east %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'east'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% east'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'e'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'e %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% e'
                THEN 'e'
            WHEN trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'west %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'west'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% west'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) = 'w'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'w %%'
              OR trim(regexp_replace(lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE '%% w'
                THEN 'w'
            ELSE NULL
        END AS query_direction,
        trim(
            regexp_replace(
                regexp_replace(
                    trim(
                        regexp_replace(
                            lower(regexp_replace(trim(%(q)s), '\s+', ' ', 'g')),
                            '^\d+[a-z]?\s*',
                            ''
                        )
                    ),
                    '^(north|south|east|west|n|s|e|w)(?:\s+|$)',
                    ''
                ),
                '\s+(north|south|east|west|n|s|e|w)$',
                ''
            )
        ) AS query_street_body
),
base_candidates AS (
    (
        SELECT
            p.pin,
            p.housenumber,
            p.streetname,
            p.address,
            p.city,
            p.state,
            p.zip
        FROM wow_parcels AS p
        CROSS JOIN params
        WHERE params.query <> ''
          AND lower(p.address) LIKE params.query || '%%'
        LIMIT 15
    )

    UNION ALL

    (
        SELECT
            p.pin,
            p.housenumber,
            p.streetname,
            p.address,
            p.city,
            p.state,
            p.zip
        FROM wow_parcels AS p
        CROSS JOIN params
        WHERE params.query <> ''
          AND char_length(params.query) >= 2
          AND p.address ILIKE '%%' || params.query || '%%'
        LIMIT 25
    )

    UNION ALL

    (
        SELECT
            p.pin,
            p.housenumber,
            p.streetname,
            p.address,
            p.city,
            p.state,
            p.zip
        FROM wow_parcels AS p
        CROSS JOIN params
        WHERE params.query_street_body <> ''
          AND char_length(params.query_street_body) >= 2
          AND p.address ILIKE '%%' || params.query_street_body || '%%'
        LIMIT 40
    )

    UNION ALL

    (
        SELECT
            p.pin,
            p.housenumber,
            p.streetname,
            p.address,
            p.city,
            p.state,
            p.zip
        FROM wow_parcels AS p
        CROSS JOIN params
        WHERE params.query_housenumber_prefix IS NOT NULL
          AND params.query_direction IS NOT NULL
          AND lower(p.address) LIKE params.query_housenumber_prefix || '%%'
          AND lower(p.address) LIKE '%% ' || params.query_direction || ' %%'
        LIMIT 40
    )
),
normalized_parcels AS (
    SELECT DISTINCT ON (p.pin)
        p.pin,
        p.housenumber,
        p.streetname,
        p.address,
        p.city,
        p.state,
        p.zip,
        lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')) AS normalized_address,
        trim(
            regexp_replace(
                lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')),
                '^\d+[a-z]?\s*',
                ''
            )
        ) AS address_without_number,
        CASE
            WHEN trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'north %%'
              OR trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'n %%'
                THEN 'n'
            WHEN trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'south %%'
              OR trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 's %%'
                THEN 's'
            WHEN trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'east %%'
              OR trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'e %%'
                THEN 'e'
            WHEN trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'west %%'
              OR trim(regexp_replace(lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')), '^\d+[a-z]?\s*', '')) LIKE 'w %%'
                THEN 'w'
            ELSE NULL
        END AS street_direction,
        trim(
            regexp_replace(
                trim(
                    regexp_replace(
                        lower(regexp_replace(coalesce(p.address, ''), '\s+', ' ', 'g')),
                        '^\d+[a-z]?\s*',
                        ''
                    )
                ),
                '^(north|south|east|west|n|s|e|w)(?:\s+|$)',
                ''
            )
        ) AS street_body,
        CASE
            WHEN substring(coalesce(nullif(p.housenumber, ''), p.address, '') from '^\s*(\d+)') IS NOT NULL
                THEN substring(coalesce(nullif(p.housenumber, ''), p.address, '') from '^\s*(\d+)')::bigint
            ELSE NULL
        END AS housenumber_num
    FROM base_candidates AS p
    WHERE p.address IS NOT NULL
    ORDER BY p.pin, p.address
),
address_prefix AS (
    SELECT
        ranked.pin,
        ranked.housenumber,
        ranked.streetname,
        ranked.address,
        ranked.city,
        ranked.state,
        ranked.zip,
        ranked.priority,
        ranked.house_number_distance,
        ranked.direction_rank
    FROM (
        SELECT
            np.pin,
            np.housenumber,
            np.streetname,
            np.address,
            np.city,
            np.state,
            np.zip,
            0 AS priority,
            NULL::bigint AS house_number_distance,
            0 AS direction_rank,
            row_number() OVER (ORDER BY np.address) AS row_num
        FROM normalized_parcels AS np
        CROSS JOIN params
        WHERE params.query <> ''
          AND np.normalized_address LIKE params.query || '%%'
    ) AS ranked
    CROSS JOIN params
    WHERE params.query_street_body <> ''
       OR params.query_housenumber_num IS NULL
       OR params.query_direction IS NULL
       OR ranked.row_num <= 2
    LIMIT 5
),
nearby_housenumber AS (
    SELECT
        np.pin,
        np.housenumber,
        np.streetname,
        np.address,
        np.city,
        np.state,
        np.zip,
        1 AS priority,
        abs(np.housenumber_num - params.query_housenumber_num) AS house_number_distance,
        CASE
            WHEN params.query_direction IS NULL THEN 0
            WHEN np.street_direction = params.query_direction THEN 0
            WHEN np.street_direction IS NULL THEN 1
            ELSE 2
        END AS direction_rank
    FROM normalized_parcels AS np
    CROSS JOIN params
    WHERE params.query <> ''
      AND params.query_housenumber_num IS NOT NULL
      AND np.housenumber_num IS NOT NULL
      AND abs(np.housenumber_num - params.query_housenumber_num) <= 4
      AND (
          (
              params.query_street_body <> ''
              AND (
                  np.street_body LIKE params.query_street_body || '%%'
                  OR (
                      char_length(params.query_street_body) >= 2
                      AND np.street_body LIKE '%%' || params.query_street_body || '%%'
                  )
              )
          )
          OR (
              params.query_street_body = ''
              AND params.query_direction IS NOT NULL
              AND np.street_direction = params.query_direction
          )
      )
    LIMIT 5
),
street_prefix AS (
    SELECT
        np.pin,
        np.housenumber,
        np.streetname,
        np.address,
        np.city,
        np.state,
        np.zip,
        2 AS priority,
        NULL::bigint AS house_number_distance,
        CASE
            WHEN params.query_direction IS NULL THEN 0
            WHEN np.street_direction = params.query_direction THEN 0
            WHEN np.street_direction IS NULL THEN 1
            ELSE 2
        END AS direction_rank
    FROM normalized_parcels AS np
    CROSS JOIN params
    WHERE params.query_street_body <> ''
      AND np.street_body LIKE params.query_street_body || '%%'
    LIMIT 5
),
street_contains AS (
    SELECT
        np.pin,
        np.housenumber,
        np.streetname,
        np.address,
        np.city,
        np.state,
        np.zip,
        3 AS priority,
        NULL::bigint AS house_number_distance,
        CASE
            WHEN params.query_direction IS NULL THEN 0
            WHEN np.street_direction = params.query_direction THEN 0
            WHEN np.street_direction IS NULL THEN 1
            ELSE 2
        END AS direction_rank
    FROM normalized_parcels AS np
    CROSS JOIN params
    WHERE params.query_street_body <> ''
      AND np.street_body LIKE '%%' || params.query_street_body || '%%'
      AND np.street_body NOT LIKE params.query_street_body || '%%'
    LIMIT 5
),
address_contains AS (
    SELECT
        np.pin,
        np.housenumber,
        np.streetname,
        np.address,
        np.city,
        np.state,
        np.zip,
        4 AS priority,
        NULL::bigint AS house_number_distance,
        CASE
            WHEN params.query_direction IS NULL THEN 0
            WHEN np.street_direction = params.query_direction THEN 0
            WHEN np.street_direction IS NULL THEN 1
            ELSE 2
        END AS direction_rank
    FROM normalized_parcels AS np
    CROSS JOIN params
    WHERE params.query <> ''
      AND np.normalized_address LIKE '%%' || params.query || '%%'
      AND np.normalized_address NOT LIKE params.query || '%%'
    LIMIT 5
),
candidates AS (
    SELECT * FROM address_prefix
    UNION ALL
    SELECT * FROM nearby_housenumber
    UNION ALL
    SELECT * FROM street_prefix
    UNION ALL
    SELECT * FROM street_contains
    UNION ALL
    SELECT * FROM address_contains
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
        c.priority,
        c.house_number_distance,
        c.direction_rank
    FROM candidates AS c
    ORDER BY c.pin, c.priority, c.direction_rank, c.house_number_distance NULLS LAST
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
ORDER BY d.priority, d.direction_rank, d.house_number_distance NULLS LAST, d.address
LIMIT 5;
