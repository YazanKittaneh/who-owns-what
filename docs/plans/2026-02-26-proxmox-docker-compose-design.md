# Proxmox Docker Compose Seed-on-Empty Design

## Goal

Add a Proxmox-oriented Docker Compose setup that runs the backend and PostGIS locally, seeds the WOW database using `python dbtool.py builddb` on first boot only, and keeps the backend running across container restarts.

## Scope

- Add a new Compose file for Proxmox deployment usage.
- Add a backend startup script that waits for Postgres, detects an empty WOW DB, and runs `dbtool.py builddb` only when needed.
- Reuse existing repository Docker image/tooling and `.env` variables (including optional OCA S3 credentials).

## Non-Goals

- Replacing the existing development `docker-compose.yml`.
- Adding a full Postgres dump restore pipeline.
- Frontend container/runtime changes.

## Architecture

### Services

- `db`: `postgis/postgis` container with a persistent named volume for Postgres data.
- `backend`: existing project image, started with a bootstrap shell script.

### Bootstrap Flow

1. Backend waits for Postgres readiness.
2. Backend checks for a sentinel WOW table (`public.wow_portfolios`) using `psql`.
3. If missing, backend runs `python dbtool.py builddb`.
4. Backend starts `gunicorn` and remains running.

### Seed Idempotency

- The seed runs only when the Postgres volume is fresh/empty (no sentinel table).
- Subsequent restarts skip seeding and start the backend immediately.

## Environment / Config

- Use `.env` (existing repo format) for Django settings and optional OCA S3 credentials:
  - `DATABASE_URL`
  - `OCA_S3_BUCKET`
  - `AWS_ACCESS_KEY`
  - `AWS_SECRET_KEY`
  - required Django tokens/keys already documented in `.env.sample`
- Compose should override `DATABASE_URL` to target the local `db` service (`db` hostname) for this deployment path.

## Error Handling

- If Postgres is not ready yet, the bootstrap script retries with logs.
- If `builddb` fails (network, upstream data, S3 creds, etc.), the backend exits non-zero so Compose restart policy can retry and logs remain visible.

## Validation

- `docker compose -f docker-compose.proxmox.yml config` succeeds.
- Shell bootstrap script passes `bash -n`.
- First run seeds data and starts backend.
- Restart skips seeding when Postgres volume already contains `wow_portfolios`.
