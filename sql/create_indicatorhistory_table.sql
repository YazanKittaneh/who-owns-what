DROP TABLE IF EXISTS wow_indicatorhistory_monthly;

CREATE TABLE wow_indicatorhistory_monthly AS
WITH parcels AS (
    SELECT
        pin,
        pin10,
        upper(
            regexp_replace(
                regexp_replace(
                    trim(coalesce(address, '')),
                    '\\s+(APT|UNIT|#|SUITE|STE|FL|FLOOR|RM|ROOM|P-?\\S+).*$',
                    '',
                    'i'
                ),
                '\\s+',
                ' ',
                'g'
            )
        ) AS addr_norm
    FROM wow_parcels
),
permits_expanded AS (
    SELECT
        trim(pin_value) AS pin10,
        date_trunc('month', left(cp.issue_date, 10)::date)::date AS month
    FROM chi_permits AS cp
    CROSS JOIN LATERAL unnest(
        regexp_split_to_array(coalesce(cp.pin_list, ''), '\\s*\\|\\s*')
    ) AS pin_value
    WHERE pin_value <> ''
      AND cp.issue_date IS NOT NULL
      AND cp.issue_date <> ''
      AND left(cp.issue_date, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
),
permits AS (
    SELECT
        p.pin,
        pe.month,
        count(*)::int AS permits_total
    FROM permits_expanded AS pe
    JOIN parcels AS p ON p.pin10 = pe.pin10
    GROUP BY p.pin, pe.month
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
        date_trunc('month', left(violation_date, 10)::date)::date AS month,
        violation_status
    FROM chi_violations
    WHERE violation_date IS NOT NULL
      AND violation_date <> ''
      AND left(violation_date, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
),
violations AS (
    SELECT
        p.pin,
        vn.month,
        count(*)::int AS violations_total,
        count(*) FILTER (
            WHERE coalesce(vn.violation_status, '') ILIKE 'open%%'
        )::int AS violations_open
    FROM violations_norm AS vn
    JOIN parcels AS p ON p.addr_norm <> '' AND p.addr_norm = vn.addr_norm
    GROUP BY p.pin, vn.month
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
        ) AS addr_norm,
        date_trunc('month', left(created_date, 10)::date)::date AS month
    FROM chi_311
    WHERE created_date IS NOT NULL
      AND created_date <> ''
      AND left(created_date, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
),
service_requests AS (
    SELECT
        p.pin,
        rn.month,
        count(*)::int AS service_requests_total
    FROM requests_norm AS rn
    JOIN parcels AS p ON p.addr_norm <> '' AND p.addr_norm = rn.addr_norm
    GROUP BY p.pin, rn.month
),
months_with_activity AS (
    SELECT pin, month FROM permits
    UNION
    SELECT pin, month FROM violations
    UNION
    SELECT pin, month FROM service_requests
)
SELECT
    mwa.pin,
    mwa.month,
    coalesce(p.permits_total, 0) AS permits_total,
    coalesce(v.violations_total, 0) AS violations_total,
    coalesce(v.violations_open, 0) AS violations_open,
    coalesce(sr.service_requests_total, 0) AS service_requests_total
FROM months_with_activity AS mwa
LEFT JOIN permits AS p USING (pin, month)
LEFT JOIN violations AS v USING (pin, month)
LEFT JOIN service_requests AS sr USING (pin, month);

CREATE INDEX ON wow_indicatorhistory_monthly (pin, month);
CREATE INDEX ON wow_indicatorhistory_monthly (pin);
