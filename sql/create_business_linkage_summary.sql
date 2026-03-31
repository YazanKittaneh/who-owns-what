DROP TABLE IF EXISTS wow_business_linkage_summary;
DROP TABLE IF EXISTS wow_business_linkage_matches;

CREATE TABLE wow_business_linkage_matches AS
WITH parcels AS (
    SELECT
        pin,
        upper(regexp_replace(trim(coalesce(owner_name, '')), '\s+', ' ', 'g')) AS owner_name_norm,
        trim(
            regexp_replace(
                upper(regexp_replace(trim(coalesce(owner_name, '')), '\s+', ' ', 'g')),
                '\m(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L P|LLP|L L P|PC|P C|PLLC|P L L C)\M',
                ' ',
                'g'
            )
        ) AS owner_name_core_norm,
        upper(regexp_replace(trim(coalesce(owner_name, '')), '\s+', ' ', 'g')) ~
            '\m(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L P|LLP|L L P|PC|P C|PLLC|P L L C|TRUST|BANK)\M'
            AS owner_name_has_entity_tokens,
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
        ) AS mailing_addr_full_norm,
        upper(
            regexp_replace(
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
                    '\m(APT|APARTMENT|UNIT|STE|SUITE|FL|FLOOR|RM|ROOM|#)\M\s*[A-Z0-9-]*',
                    ' ',
                    'g'
                ),
                '[^A-Z0-9]+',
                ' ',
                'g'
            )
        ) AS mailing_addr_no_unit_norm,
        regexp_replace(coalesce(mailing_zip, ''), '[^0-9]', '', 'g') AS mailing_zip_norm
    FROM wow_parcels
),
license_entities_base AS (
    SELECT DISTINCT
        account_number,
        legal_name,
        upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')) AS legal_name_norm,
        trim(
            regexp_replace(
                upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')),
                '\m(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L P|LLP|L L P|PC|P C|PLLC|P L L C)\M',
                ' ',
                'g'
            )
        ) AS legal_name_core_norm,
        upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')) ~
            '\m(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L P|LLP|L L P|PC|P C|PLLC|P L L C|TRUST|BANK)\M'
            AS legal_name_has_entity_tokens,
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
        ) AS business_addr_full_norm,
        upper(
            regexp_replace(
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
                    '\m(APT|APARTMENT|UNIT|STE|SUITE|FL|FLOOR|RM|ROOM|#)\M\s*[A-Z0-9-]*',
                    ' ',
                    'g'
                ),
                '[^A-Z0-9]+',
                ' ',
                'g'
            )
        ) AS business_addr_no_unit_norm,
        regexp_replace(coalesce(zip_code, ''), '[^0-9]', '', 'g') AS business_zip_norm
    FROM chi_business_licenses
    WHERE coalesce(account_number, '') <> ''
      AND coalesce(legal_name, '') <> ''
),
license_name_counts AS (
    SELECT legal_name_norm, count(DISTINCT account_number) AS legal_name_account_count
    FROM license_entities_base
    WHERE legal_name_norm <> ''
    GROUP BY legal_name_norm
),
license_core_name_counts AS (
    SELECT legal_name_core_norm, count(DISTINCT account_number) AS legal_name_core_account_count
    FROM license_entities_base
    WHERE legal_name_core_norm <> ''
    GROUP BY legal_name_core_norm
),
license_address_counts AS (
    SELECT business_addr_no_unit_norm, count(DISTINCT account_number) AS business_addr_account_count
    FROM license_entities_base
    WHERE business_addr_no_unit_norm <> ''
    GROUP BY business_addr_no_unit_norm
),
license_entities AS (
    SELECT
        l.*,
        coalesce(n.legal_name_account_count, 0) AS legal_name_account_count,
        coalesce(c.legal_name_core_account_count, 0) AS legal_name_core_account_count,
        coalesce(a.business_addr_account_count, 0) AS business_addr_account_count
    FROM license_entities_base AS l
    LEFT JOIN license_name_counts AS n USING (legal_name_norm)
    LEFT JOIN license_core_name_counts AS c USING (legal_name_core_norm)
    LEFT JOIN license_address_counts AS a USING (business_addr_no_unit_norm)
),
owner_entities_base AS (
    SELECT DISTINCT
        account_number,
        legal_name,
        upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')) AS legal_name_norm,
        trim(
            regexp_replace(
                upper(regexp_replace(trim(coalesce(legal_name, '')), '\s+', ' ', 'g')),
                '\m(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L P|LLP|L L P|PC|P C|PLLC|P L L C)\M',
                ' ',
                'g'
            )
        ) AS legal_name_core_norm,
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
    WHERE coalesce(account_number, '') <> ''
),
owner_person_counts AS (
    SELECT owner_person_norm, count(DISTINCT account_number) AS owner_person_account_count
    FROM owner_entities_base
    WHERE owner_person_norm <> ''
    GROUP BY owner_person_norm
),
owner_entities AS (
    SELECT
        o.*,
        coalesce(p.owner_person_account_count, 0) AS owner_person_account_count
    FROM owner_entities_base AS o
    LEFT JOIN owner_person_counts AS p USING (owner_person_norm)
),
name_matches AS (
    SELECT DISTINCT
        p.pin,
        'business_name_exact'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name,
        100::integer AS match_score,
        NULL::text AS address_variant_used,
        (l.legal_name_account_count > 2) AS is_ambiguous
    FROM parcels AS p
    JOIN license_entities AS l
      ON p.owner_name_norm <> ''
     AND p.owner_name_norm = l.legal_name_norm
    UNION
    SELECT DISTINCT
        p.pin,
        'business_name_core'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name,
        90::integer AS match_score,
        NULL::text AS address_variant_used,
        (l.legal_name_core_account_count > 2) AS is_ambiguous
    FROM parcels AS p
    JOIN license_entities AS l
      ON p.owner_name_core_norm <> ''
     AND p.owner_name_has_entity_tokens
     AND l.legal_name_has_entity_tokens
     AND length(p.owner_name_core_norm) >= 8
     AND p.owner_name_core_norm = l.legal_name_core_norm
    UNION
    SELECT DISTINCT
        p.pin,
        'business_owner_legal_name'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name,
        95::integer AS match_score,
        NULL::text AS address_variant_used,
        false AS is_ambiguous
    FROM parcels AS p
    JOIN owner_entities AS o
      ON p.owner_name_norm <> ''
     AND p.owner_name_norm = o.legal_name_norm
),
address_matches AS (
    SELECT DISTINCT
        p.pin,
        'business_address_exact'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name,
        85::integer AS match_score,
        'full'::text AS address_variant_used,
        (l.business_addr_account_count > 3) AS is_ambiguous
    FROM parcels AS p
    JOIN license_entities AS l
      ON p.mailing_addr_full_norm <> ''
     AND p.mailing_addr_full_norm = l.business_addr_full_norm
     AND coalesce(p.mailing_zip_norm, '') = coalesce(l.business_zip_norm, '')
    UNION
    SELECT DISTINCT
        p.pin,
        'business_address_no_unit'::text AS match_type,
        l.account_number,
        l.legal_name AS matched_name,
        75::integer AS match_score,
        'no_unit'::text AS address_variant_used,
        (l.business_addr_account_count > 3) AS is_ambiguous
    FROM parcels AS p
    JOIN license_entities AS l
      ON p.mailing_addr_no_unit_norm <> ''
     AND p.mailing_addr_no_unit_norm = l.business_addr_no_unit_norm
     AND coalesce(p.mailing_zip_norm, '') = coalesce(l.business_zip_norm, '')
),
corroborated_owner_matches AS (
    SELECT DISTINCT
        p.pin,
        'business_owner_person_corroborated'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name,
        70::integer AS match_score,
        a.address_variant_used,
        false AS is_ambiguous
    FROM parcels AS p
    JOIN address_matches AS a USING (pin)
    JOIN owner_entities AS o ON o.account_number = a.account_number
    WHERE p.owner_name_norm <> ''
      AND p.owner_name_norm = o.owner_person_norm
      AND o.owner_person_account_count = 1
    UNION
    SELECT DISTINCT
        p.pin,
        'business_owner_entity_owner_corroborated'::text AS match_type,
        o.account_number,
        o.legal_name AS matched_name,
        70::integer AS match_score,
        a.address_variant_used,
        false AS is_ambiguous
    FROM parcels AS p
    JOIN address_matches AS a USING (pin)
    JOIN owner_entities AS o ON o.account_number = a.account_number
    WHERE p.owner_name_norm <> ''
      AND p.owner_name_norm = o.legal_entity_owner_norm
),
all_matches AS (
    SELECT * FROM name_matches
    UNION ALL
    SELECT * FROM address_matches
    UNION ALL
    SELECT * FROM corroborated_owner_matches
)
SELECT DISTINCT
    pin,
    match_type,
    account_number,
    matched_name,
    match_score,
    address_variant_used,
    is_ambiguous
FROM all_matches;

CREATE INDEX ON wow_business_linkage_matches (pin);
CREATE INDEX ON wow_business_linkage_matches (match_type);
CREATE INDEX ON wow_business_linkage_matches (match_score);
CREATE INDEX ON wow_business_linkage_matches (is_ambiguous);

CREATE TABLE wow_business_linkage_summary AS
SELECT
    pin,
    count(*) FILTER (WHERE NOT is_ambiguous AND match_score >= 90) AS business_name_match_count,
    count(*) FILTER (WHERE NOT is_ambiguous AND match_type LIKE 'business_address%') AS business_address_match_count,
    count(*) FILTER (WHERE is_ambiguous) AS business_ambiguous_match_count,
    max(match_score) FILTER (WHERE NOT is_ambiguous) AS business_best_match_score,
    array_remove(array_agg(DISTINCT matched_name) FILTER (WHERE NOT is_ambiguous), NULL) AS matched_business_names,
    array_remove(array_agg(DISTINCT account_number) FILTER (WHERE NOT is_ambiguous), NULL) AS matched_business_account_numbers
FROM wow_business_linkage_matches
GROUP BY pin;

CREATE INDEX ON wow_business_linkage_summary (pin);
