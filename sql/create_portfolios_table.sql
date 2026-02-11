DROP TABLE if exists wow_portfolios cascade;
CREATE TABLE wow_portfolios (
    orig_id int,
    pins text[],
    owner_names text[],
    graph jsonb
);
CREATE INDEX ON wow_portfolios (orig_id);
CREATE INDEX ON wow_portfolios USING GIN(pins);
CREATE INDEX ON wow_portfolios USING GIN(owner_names);
