# Deployment Guide

This guide explains how to run Who Owns What with separate `dev` and `prod` environments on the same Linux host using Docker Compose, Cloudflare Tunnels, and GitHub Actions CI/CD.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Cloudflare     │────────▶│  Your Linux VM   │
│  Tunnels        │         │  Docker Stacks   │
└─────────────────┘         └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  PostgreSQL DB   │
                            └──────────────────┘
```

- **Frontend**: Static React app served by the `frontend` service behind a Cloudflare Tunnel
- **Backend**: Django API served by the `api` service behind the same environment's tunnel
- **Database**: PostgreSQL in the `db` service, separated by Compose project name and env file
- **Environments**: `develop -> dev`, `main/master -> prod`

## Environment Layout

| Environment | Branch | Frontend | API | Compose Project | Runner Env File |
|-------------|--------|----------|-----|-----------------|-----------------|
| dev | `develop` | `https://dev-wow.yazan.io` | `https://dev-wow-api.yazan.io` | `who-owns-what-dev` | `/home/actions/who-owns-what-dev.env` |
| prod | `main`, `master` | `https://wow.yazan.io` | `https://wow-api.yazan.io` | `who-owns-what-prod` | `/home/actions/who-owns-what-prod.env` |

## Prerequisites

- Linux VM (Ubuntu 20.04+ recommended) with:
  - 2+ CPU cores
  - 4GB+ RAM
  - 20GB+ disk space
  - Public IP or domain name
- GitHub repository access
- PostgreSQL database (local or managed)

## Quick Start

### 1. Set Up Your VM

SSH into your Linux VM and run:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/who-owns-what/main/scripts/setup-server.sh | bash
```

Or manually:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/who-owns-what.git
cd who-owns-what

# Make scripts executable
chmod +x scripts/setup-server.sh

# Run setup
./scripts/setup-server.sh
```

### 2. Configure Environment Variables

Create one env file per deployed environment on the runner:

```bash
nano /home/actions/who-owns-what-dev.env
nano /home/actions/who-owns-what-prod.env
```

Required variables:

```env
# Database (PostgreSQL)
DATABASE_URL=postgres://username:password@host:5432/dbname

# Django
DEBUG=false
SECRET_KEY=your-super-secret-random-key-here
ALLOWED_HOSTS=wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://wow.yazan.io

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your-environment-specific-cloudflare-tunnel-token

# API Tokens
ALERTS_API_TOKEN=your-alerts-token
SIGNATURE_API_TOKEN=your-signature-token
ADMIN_API_TOKEN=your-dedicated-admin-token

# Error Tracking (optional)
ROLLBAR_ACCESS_TOKEN=your-rollbar-token
```

For dev, use:

```env
FRONTEND_API_BASE_URL=https://dev-wow-api.yazan.io
ALLOWED_HOSTS=dev-wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://dev-wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://dev-wow.yazan.io
```

For prod, use:

```env
FRONTEND_API_BASE_URL=https://wow-api.yazan.io
ALLOWED_HOSTS=wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://wow.yazan.io
```

### 3. Configure GitHub Actions Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Your server's IP address or domain |
| `SSH_USERNAME` | SSH username (e.g., `ubuntu`, `root`) |
| `SSH_PRIVATE_KEY` | Private key for SSH access (copy from `~/.ssh/id_rsa`) |
| `SSH_PORT` | SSH port (default: 22) |

Optional secrets:
| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK_URL` | For deployment notifications |

### 4. Configure DNS / Cloudflare

The current setup uses Cloudflare Tunnel hostnames for both environments:

```
Dev frontend:  https://dev-wow.yazan.io
Dev API:       https://dev-wow-api.yazan.io
Prod frontend: https://wow.yazan.io
Prod API:      https://wow-api.yazan.io
```

Each environment should have its own tunnel token and DNS records pointing at that tunnel's `cfargotunnel.com` hostname rather than directly to the VM IP.

### 5. Deploy

Push to `develop`, `main`, or `master` and GitHub Actions will:

1. Run `.github/workflows/ci.yml`
2. Deploy `develop` to `dev` via `.github/workflows/deploy-dev.yml`
3. Deploy `main`/`master` to `prod` via `.github/workflows/deploy-prod.yml`
4. Optionally publish the separate Cloudflare Worker bundle via `.github/workflows/deploy-cloudflare.yml` when run manually

```bash
git add .
git commit -m "Setup container deployment"
git push origin main
```

## Manual Deployment (without CI/CD)

If you prefer manual deployment:

```bash
# On your VM
cd ~/who-owns-what

