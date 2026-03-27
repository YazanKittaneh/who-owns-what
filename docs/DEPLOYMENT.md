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
ALLOWED_HOSTS=api.yourdomain.com,localhost

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

### 4. Configure DNS

Point your domain/subdomain to your VM's IP:

```
A Record: api.yourdomain.com → YOUR_VM_IP
```

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
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps
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

### Option 2: Using Cloudflare Tunnel (Easier)

If you're using Cloudflare for DNS:

1. Install cloudflared on your VM:

```bash
# Download and install
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login
```

2. Create a tunnel:

```bash
cloudflared tunnel create wow-api
```

3. Configure the tunnel:

```bash
# Create config
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
EOF
```

4. Run the tunnel:

```bash
cloudflared tunnel route dns wow-api api.yourdomain.com
cloudflared tunnel run wow-api
```

5. (Optional) Set up as a service:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
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
