DROP TABLE IF EXISTS chi_recorder_documents;

CREATE TABLE chi_recorder_documents (
    pin text,
    document_number text,
    document_type text,
    recorded_date text,
    execution_date text,
    consideration_amount numeric,
    street text,
    city text,
    state text,
    zip_code text,
    location text
);

CREATE INDEX ON chi_recorder_documents (pin);
CREATE INDEX ON chi_recorder_documents (document_type);
CREATE INDEX ON chi_recorder_documents (recorded_date);
