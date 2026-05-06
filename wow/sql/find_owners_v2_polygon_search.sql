-- Find Owners V2: Polygon search query
-- Returns owners grouped by parcels inside a polygon (drawn by user)
-- Uses PostGIS ST_Within for spatial containment

WITH polygon AS (
    SELECT ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326) AS geom
),
candidate_parcels AS (
    SELECT
        coalesce(nullif(p.owner_id, ''), nullif(p.owner_name, ''), p.pin) AS owner_key,
        p.pin,
        p.address,
        p.owner_id,
        p.owner_name,
        p.mailing_address,
        p.mailing_city,
        p.mailing_state,
        p.mailing_zip,
        p.land_class,
        p.lat,
        p.lng,
        p.geom,
        CASE
            WHEN p.land_class IN ('201', '202', '203', '204', '205', '206', '207', '208', '210', '211') THEN 'single_family'
            WHEN p.land_class = '212' THEN 'two_flat'
            WHEN p.land_class = '234' THEN 'three_flat'
            WHEN p.land_class IN ('241', '278', '295') THEN 'multi_family'
            WHEN p.land_class = '299' THEN 'condo'
            WHEN p.land_class = '100' OR p.land_class IN ('EX', 'RR') THEN 'vacant_exempt'
            WHEN p.land_class ~ '^[3-9]' THEN 'commercial'
            ELSE 'other'
        END AS building_type,
        CASE
            WHEN p.land_class IN ('201', '202', '203', '204', '205', '206', '207', '208', '210', '211') THEN 'Single-family'
            WHEN p.land_class = '212' THEN 'Two-flat'
            WHEN p.land_class = '234' THEN 'Three-flat'
            WHEN p.land_class IN ('241', '278', '295') THEN 'Multi-family (4+)'
            WHEN p.land_class = '299' THEN 'Condo / co-op'
            WHEN p.land_class = '100' OR p.land_class IN ('EX', 'RR') THEN 'Vacant / exempt'
            WHEN p.land_class ~ '^[3-9]' THEN 'Commercial / mixed use'
            ELSE 'Other'
        END AS building_type_label
    FROM wow_parcels AS p
    CROSS JOIN polygon AS poly
    WHERE p.geom IS NOT NULL
      AND ST_Within(p.geom, poly.geom)
),
filtered_parcels AS (
    SELECT *
    FROM candidate_parcels
    WHERE (
        NOT %(apply_building_type_filter)s
        OR building_type = ANY(%(building_types)s::text[])
    )
),
limited_owners AS (
    SELECT
        owner_key,
        owner_id,
        owner_name,
        mailing_address,
        mailing_city,
        mailing_state,
        mailing_zip,
        count(*) AS parcel_count,
        min(ST_Distance(geom, (SELECT geom FROM polygon))) AS nearest_distance_m
    FROM filtered_parcels
    GROUP BY owner_key, owner_id, owner_name, mailing_address, mailing_city, mailing_state, mailing_zip
    HAVING count(*) >= %(min_parcels)s
       AND (%(max_parcels)s IS NULL OR count(*) <= %(max_parcels)s)
    ORDER BY count(*) DESC, min(ST_Distance(geom, (SELECT geom FROM polygon))) ASC, owner_name ASC NULLS LAST
    LIMIT %(limit)s
),
owner_building_type_counts AS (
    SELECT
        summary.owner_key,
        jsonb_agg(
            jsonb_build_object(
                'building_type', summary.building_type,
                'building_type_label', summary.building_type_label,
                'parcel_count', summary.parcel_count
            )
            ORDER BY summary.parcel_count DESC, summary.building_type_label ASC
        ) AS building_type_counts
    FROM (
        SELECT
            owner_key,
            building_type,
            building_type_label,
            count(*) AS parcel_count
        FROM filtered_parcels
        GROUP BY owner_key, building_type, building_type_label
    ) AS summary
    JOIN limited_owners lo ON lo.owner_key = summary.owner_key
    GROUP BY summary.owner_key
),
owner_parcels AS (
    SELECT
        fp.owner_key,
        jsonb_agg(
            jsonb_build_object(
                'pin', fp.pin,
                'address', fp.address,
                'lat', fp.lat,
                'lng', fp.lng,
                'land_class', fp.land_class,
                'building_type', fp.building_type,
                'building_type_label', fp.building_type_label
            )
            ORDER BY fp.address ASC, fp.pin ASC
        ) AS parcels
    FROM filtered_parcels fp
    JOIN limited_owners lo ON lo.owner_key = fp.owner_key
    GROUP BY fp.owner_key
)
SELECT
    lo.owner_key,
    lo.owner_id,
    lo.owner_name,
    lo.mailing_address,
    lo.mailing_city,
    lo.mailing_state,
    lo.mailing_zip,
    lo.parcel_count,
    round(lo.nearest_distance_m)::integer AS nearest_distance_m,
    coalesce(obtc.building_type_counts, '[]'::jsonb) AS building_type_counts,
    coalesce(op.parcels, '[]'::jsonb) AS parcels
FROM limited_owners lo
LEFT JOIN owner_building_type_counts obtc ON obtc.owner_key = lo.owner_key
LEFT JOIN owner_parcels op ON op.owner_key = lo.owner_key
ORDER BY lo.parcel_count DESC, lo.nearest_distance_m ASC, lo.owner_name ASC NULLS LAST;
