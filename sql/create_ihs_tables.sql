DROP TABLE IF EXISTS ihs_indicators;

CREATE TABLE ihs_indicators (
    indicator_slug text,
    indicator_title text,
    property_type text,
    area_slug text,
    geography_name text,
    year text,
    value numeric,
    is_percentage boolean
);

CREATE INDEX ON ihs_indicators (indicator_slug);
CREATE INDEX ON ihs_indicators (geography_name);
CREATE INDEX ON ihs_indicators (year);
CREATE INDEX ON ihs_indicators (geography_name, year);