# Pull latest code
git pull origin main

# Build and start
docker compose -f docker-compose.prod.yml --profile with-cloudflare up -d --build

# Check status
docker compose -f docker-compose.prod.yml --profile with-cloudflare ps
```

## SSL/HTTPS Setup (Let's Encrypt)

### Option 1: Using Nginx with Certbot (Recommended)

1. Update `nginx/nginx.conf` with your domain:

```nginx
server_name api.yourdomain.com;
ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
```

2. Start with nginx profile:

```bash
docker-compose -f docker-compose.prod.yml --profile with-nginx up -d
```

3. Get SSL certificate:

```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d api.yourdomain.com \
  --agree-tos \
  --email your-email@example.com
```

### Option 2: Using Cloudflare Tunnel (Current Setup)

The active production setup uses Docker Compose plus a `cloudflared` sidecar container.

1. Add the tunnel token to `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
```

2. Start the stack with the tunnel profile:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare up -d
```

3. In Cloudflare DNS, point each environment's frontend and API hostnames at the matching tunnel hostname:

```text
dev-wow.yazan.io     -> <dev-tunnel-id>.cfargotunnel.com
dev-wow-api.yazan.io -> <dev-tunnel-id>.cfargotunnel.com

wow.yazan.io         -> <prod-tunnel-id>.cfargotunnel.com
wow-api.yazan.io     -> <prod-tunnel-id>.cfargotunnel.com
```

## Monitoring & Logs

### View Application Logs

```bash
# Follow logs
docker-compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api
```

### Monitor Container Health

```bash
# Check container status
docker ps

# Health check endpoint
curl http://localhost:8000/api/health/
```

### Resource Usage

```bash
docker stats
```

## Updating the Application

### Automatic (via GitHub Actions)

Just push to main:

```bash
git push origin main
```

Important:

- `develop` deploys the `dev` tunnel-backed stack.
- `main` and `master` deploy the `prod` tunnel-backed stack.
- The Worker deploy publishes `who-owns-what.yazan-4a5.workers.dev`, which is a separate path.
- `docker-compose.prod.yml` no longer hardcodes `container_name`, so multiple Compose projects can run side by side on the same host.

### Manual Update

```bash
cd ~/who-owns-what

# Pull latest code
git pull origin main

# Pull latest image
docker pull ghcr.io/YOUR_USERNAME/who-owns-what:latest

# Restart with zero downtime
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -f
```

## Data Refresh

To rebuild the production WOW tables from the checked-in Chicago CSV snapshots:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  psql -U wow -d wow -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python dbtool.py builddb --update

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python scripts/load_supplemental_data.py --data-dir data/supplemental-20260329

docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api \
  python scripts/load_source_expansion.py --data-dir data/supplemental-20260331
```

Notes:

- `dbtool.py builddb --update` reloads the source `chi_*.csv` files and recreates the derived WOW tables.
- Core, supplemental, and expansion loaders now all write `data_load_audit` rows.
- The production image excludes `data/` via `.dockerignore`, so refreshes must run in a one-off container with `-v "$PWD/data:/app/data"`.
- The current repository snapshot under `data/chi_*.csv` is only a partial Chicago dataset, not a full production-scale export.
- To refresh the source CSVs themselves, use `scripts/fetch_chi_data.py` and verify row counts before rebuilding.

### Verify refresh audits and admin coverage

After a refresh, confirm the audit rows and coverage endpoint:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  psql -U wow -d wow -c "SELECT dataset_name, status, row_count, run_id, loaded_at FROM data_load_audit ORDER BY loaded_at DESC LIMIT 20;"

curl -H "Authorization: Token $ADMIN_API_TOKEN" \
  http://127.0.0.1:8000/api/admin/data-coverage
```

`ADMIN_API_TOKEN` should be a dedicated token for admin-only endpoints. If it is unset, the app falls back to `ALERTS_API_TOKEN`, but production deploys should define a separate admin token.

### Mounted one-off rebuilds

The production image excludes `data/`, so all refreshes should use a one-off container with the host `data/` directory mounted into `/app/data`:

```bash
docker compose -f docker-compose.prod.yml --profile with-cloudflare run --rm -T \
  -v "$PWD/data:/app/data" \
  api python dbtool.py builddb --update
```

This reuses the host CSVs directly and is the safest method for very large refreshes like the 13M+ row `chi_311` dataset.

### Restore CSV snapshots from MinIO

If you have backed up the CSV snapshots to the local MinIO instance, you can restore them back into the repo with `minio/mc`:

