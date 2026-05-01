-- Create a view that aggregates IHS indicators by geography for portfolio lookup
DROP VIEW IF EXISTS ihs_indicators_by_geography;

CREATE VIEW ihs_indicators_by_geography AS
SELECT
    geography_name,
    indicator_slug,
    indicator_title,
    year,
    value,
    is_percentage
FROM ihs_indicators
WHERE area_slug = 'chicago-community-areas';

-- Create a materialized view for faster lookups (optional, can be refreshed)
DROP MATERIALIZED VIEW IF EXISTS ihs_indicators_pivot;

CREATE MATERIALIZED VIEW ihs_indicators_pivot AS
SELECT
    geography_name,
    MAX(CASE WHEN indicator_slug = 'total-sales-activity' AND year = '2024' THEN value END) as sales_2024,
    MAX(CASE WHEN indicator_slug = 'total-foreclosure-activity' AND year = '2024' THEN value END) as foreclosures_2024,
    MAX(CASE WHEN indicator_slug = 'share-sales-business' AND year = '2024' THEN value END) as business_buyer_share_2024,
    MAX(CASE WHEN indicator_slug = 'total-mortgage-activity' AND year = '2024' THEN value END) as mortgages_2024,
    MAX(CASE WHEN indicator_slug = 'total-auctions' AND year = '2024' THEN value END) as auctions_2024
FROM ihs_indicators
WHERE area_slug = 'chicago-community-areas'
GROUP BY geography_name;

CREATE INDEX ON ihs_indicators_pivot (geography_name);
