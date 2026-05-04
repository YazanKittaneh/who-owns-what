# Cloudflare Tunnel Deployment Guide

This project's real `dev` and `prod` environments are served through Cloudflare Tunnels, not Cloudflare Pages.

## Current Model

- `dev-wow.yazan.io` and `dev-wow-api.yazan.io` should point at the dev tunnel
- `wow.yazan.io` and `wow-api.yazan.io` should point at the prod tunnel
- each environment runs on the same host but in a separate Docker Compose project
- the Cloudflare Worker deploy is a separate artifact and not the source of truth for either live environment

## Environment Matrix

| Environment | Frontend | API | Tunnel Token Source | Compose Project |
|-------------|----------|-----|---------------------|-----------------|
| dev | `https://dev-wow.yazan.io` | `https://dev-wow-api.yazan.io` | `/home/actions/who-owns-what-dev.env` | `who-owns-what-dev` |
| prod | `https://wow.yazan.io` | `https://wow-api.yazan.io` | `/home/actions/who-owns-what-prod.env` | `who-owns-what-prod` |

## DNS

Each environment needs two DNS records:

```text
dev-wow.yazan.io      -> <dev-tunnel-id>.cfargotunnel.com
dev-wow-api.yazan.io  -> <dev-tunnel-id>.cfargotunnel.com

wow.yazan.io          -> <prod-tunnel-id>.cfargotunnel.com
wow-api.yazan.io      -> <prod-tunnel-id>.cfargotunnel.com
```

Current observed state on this machine:

- prod tunnel is already live for `wow.yazan.io` and `wow-api.yazan.io`
- a dedicated dev tunnel now exists:
  - tunnel ID: `e3fc65bd-5145-4210-98ad-b2429a70f7fb`
  - tunnel name: `wow_dev_112`
- the dev tunnel remote ingress is configured for:
  - `dev-wow-api.yazan.io -> http://api:8000`
  - `dev-wow.yazan.io -> http://frontend:80`
- the local `who-owns-what-dev-cloudflared-1` container is connected and healthy
- public DNS now exists for both hostnames and points at the dev tunnel
- `https://dev-wow.yazan.io` responds normally through the tunnel
- `https://dev-wow-api.yazan.io` resolves correctly in public DNS and responds through the correct Cloudflare edge IP
- note: this machine briefly held a stale resolver answer for `dev-wow-api.yazan.io`; external DNS-over-HTTPS and forced-edge checks confirmed the public record is correct

## Required Env Vars

Each runner env file must include at least:

```env
DATABASE_URL=...
SECRET_KEY=...
CLOUDFLARE_TUNNEL_TOKEN=...
FRONTEND_API_BASE_URL=...
ALLOWED_HOSTS=...
CORS_EXTRA_ALLOWED_ORIGINS=...
CSRF_EXTRA_TRUSTED_ORIGINS=...
ALERTS_API_TOKEN=...
SIGNATURE_API_TOKEN=...
ADMIN_API_TOKEN=...
ROLLBAR_ACCESS_TOKEN=...
FRONTEND_ROLLBAR_ACCESS_TOKEN=...
```

Recommended domain-specific values:

```env
# dev
FRONTEND_API_BASE_URL=https://dev-wow-api.yazan.io
ALLOWED_HOSTS=dev-wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://dev-wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://dev-wow.yazan.io

# prod
FRONTEND_API_BASE_URL=https://wow-api.yazan.io
ALLOWED_HOSTS=wow-api.yazan.io,localhost,127.0.0.1
CORS_EXTRA_ALLOWED_ORIGINS=https://wow.yazan.io
CSRF_EXTRA_TRUSTED_ORIGINS=https://wow.yazan.io
```

## Deploy Workflows

- `.github/workflows/deploy-dev.yml`
  - triggers on push to `develop`
  - deploys the dev stack
- `.github/workflows/deploy-prod.yml`
  - triggers on push to `main` and `master`
  - deploys the prod stack
- `.github/workflows/deploy-cloudflare.yml`
  - manual only
  - publishes the separate Worker build

## How A Deploy Works

1. GitHub Actions checks out the repo on the self-hosted runner.
2. The workflow copies the environment-specific runner env file into `.env`.
3. Docker Compose rebuilds `api`, `frontend`, and `cloudflared` for that environment.
4. The workflow verifies local API health inside the deployed container.
5. The workflow compares the rebuilt frontend asset hashes to the public HTML shell for that environment.
6. The deploy only succeeds if the public environment serves the rebuilt assets.

## Verification Commands

Check frontend asset hashes:

```bash
curl -s -A "Mozilla/5.0" https://dev-wow.yazan.io | python3 -c 'import re,sys; html=sys.stdin.read();
for pat in [r"/static/css/main\.[a-f0-9]+\.chunk\.css", r"/static/js/main\.[a-f0-9]+\.chunk\.js"]:
 m=re.search(pat, html); print(m.group(0) if m else "MISSING")'

curl -s -A "Mozilla/5.0" https://wow.yazan.io | python3 -c 'import re,sys; html=sys.stdin.read();
for pat in [r"/static/css/main\.[a-f0-9]+\.chunk\.css", r"/static/js/main\.[a-f0-9]+\.chunk\.js"]:
 m=re.search(pat, html); print(m.group(0) if m else "MISSING")'
```

Check API health:

```bash
curl -fsSL https://dev-wow-api.yazan.io/api/health/
curl -fsSL https://wow-api.yazan.io/api/health/
```

## Important Warning

If someone wants to know whether `dev` or `prod` updated, do not use the Worker deploy as evidence.

The only valid proof is:

1. the correct tunnel-backed public domain responds
2. the correct asset hashes are live
3. the correct public API health URL responds
