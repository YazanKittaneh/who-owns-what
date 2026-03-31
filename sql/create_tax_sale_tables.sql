DROP TABLE IF EXISTS chi_tax_sale_annual;
DROP TABLE IF EXISTS chi_tax_sale_scavenger;

CREATE TABLE chi_tax_sale_annual (
    tax_sale_year text,
    pin text,
    classification text,
    township_name text,
    sold_at_sale text,
    tax_amount_offered numeric,
    penalty_amount_offered numeric,
    total_tax_and_penalty_amount_offered numeric,
    cost numeric,
    total_amount_paid numeric,
    total_amount_forfeited numeric,
    winning_bid_percent numeric,
    buyer_name text,
    location_1 text
);

CREATE TABLE chi_tax_sale_scavenger (
    tax_sale_year text,
    pin text,
    from_year text,
    to_year text,
    total_amount_paid numeric,
    sold_at_sale text,
    vol text,
    township_name text,
    buyer_number text,
    buyer_name text,
    location_1 text
);

CREATE INDEX ON chi_tax_sale_annual (pin);
CREATE INDEX ON chi_tax_sale_scavenger (pin);
CREATE INDEX ON chi_tax_sale_annual (tax_sale_year);
CREATE INDEX ON chi_tax_sale_scavenger (tax_sale_year);
