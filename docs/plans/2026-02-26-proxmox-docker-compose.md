# Proxmox Docker Compose Seed-on-Empty Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Proxmox-friendly Docker Compose setup that runs the backend with PostGIS and seeds the WOW Postgres database via `dbtool.py builddb` only on first boot (empty DB volume).

**Architecture:** Add a dedicated `docker-compose.proxmox.yml` file plus a bootstrap shell script that waits for Postgres, checks a sentinel WOW table, conditionally runs `builddb`, and then starts Gunicorn. Reuse the existing project Docker image and `.env` variables, including optional OCA S3 credentials.

**Tech Stack:** Docker Compose, Bash, PostgreSQL/PostGIS client tools (`pg_isready`, `psql`), Django/Gunicorn, existing project Dockerfile

---

### Task 1: Add backend bootstrap script

**Files:**
- Create: `/Users/yazankittaneh/code/Projects/who-owns-what/docker/proxmox-backend-start.sh`

**Step 1: Write the script with strict shell settings**

```bash
#!/usr/bin/env bash
set -euo pipefail
```

**Step 2: Add Postgres readiness loop**

Run `pg_isready -d "$DATABASE_URL"` in a retry loop with log output and bounded attempts.

**Step 3: Add seed sentinel check**

Use `psql "$DATABASE_URL" -Atqc "SELECT to_regclass('public.wow_portfolios') IS NOT NULL;"` and normalize the result.

**Step 4: Add conditional seeding**

If sentinel is missing, run:

```bash
python dbtool.py builddb
```

Else log that seeding is skipped.

**Step 5: Start backend**

Exec Gunicorn in the foreground:

```bash
exec gunicorn project.wsgi:application --bind 0.0.0.0:8000
```

### Task 2: Add Proxmox compose file

**Files:**
- Create: `/Users/yazankittaneh/code/Projects/who-owns-what/docker-compose.proxmox.yml`

**Step 1: Define `db` service**

- Use `postgis/postgis:9.6-3.2` (matches repo dev compose)
- Add `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Add a healthcheck using `pg_isready`
- Add a persistent named volume
- Add `restart: unless-stopped`

**Step 2: Define `backend` service**

- `build: .`
- `working_dir: /wow`
- `volumes: .:/wow`
- `env_file: .env`
- Override `DATABASE_URL` to `postgres://wow:wow@db/wow`
- `depends_on: db`
- `ports: "8000:8000"`
- `restart: unless-stopped`

**Step 3: Wire startup command**

Use a shell command to call the bootstrap script (not the dev `docker_django_management.py` wrapper).

### Task 3: Validate config and script syntax

**Files:**
- Validate: `/Users/yazankittaneh/code/Projects/who-owns-what/docker-compose.proxmox.yml`
- Validate: `/Users/yazankittaneh/code/Projects/who-owns-what/docker/proxmox-backend-start.sh`

**Step 1: Check shell syntax**

Run: `bash -n docker/proxmox-backend-start.sh`
Expected: no output, exit 0

**Step 2: Render Compose config**

Run: `docker compose -f docker-compose.proxmox.yml config`
Expected: merged config renders successfully

**Step 3: Review logs/instructions**

Document the startup behavior in the final response:
- first boot seeds
- later restarts skip seeding
- how to wipe and reseed (`docker compose down -v`)
