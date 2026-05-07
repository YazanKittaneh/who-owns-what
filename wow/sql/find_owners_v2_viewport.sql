-- Find Owners V2: Viewport query
-- Returns parcel centroids within a bounding box as GeoJSON features
-- Uses lat/lng directly to avoid dependency on geom column

WITH viewport_parcels AS (
    SELECT
        p.pin,
        p.address,
        p.housenumber,
        p.streetname,
        p.owner_id,
        p.owner_name,
        p.land_class,
        p.lat,
        p.lng,
        ST_SetSRID(ST_MakePoint(p.lng::numeric, p.lat::numeric), 4326) AS geom,
        row_number() OVER (
            ORDER BY coalesce(p.units_res, 0) DESC, p.address ASC, p.pin ASC
        ) AS row_num,
        count(*) OVER ()::integer AS total_count
    FROM wow_parcels AS p
    WHERE p.lat IS NOT NULL
      AND p.lng IS NOT NULL
      AND p.lat BETWEEN %(south)s AND %(north)s
      AND p.lng BETWEEN %(west)s AND %(east)s
)
SELECT
    pin,
    address,
    housenumber,
    streetname,
    owner_id,
    owner_name,
    land_class,
    lat,
    lng,
    ST_AsGeoJSON(geom)::jsonb AS geojson,
    total_count
FROM viewport_parcels
WHERE row_num <= %(limit)s
ORDER BY row_num;
