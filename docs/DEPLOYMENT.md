# Backend Deployment Guide

This guide explains how to deploy the Who Owns What Django backend to a Linux container using Docker and GitHub Actions CI/CD.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  Cloudflare     │────────▶│  Your Linux VM   │
│  (Frontend)     │   API   │  (Django API)    │
└─────────────────┘         └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  PostgreSQL DB   │
                            └──────────────────┘
```

- **Frontend**: Static React app hosted on Cloudflare Pages (already working)
- **Backend**: Django API running in Docker container on your VM
- **Database**: PostgreSQL (can be on same VM or managed service)

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

Edit the `.env` file created on your server:

```bash
nano ~/who-owns-what/.env
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
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token

# API Tokens
ALERTS_API_TOKEN=your-alerts-token
SIGNATURE_API_TOKEN=your-signature-token

# Error Tracking (optional)
ROLLBAR_ACCESS_TOKEN=your-rollbar-token
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

The current production setup uses Cloudflare-hosted domains:

```
Frontend: https://wow.yazan.io
API:      https://wow-api.yazan.io
```

The API is published through a named Cloudflare Tunnel, so `wow-api.yazan.io` should point to the tunnel CNAME rather than directly to the VM IP.

### 5. Deploy

Push to the main branch and GitHub Actions will:

1. Build the Docker image
2. Push to GitHub Container Registry
3. Deploy to your VM via SSH

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

3. In Cloudflare DNS, point `wow-api.yazan.io` at your tunnel hostname:

```text
wow-api.yazan.io -> <tunnel-id>.cfargotunnel.com
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
curl http://localhost:8000/health/
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

docker compose -f docker-compose.prod.yml --profile with-cloudflare exec -T api \
  python dbtool.py builddb --update
```

Notes:

- `dbtool.py builddb --update` reloads the source `chi_*.csv` files and recreates the derived WOW tables.
- The current repository snapshot under `data/chi_*.csv` is only a partial Chicago dataset, not a full production-scale export.
- To refresh the source CSVs themselves, use `scripts/fetch_chi_data.py` and verify row counts before rebuilding.

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
curl http://localhost:8000/health/

# Check if Django is running
docker-compose -f docker-compose.prod.yml exec api python manage.py check
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
