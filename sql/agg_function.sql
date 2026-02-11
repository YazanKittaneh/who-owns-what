DROP FUNCTION IF EXISTS get_agg_info_from_pin(text);

CREATE OR REPLACE FUNCTION get_agg_info_from_pin(_pin text)
RETURNS TABLE (
    parcels integer,
    units_res integer,
    permits_total integer,
    violations_open integer,
    violations_total integer,
    requests_311_total integer
) AS $$
    SELECT
        COUNT(p.pin)::integer AS parcels,
        COALESCE(SUM(p.units_res), 0)::integer AS units_res,
        COALESCE(SUM(i.permits_total), 0)::integer AS permits_total,
        COALESCE(SUM(i.violations_open), 0)::integer AS violations_open,
        COALESCE(SUM(i.violations_total), 0)::integer AS violations_total,
        COALESCE(SUM(i.requests_311_total), 0)::integer AS requests_311_total
    FROM wow_parcels AS p
    LEFT JOIN wow_indicators AS i USING(pin)
    WHERE p.pin = ANY(
        SELECT unnest(pins)
        FROM wow_portfolios
        WHERE _pin = ANY(pins)
    );
$$ LANGUAGE SQL;
