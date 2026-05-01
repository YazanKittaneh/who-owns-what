#!/usr/bin/env python3
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host='10.0.7.4',
    port=5432,
    database='wow',
    user='wow',
    password='wow'
)

with conn.cursor() as cursor:
    # 1. Search for the address "3137 N Kimball Ave"
    cursor.execute("""
        SELECT pin, address, lat, lng
        FROM wow_parcels
        WHERE address ILIKE '%%3137%%Kimball%%'
    """)
    target = cursor.fetchone()
    
    if not target:
        print("Address not found")
        exit(1)
    
    target_pin, target_address, target_lat, target_lon = target
    print("Target property:")
    print(f"  PIN: {target_pin}")
    print(f"  Address: {target_address}")
    print(f"  Coordinates: ({target_lat}, {target_lon})")
    print()
    
    # 2. Find nearby properties within 500 meters
    cursor.execute("""
        SELECT pin, address, lat, lng,
               111320 * SQRT(
                   POW(lng::float - %s, 2) * POW(COS(RADIANS(%s)), 2) + 
                   POW(lat::float - %s, 2)
               ) AS distance_meters
        FROM wow_parcels
        WHERE lat IS NOT NULL 
          AND lng IS NOT NULL
          AND pin != %s
          AND 111320 * SQRT(
              POW(lng::float - %s, 2) * POW(COS(RADIANS(%s)), 2) + 
              POW(lat::float - %s, 2)
          ) <= 500
        ORDER BY distance_meters
    """, (target_lon, target_lat, target_lat, target_pin, target_lon, target_lat, target_lat))
    
    nearby = cursor.fetchall()
    print(f"Found {len(nearby)} nearby properties within 500 meters:")
    print()
    
    pins = []
    for row in nearby:
        pin, address, lat, lng, distance = row
        pins.append(pin)
        print(f"PIN: {pin} ({distance:.1f}m)")
    
    print()
    print("List of nearby PINs:")
    print(pins)

conn.close()
