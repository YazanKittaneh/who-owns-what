WITH history AS (
    SELECT
        month,
        sum(permits_total)::int AS permits_total,
        sum(violations_total)::int AS violations_total,
        sum(violations_open)::int AS violations_open,
        sum(service_requests_total)::int AS service_requests_total
    FROM wow_indicatorhistory_monthly
    WHERE pin = ANY(
        SELECT unnest(pins)
        FROM wow_portfolios
        WHERE %(pin)s = ANY(pins)
    )
    GROUP BY month
),
first_month AS (
    SELECT coalesce(min(month), date_trunc('month', current_date)::date) AS month
    FROM history
),
time_series AS (
    SELECT generate_series(
        (SELECT month FROM first_month),
        date_trunc('month', current_date)::date,
        interval '1 month'
    )::date AS month
)
SELECT
    to_char(ts.month, 'YYYY-MM') AS month,
    coalesce(h.permits_total, 0) AS permits_total,
    coalesce(h.violations_total, 0) AS violations_total,
    coalesce(h.violations_open, 0) AS violations_open,
    coalesce(h.service_requests_total, 0) AS service_requests_total
FROM time_series AS ts
LEFT JOIN history AS h USING (month)
ORDER BY ts.month ASC;