```bash
docker run --rm --entrypoint /bin/sh \
  --network akg4s0w8o8swoog08oogc0s0 \
  -v "$PWD:/work" \
  minio/mc \
  -c "mc alias set local http://supabase-minio:9000 \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null && mc cp --recursive local/wow-backups/who-owns-what/<timestamp>/data /work/ && mc cp --recursive local/wow-backups/who-owns-what/<timestamp>/tests/data /work/tests/"
```

Replace `<timestamp>` with the backup prefix you want to restore.

### Back up the database

To create a portable PostgreSQL backup of the running WOW database:

```bash
mkdir -p backups

docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T db \
  pg_dump -U wow -d wow -Fc > backups/wow-$(date -u +%Y%m%dT%H%M%SZ).dump
```

To upload that dump into MinIO:

```bash
docker run --rm --entrypoint /bin/sh \
  --network akg4s0w8o8swoog08oogc0s0 \
  -v "$PWD:/work" \
  minio/mc \
  -c "mc alias set local http://supabase-minio:9000 \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null && mc mb --ignore-existing local/wow-backups >/dev/null && mc cp /work/backups/<dump-file> local/wow-backups/who-owns-what/<timestamp>/db/<dump-file>"
```

## Troubleshooting

### Search suggestions return HTTP 400

If address auto-suggestions fail in the UI and API logs show `Invalid HTTP_HOST header`, ensure your API hostname is present in `ALLOWED_HOSTS`.

Example `.env` values:

```env
ALLOWED_HOSTS=wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://wow.yazan.io
```

Then recreate the API service so it picks up updated environment values:

```bash
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml up -d api
```

### Timeline tab shows network/internal error

If `/api/address/indicatorhistory` returns 500 after enabling IHS integration, confirm your IHS SQL query uses a valid join path for community area.

Current query file:

- `wow/sql/address_indicatorhistory_chi_with_ihs.sql`

The working version joins community area from `chi_parcels.chicago_community_area_name` (not `chi_geographies.pin10`).

After updating SQL, restart the API container:

```bash
docker compose -f docker-compose.prod.yml restart api
```

### IHS indicators missing from timeline dropdown

Confirm frontend candidate dataset logic includes IHS dataset IDs for standard mode:

- `client/src/components/APIClient.ts`

If code is correct but UI is stale, force-refresh browser cache and redeploy frontend assets.

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Check environment variables
docker-compose -f docker-compose.prod.yml config
```

### Database connection issues

```bash
# Test database connection from container
docker-compose -f docker-compose.prod.yml exec api python -c "
from django.db import connections
cursor = connections['wow'].cursor()
cursor.execute('SELECT 1')
print('Database connected!')
"
```

### GitHub Actions deployment fails

1. Check GitHub Actions logs in your repository
2. Verify SSH secrets are correct
3. Ensure your VM accepts SSH connections from GitHub Actions IPs
4. Check that Docker is running on your VM

### Health check fails

```bash
# Test locally
curl http://localhost:8000/api/health/

# Check if Django is running
docker compose -f docker-compose.prod.yml exec api python manage.py check
```

## Security Best Practices

1. **Use strong secrets**: Generate a secure `SECRET_KEY`
2. **Firewall**: Only open ports 80, 443, and 22 (SSH)
3. **Regular updates**: Keep Docker and system packages updated
4. **Non-root user**: The container runs as non-root (`appuser`)
5. **Environment variables**: Never commit `.env` files

## Backup & Recovery

### Database Backup

```bash
# Backup PostgreSQL
docker exec -t your-db-container pg_dumpall -c -U postgres > backup.sql

# Or if using external DB
pg_dump $DATABASE_URL > backup.sql
```

### Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql
```

## Advanced Configuration

### Multiple Workers

Edit `Dockerfile.prod` to adjust Gunicorn workers:

```dockerfile
CMD ["gunicorn", \
    "--bind", "0.0.0.0:8000", \
    "--workers", "8", \  # Increase for more traffic
    "--timeout", "60", \  # Increase for slow queries
    ...
```

### Using a Managed Database

For production, consider using a managed PostgreSQL service:
- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- DigitalOcean Managed Databases

Update `DATABASE_URL` in your `.env` file with the managed database connection string.

## Support

If you encounter issues:

1. Check the logs: `docker-compose -f docker-compose.prod.yml logs`
2. Review GitHub Actions logs in your repository
3. Ensure all environment variables are set correctly
4. Verify your VM has enough resources (RAM, disk space)
