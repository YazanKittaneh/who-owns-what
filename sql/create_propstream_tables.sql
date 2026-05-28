CREATE TABLE IF NOT EXISTS propstream_parcel_records (
    pin text PRIMARY KEY,
    records jsonb NOT NULL DEFAULT '[]'::jsonb,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);
