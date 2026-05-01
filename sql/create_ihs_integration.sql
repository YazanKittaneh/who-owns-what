-- Extend the indicator history to include IHS data at the geography level
-- This joins wow_portfolios with ihs_indicators via geography

DROP VIEW IF EXISTS wow_indicatorhistory_with_ihs;

CREATE VIEW wow_indicatorhistory_with_ihs AS
SELECT
    m.pin,
    m.month,
    m.permits_total,
    m.violations_total,
    m.violations_open,
    m.service_requests_total,
    -- Add IHS indicators (these are annual, so we join on year)
    i.indicator_slug,
    i.indicator_title,
    i.value as ihs_value,
    i.is_percentage
FROM wow_indicatorhistory_monthly m
LEFT JOIN ihs_indicators i
    ON i.year = EXTRACT(YEAR FROM m.month)::text
    AND i.area_slug = 'chicago-community-areas'
    AND i.geography_name = (
        -- Get the community area name for this PIN
        SELECT ca.chicago_community_area_name
        FROM chi_parcels p
        JOIN chi_geographies ca ON ca.pin10 = p.pin10
        WHERE p.pin = m.pin
        LIMIT 1
    );
