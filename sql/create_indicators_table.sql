DROP TABLE IF EXISTS wow_indicators;

CREATE TABLE wow_indicators AS
WITH parcels AS (
    SELECT
        pin,
        pin10,
        upper(
            regexp_replace(
                regexp_replace(trim(coalesce(address, '')), '\\s+(APT|UNIT|#|SUITE|STE|FL|FLOOR|RM|ROOM|P-?\\S+).*$','', 'i'),
                '\\s+',
                ' ',
                'g'
            )
        ) AS addr_norm
    FROM wow_parcels
),
permits_by_pin AS (
    SELECT
        p.pin,
        count(perm.pin10) AS permits_total
    FROM parcels AS p
    LEFT JOIN chi_permits AS cp ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            trim(pin_value) AS pin10
        FROM unnest(regexp_split_to_array(coalesce(cp.pin_list, ''), '\\s*\\|\\s*')) AS pin_value
        WHERE pin_value <> ''
    ) AS perm ON perm.pin10 = p.pin10
    GROUP BY p.pin
),
violations_norm AS (
    SELECT
        upper(
            regexp_replace(
                trim(concat_ws(' ', street_number, street_direction, street_name, street_type)),
                '\\s+',
                ' ',
                'g'
            )
        ) AS addr_norm,
        violation_status AS status
    FROM chi_violations
),
violations_by_pin AS (
    SELECT
        p.pin,
        count(v.addr_norm) AS violations_total,
        count(v.addr_norm) FILTER (
            WHERE coalesce(v.status, '') ILIKE 'open%'
        ) AS violations_open
    FROM parcels AS p
    LEFT JOIN violations_norm AS v ON v.addr_norm <> '' AND v.addr_norm = p.addr_norm
    GROUP BY p.pin
),
requests_norm AS (
    SELECT
        upper(
            regexp_replace(
                trim(concat_ws(' ', street_number, street_direction, street_name, street_type)),
                '\\s+',
                ' ',
                'g'
            )
        ) AS addr_norm
    FROM chi_311
),
requests_by_pin AS (
    SELECT
        p.pin,
        count(r.addr_norm) AS requests_311_total
    FROM parcels AS p
    LEFT JOIN requests_norm AS r ON r.addr_norm <> '' AND r.addr_norm = p.addr_norm
    GROUP BY p.pin
)
SELECT
    p.pin,
    coalesce(permits.permits_total, 0) AS permits_total,
    coalesce(viol.violations_open, 0) AS violations_open,
    coalesce(viol.violations_total, 0) AS violations_total,
    coalesce(req.requests_311_total, 0) AS requests_311_total
FROM parcels AS p
LEFT JOIN permits_by_pin AS permits ON permits.pin = p.pin
LEFT JOIN violations_by_pin AS viol ON viol.pin = p.pin
LEFT JOIN requests_by_pin AS req ON req.pin = p.pin;

CREATE INDEX ON wow_indicators (pin);
