DROP TABLE IF EXISTS bor_search_results;

CREATE TABLE bor_search_results (
    address text,
    pin text,
    year text,
    prop_no text,
    trunk_no text,
    seq_no text,
    result_id text,
    searched_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON bor_search_results (pin);
CREATE INDEX ON bor_search_results (year);
CREATE INDEX ON bor_search_results (address);
