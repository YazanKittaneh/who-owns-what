SELECT
    pin,
    business_name_match_count,
    business_address_match_count,
    business_ambiguous_match_count,
    business_best_match_score,
    matched_business_names,
    matched_business_account_numbers
FROM wow_business_linkage_summary
WHERE pin = %(pin)s
