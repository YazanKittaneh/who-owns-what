DROP TABLE IF EXISTS wow_tax_sale_summary;

CREATE TABLE wow_tax_sale_summary AS
WITH annual_events AS (
    SELECT
        regexp_replace(pin, '[^0-9]', '', 'g') AS pin_norm,
        NULLIF(trim(tax_sale_year), '')::int AS tax_sale_year,
        CASE lower(coalesce(sold_at_sale, ''))
            WHEN 'true' THEN true
            WHEN 'false' THEN false
            ELSE NULL
        END AS sold_at_sale,
        NULLIF(trim(buyer_name), '') AS buyer_name,
        coalesce(total_amount_paid, 0) AS total_amount_paid,
        'annual'::text AS source
    FROM chi_tax_sale_annual
    WHERE regexp_replace(pin, '[^0-9]', '', 'g') <> ''
),
scavenger_events AS (
    SELECT
        regexp_replace(pin, '[^0-9]', '', 'g') AS pin_norm,
        NULLIF(trim(tax_sale_year), '')::int AS tax_sale_year,
        CASE lower(coalesce(sold_at_sale, ''))
            WHEN 'true' THEN true
            WHEN 'false' THEN false
            ELSE NULL
        END AS sold_at_sale,
        NULLIF(trim(buyer_name), '') AS buyer_name,
        coalesce(total_amount_paid, 0) AS total_amount_paid,
        'scavenger'::text AS source
    FROM chi_tax_sale_scavenger
    WHERE regexp_replace(pin, '[^0-9]', '', 'g') <> ''
),
events AS (
    SELECT * FROM annual_events
    UNION ALL
    SELECT * FROM scavenger_events
),
latest_event AS (
    SELECT DISTINCT ON (pin_norm)
        pin_norm,
        tax_sale_year,
        buyer_name,
        sold_at_sale
    FROM events
    ORDER BY pin_norm, tax_sale_year DESC NULLS LAST, source
)
SELECT
    p.pin,
    count(*) FILTER (WHERE e.source = 'annual') AS annual_tax_sale_count,
    count(*) FILTER (WHERE e.source = 'scavenger') AS scavenger_tax_sale_count,
    count(e.pin_norm) AS tax_sale_event_count,
    max(e.tax_sale_year) AS latest_tax_sale_year,
    l.buyer_name AS latest_tax_sale_buyer_name,
    l.sold_at_sale AS latest_tax_sale_sold_at_sale,
    coalesce(sum(e.total_amount_paid), 0)::numeric AS total_tax_sale_amount_paid
FROM wow_parcels AS p
LEFT JOIN events AS e ON e.pin_norm = p.pin
LEFT JOIN latest_event AS l ON l.pin_norm = p.pin
GROUP BY p.pin, l.buyer_name, l.sold_at_sale;

CREATE INDEX ON wow_tax_sale_summary (pin);
