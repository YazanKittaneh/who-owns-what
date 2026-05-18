#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-who-owns-what-dev}
ENV_FILE_PATH=${ENV_FILE_PATH:-/home/actions/who-owns-what-dev.env}
COMPOSE_FILE_PATH=${COMPOSE_FILE_PATH:-$ROOT_DIR/docker-compose.prod.yml}
WOW_DB_BOOTSTRAP_DUMP=${WOW_DB_BOOTSTRAP_DUMP:-}
WOW_DB_BOOTSTRAP_GLOB=${WOW_DB_BOOTSTRAP_GLOB:-/backup-pool/dump/wow-backups/wow-*.dump}

compose=(docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE_PATH" -f "$COMPOSE_FILE_PATH")

echo "=== Ensuring dev database container is running ==="
"${compose[@]}" up -d db >/dev/null

db_container_id=$("${compose[@]}" ps -q db)
if [ -z "$db_container_id" ]; then
  echo "❌ Could not determine dev db container id"
  "${compose[@]}" ps
  exit 1
fi

echo "Waiting for PostgreSQL readiness..."
for attempt in {1..18}; do
  if docker exec "$db_container_id" pg_isready -U wow -d wow >/dev/null 2>&1; then
    break
  fi
  echo "Dev DB not ready yet (attempt ${attempt}/18)."
  sleep 5
done

if ! docker exec "$db_container_id" pg_isready -U wow -d wow >/dev/null 2>&1; then
  echo "❌ Dev DB never became ready"
  exit 1
fi

has_wow_parcels=$(docker exec "$db_container_id" psql -U wow -d wow -t -A -c "SELECT to_regclass('public.wow_parcels') IS NOT NULL;")
if [ "$has_wow_parcels" = "t" ]; then
  echo "✅ Dev DB already has wow_parcels; skipping bootstrap restore"
  exit 0
fi

if [ -n "$WOW_DB_BOOTSTRAP_DUMP" ]; then
  dump_path="$WOW_DB_BOOTSTRAP_DUMP"
else
  dump_path=$(ls -1t $WOW_DB_BOOTSTRAP_GLOB 2>/dev/null | head -1 || true)
fi

if [ -z "$dump_path" ] || [ ! -f "$dump_path" ]; then
  echo "❌ No bootstrap dump found. Looked for ${WOW_DB_BOOTSTRAP_DUMP:-$WOW_DB_BOOTSTRAP_GLOB}"
  exit 1
fi

echo "=== Bootstrapping dev DB from dump ==="
echo "Using dump: $dump_path"

docker exec "$db_container_id" psql -U wow -d wow -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
docker exec -i "$db_container_id" pg_restore -U wow -d wow --clean --if-exists --no-owner < "$dump_path"

docker exec "$db_container_id" psql -U wow -d wow -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null

restored_table=$(docker exec "$db_container_id" psql -U wow -d wow -t -A -c "SELECT to_regclass('public.wow_parcels');")
if [ "$restored_table" != "wow_parcels" ]; then
  echo "❌ Restore completed but wow_parcels is still missing"
  exit 1
fi

echo "✅ Dev DB bootstrap restore completed"
