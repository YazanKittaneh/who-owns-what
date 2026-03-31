DROP TABLE IF EXISTS chi_business_owners;
DROP TABLE IF EXISTS chi_business_licenses;
DROP TABLE IF EXISTS il_sos_corporations_master;
DROP TABLE IF EXISTS il_sos_corporations_agents;
DROP TABLE IF EXISTS il_sos_llc_master;
DROP TABLE IF EXISTS il_sos_llc_agents;

CREATE TABLE chi_business_owners (
    account_number text,
    legal_name text,
    owner_first_name text,
    owner_middle_initial text,
    owner_last_name text,
    suffix text,
    legal_entity_owner text,
    title text
);

CREATE TABLE chi_business_licenses (
    id text,
    license_id text,
    account_number text,
    site_number text,
    legal_name text,
    doing_business_as_name text,
    address text,
    city text,
    state text,
    zip_code text,
    ward text,
    precinct text,
    ward_precinct text,
    police_district text,
    community_area text,
    community_area_name text,
    neighborhood text,
    license_code text,
    license_description text,
    business_activity_id text,
    business_activity text,
    license_number text,
    application_type text,
    application_created_date text,
    application_requirements_complete text,
    payment_date text,
    conditional_approval text,
    license_term_start_date text,
    license_term_expiration_date text,
    license_approved_for_issuance text,
    date_issued text,
    license_status text,
    license_status_change_date text,
    ssa text,
    latitude numeric,
    longitude numeric,
    location text
);

-- Placeholder tables for the official Illinois SOS bulk files.
-- Keep these definitions loose until the ZIP contents are pulled and profiled.
CREATE TABLE il_sos_corporations_master (
    raw_record jsonb
);

CREATE TABLE il_sos_corporations_agents (
    raw_record jsonb
);

CREATE TABLE il_sos_llc_master (
    raw_record jsonb
);

CREATE TABLE il_sos_llc_agents (
    raw_record jsonb
);

CREATE INDEX ON chi_business_owners (account_number);
CREATE INDEX ON chi_business_owners (legal_name);
CREATE INDEX ON chi_business_licenses (account_number);
CREATE INDEX ON chi_business_licenses (legal_name);
CREATE INDEX ON chi_business_licenses (address);
