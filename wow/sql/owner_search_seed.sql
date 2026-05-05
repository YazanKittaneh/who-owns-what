SELECT
    pin,
    address,
    owner_id,
    owner_name,
    mailing_address,
    mailing_city,
    mailing_state,
    mailing_zip,
    land_class,
    lat,
    lng
FROM wow_parcels
WHERE pin = %(pin)s
  AND lat IS NOT NULL
  AND lng IS NOT NULL
LIMIT 1;
