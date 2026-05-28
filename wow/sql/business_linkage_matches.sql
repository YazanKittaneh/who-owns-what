SELECT
    pin,
    match_type,
    account_number,
    matched_name,
    match_score,
    address_variant_used,
    is_ambiguous
FROM wow_business_linkage_matches
WHERE pin = %(pin)s
ORDER BY
    is_ambiguous ASC,
    match_score DESC,
    matched_name ASC,
    account_number ASC
