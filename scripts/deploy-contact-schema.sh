#!/bin/bash
# Deploy contact data SQL schema to production database

set -e

echo "Applying contact data schema to production database..."

# Apply schema files
docker exec -i wow-db psql -v ON_ERROR_STOP=1 -U wow -d wow < sql/create_contact_tables.sql
docker exec -i wow-db psql -v ON_ERROR_STOP=1 -U wow -d wow < sql/create_contact_functions.sql
docker exec -i wow-db psql -v ON_ERROR_STOP=1 -U wow -d wow < sql/create_contact_integration.sql

echo "✓ SQL schema applied successfully"
