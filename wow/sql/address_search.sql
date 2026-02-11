SELECT
    pin,
    housenumber,
    streetname,
    address,
    city,
    state,
    zip
FROM wow_parcels
WHERE coalesce(address, '') ILIKE '%%' || %(q)s || '%%'
   OR (coalesce(housenumber, '') || ' ' || coalesce(streetname, '')) ILIKE '%%' || %(q)s || '%%'
ORDER BY address
LIMIT 5;
