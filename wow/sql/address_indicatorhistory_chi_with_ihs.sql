WITH portfolio_pins AS (
    SELECT unnest(pins) as pin
    FROM wow_portfolios
    WHERE %(pin)s = ANY(pins)
),
portfolio_community_area AS (
    -- Get the community area for the portfolio from chi_parcels
    SELECT DISTINCT ON (p.pin)
        p.pin,
        p.chicago_community_area_name as community_area
    FROM portfolio_pins pp
    JOIN chi_parcels p ON p.pin = pp.pin
    WHERE p.chicago_community_area_name IS NOT NULL
),
history AS (
    SELECT
        month,
        sum(permits_total)::int AS permits_total,
        sum(violations_total)::int AS violations_total,
        sum(violations_open)::int AS violations_open,
        sum(service_requests_total)::int AS service_requests_total
    FROM wow_indicatorhistory_monthly
    WHERE pin = ANY(SELECT pin FROM portfolio_pins)
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
),
-- Get IHS data for the community area (aggregated to year level)
ihs_data AS (
    SELECT
        i.year::int as year,
        MAX(CASE WHEN i.indicator_slug = 'total-sales-activity' THEN i.value END) as ihs_sales,
        MAX(CASE WHEN i.indicator_slug = 'total-foreclosure-activity' THEN i.value END) as ihs_foreclosures,
        MAX(CASE WHEN i.indicator_slug = 'total-mortgage-activity' THEN i.value END) as ihs_mortgages,
        MAX(CASE WHEN i.indicator_slug = 'total-auctions' THEN i.value END) as ihs_auctions,
        MAX(CASE WHEN i.indicator_slug = 'share-sales-business' THEN i.value END) as ihs_business_buyers
    FROM ihs_indicators i
    JOIN portfolio_community_area ca ON ca.community_area = i.geography_name
    WHERE i.area_slug = 'chicago-community-areas'
    GROUP BY i.year
)
SELECT
    to_char(ts.month, 'YYYY-MM') AS month,
    coalesce(h.permits_total, 0) AS permits_total,
    coalesce(h.violations_total, 0) AS violations_total,
    coalesce(h.violations_open, 0) AS violations_open,
    coalesce(h.service_requests_total, 0) AS service_requests_total,
    -- IHS indicators (only populated for January of each year to avoid duplication)
    CASE WHEN EXTRACT(MONTH FROM ts.month) = 1 THEN i.ihs_sales END as ihs_sales,
    CASE WHEN EXTRACT(MONTH FROM ts.month) = 1 THEN i.ihs_foreclosures END as ihs_foreclosures,
    CASE WHEN EXTRACT(MONTH FROM ts.month) = 1 THEN i.ihs_mortgages END as ihs_mortgages,
    CASE WHEN EXTRACT(MONTH FROM ts.month) = 1 THEN i.ihs_auctions END as ihs_auctions,
    CASE WHEN EXTRACT(MONTH FROM ts.month) = 1 THEN i.ihs_business_buyers END as ihs_business_buyers
FROM time_series AS ts
LEFT JOIN history AS h USING (month)
LEFT JOIN ihs_data i ON i.year = EXTRACT(YEAR FROM ts.month)::int
ORDER BY ts.month ASC;
