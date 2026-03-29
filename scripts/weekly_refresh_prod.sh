#!/bin/sh
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

REPO_DIR=/root/who-owns-what
DATA_DIR="$REPO_DIR/data"
STAGE_DIR="$DATA_DIR/weekly-refresh-staging"
ARCHIVE_DIR="$DATA_DIR/pre-weekly-refresh-latest"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.prod.yml --profile with-cloudflare"
DATASETS="chi_parcels chi_owners chi_permits chi_violations chi_311"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] weekly refresh start"

mkdir -p "$STAGE_DIR"

cd "$REPO_DIR"
python3 scripts/fetch_chi_data.py --output-dir "$STAGE_DIR" --resume --sleep-secs 1.0 --max-retries 10

for dataset in $DATASETS; do
    file="$STAGE_DIR/$dataset.csv"
    if [ ! -s "$file" ]; then
        echo "Missing or empty staged file: $file" >&2
        exit 1
    fi
done

rm -rf "$ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR"
for dataset in $DATASETS; do
    mv "$DATA_DIR/$dataset.csv" "$ARCHIVE_DIR/"
    mv "$STAGE_DIR/$dataset.csv" "$DATA_DIR/"
done

$COMPOSE exec -T db psql -U wow -d wow -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
$COMPOSE run --rm -T -v "$DATA_DIR:/app/data" api python dbtool.py builddb --update

rm -f "$STAGE_DIR"/*.progress "$STAGE_DIR"/*.tmp

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] weekly refresh complete"
