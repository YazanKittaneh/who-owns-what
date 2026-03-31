DROP TABLE IF EXISTS wow_recorder_summary;

CREATE TABLE wow_recorder_summary AS
WITH docs AS (
    SELECT
        regexp_replace(pin, '[^0-9]', '', 'g') AS pin_norm,
        upper(trim(coalesce(document_type, ''))) AS document_type,
        CASE
            WHEN trim(coalesce(recorded_date, '')) <> '' THEN to_date(recorded_date, 'MM/DD/YYYY')
            ELSE NULL
        END AS recorded_dt,
        CASE
            WHEN trim(coalesce(execution_date, '')) <> '' THEN to_date(execution_date, 'MM/DD/YYYY')
            ELSE NULL
        END AS execution_dt,
        consideration_amount,
        document_number
    FROM chi_recorder_documents
    WHERE regexp_replace(pin, '[^0-9]', '', 'g') <> ''
),
latest_mortgage AS (
    SELECT DISTINCT ON (pin_norm)
        pin_norm,
        recorded_dt,
        consideration_amount
    FROM docs
    WHERE document_type = 'MORTGAGE'
    ORDER BY pin_norm, recorded_dt DESC NULLS LAST, document_number DESC NULLS LAST
),
latest_quitclaim AS (
    SELECT DISTINCT ON (pin_norm)
        pin_norm,
        recorded_dt,
        consideration_amount
    FROM docs
    WHERE document_type LIKE 'QUIT%'
    ORDER BY pin_norm, recorded_dt DESC NULLS LAST, document_number DESC NULLS LAST
)
SELECT
    p.pin,
    count(d.pin_norm) AS recorder_doc_count,
    count(*) FILTER (WHERE d.document_type = 'MORTGAGE') AS mortgage_doc_count,
    count(*) FILTER (WHERE d.document_type LIKE 'QUIT%') AS quitclaim_doc_count,
    count(*) FILTER (WHERE d.document_type LIKE '%FORECLOS%') AS foreclosure_doc_count,
    max(d.recorded_dt) AS latest_recorder_doc_date,
    lm.recorded_dt AS latest_mortgage_date,
    lm.consideration_amount AS latest_mortgage_amount,
    lq.recorded_dt AS latest_quitclaim_date,
    lq.consideration_amount AS latest_quitclaim_amount
FROM wow_parcels AS p
LEFT JOIN docs AS d ON d.pin_norm = p.pin
LEFT JOIN latest_mortgage AS lm ON lm.pin_norm = p.pin
LEFT JOIN latest_quitclaim AS lq ON lq.pin_norm = p.pin
GROUP BY p.pin, lm.recorded_dt, lm.consideration_amount, lq.recorded_dt, lq.consideration_amount;

CREATE INDEX ON wow_recorder_summary (pin);
