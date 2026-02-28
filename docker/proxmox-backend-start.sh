#!/usr/bin/env bash

set -euo pipefail

cd /wow

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set"
  exit 1
fi

DB_WAIT_MAX_ATTEMPTS="${DB_WAIT_MAX_ATTEMPTS:-120}"
DB_WAIT_SLEEP_SECONDS="${DB_WAIT_SLEEP_SECONDS:-5}"

attempt=1
until pg_isready -d "${DATABASE_URL}" >/dev/null 2>&1; do
  if (( attempt >= DB_WAIT_MAX_ATTEMPTS )); then
    echo "Postgres did not become ready after ${DB_WAIT_MAX_ATTEMPTS} attempts."
    exit 1
  fi
  echo "Waiting for Postgres (${attempt}/${DB_WAIT_MAX_ATTEMPTS})..."
  sleep "${DB_WAIT_SLEEP_SECONDS}"
  ((attempt++))
done

echo "Postgres is ready."

sentinel_exists="$(
  psql "${DATABASE_URL}" -Atqc \
    "SELECT COALESCE(to_regclass('public.wow_portfolios') IS NOT NULL, FALSE);"
)"
sentinel_exists="$(echo "${sentinel_exists}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

if [[ "${sentinel_exists}" == "t" || "${sentinel_exists}" == "true" ]]; then
  echo "WOW tables already exist. Skipping seed."
else
  echo "WOW tables not found. Seeding database with 'python dbtool.py builddb'..."
  python dbtool.py builddb
  echo "Database seed completed."
fi

echo "Starting backend on 0.0.0.0:8000..."
exec gunicorn project.wsgi:application --bind 0.0.0.0:8000
