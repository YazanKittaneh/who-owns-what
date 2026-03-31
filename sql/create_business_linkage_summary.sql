DROP TABLE IF EXISTS wow_business_linkage_summary;
DROP TABLE IF EXISTS wow_business_linkage_matches;

CREATE TABLE wow_business_linkage_matches AS
WITH parcels AS (
    SELECT
        pin,
        upper(regexp_replace(trim(coalesce(owner_name, '')), '\s+', ' ', 'g')) AS owner_name_norm,
        upper(
            regexp_replace(
                trim(
                    concat_ws(
                        ' ',
                        coalesce(mailing_address, ''),
                        coalesce(mailing_city, ''),
                        coalesce(mailing_state, ''),
                        coalesce(mailing_zip, '')
                    )
                ),
                '[^A-Z0-9]+',
                ' ',
                'g'
            )
        ) AS mailing_addr_norm
    FROM wow_parcels
),
license_entities AS (
    SELECT DISTINCT
        account_number,
        upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')) AS legal_name_norm,
        legal_name,
        upper(
            regexp_replace(
                trim(
                    concat_ws(
                        ' ',
                        coalesce(address, ''),
                        coalesce(city, ''),
                        coalesce(state, ''),
                        coalesce(zip_code, '')
                    )
                ),
                '[^A-Z0-9]+',
                ' ',
                'g'
            )
        ) AS business_addr_norm
    FROM chi_business_licenses
),
owner_entities AS (
    SELECT DISTINCT
        account_number,
        upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')) AS legal_name_norm,
        legal_name,
        upper(
            regexp_replace(
                trim(
                    concat_ws(
                        ' ',
                        coalesce(owner_first_name, ''),
                        coalesce(owner_middle_initial, ''),
                        coalesce(owner_last_name, ''),
                        coalesce(suffix, '')
                    )
                ),
                '\s+',
                ' ',
                'g'
            )
        ) AS owner_person_norm,
        upper(regexp_replace(trim(coalesce(legal_entity_owner, '')), '\s+', ' ', 'g')) AS legal_entity_owner_norm
    FROM chi_business_owners
),
name_matches AS (
    SELECT DISTINCT
        p.pin,
        'business_name'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name
    FROM parcels AS p
    JOIN license_entities AS l ON p.owner_name_norm <> '' AND p.owner_name_norm = l.legal_name_norm
    UNION
    SELECT DISTINCT
        p.pin,
        'business_owner_legal_name'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name
    FROM parcels AS p
    JOIN owner_entities AS o ON p.owner_name_norm <> '' AND p.owner_name_norm = o.legal_name_norm
    UNION
    SELECT DISTINCT
        p.pin,
        'business_owner_person'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name
    FROM parcels AS p
    JOIN owner_entities AS o ON p.owner_name_norm <> '' AND p.owner_name_norm = o.owner_person_norm
    UNION
    SELECT DISTINCT
        p.pin,
        'business_owner_entity_owner'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name
    FROM parcels AS p
    JOIN owner_entities AS o ON p.owner_name_norm <> '' AND p.owner_name_norm = o.legal_entity_owner_norm
),
address_matches AS (
    SELECT DISTINCT
        p.pin,
        'business_address'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name
    FROM parcels AS p
    JOIN license_entities AS l ON p.mailing_addr_norm <> '' AND p.mailing_addr_norm = l.business_addr_norm
)
SELECT * FROM name_matches
UNION
SELECT * FROM address_matches;

CREATE INDEX ON wow_business_linkage_matches (pin);
CREATE INDEX ON wow_business_linkage_matches (match_type);

CREATE TABLE wow_business_linkage_summary AS
SELECT
    pin,
    count(*) FILTER (WHERE match_type <> 'business_address') AS business_name_match_count,
    count(*) FILTER (WHERE match_type = 'business_address') AS business_address_match_count,
    array_remove(array_agg(DISTINCT matched_name), NULL) AS matched_business_names,
    array_remove(array_agg(DISTINCT account_number), NULL) AS matched_business_account_numbers
FROM wow_business_linkage_matches
GROUP BY pin;

CREATE INDEX ON wow_business_linkage_summary (pin);
