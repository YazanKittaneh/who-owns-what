DROP TABLE IF EXISTS woodstock_mortgage_metadata;

CREATE TABLE woodstock_mortgage_metadata (
    filename text,
    year text,
    sheet_name text,
    sheet_range text,
    row_count integer,
    column_count integer
);

-- Placeholder for actual mortgage data if/when we extract it
-- For now we just store the metadata since the files are very large
-- and would need selective column extraction

CREATE INDEX ON woodstock_mortgage_metadata (year);
