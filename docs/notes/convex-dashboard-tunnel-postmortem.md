# Fixing a Blank Convex Dashboard Behind Cloudflare Tunnel

## Problem Statement

We deployed a self-hosted Convex stack with three public hostnames:

- `https://convex.yazan.io` for the dashboard
- `https://convex-api.yazan.io` for the backend API
- `https://convex-site.yazan.io` for HTTP actions / site traffic

The API and site hosts mostly worked, but the dashboard loaded as a blank page.

At first glance the dashboard looked healthy because the HTML shell loaded, but the browser could not reliably fetch the assets required to hydrate the Next.js app. Requests like the dashboard JavaScript bundle and favicon intermittently returned `502`, which left the UI stuck on a blank screen.

## Symptoms

- `https://convex.yazan.io` sometimes returned the initial HTML
- `https://convex.yazan.io/_next/static/...` intermittently returned `502`
- `https://convex.yazan.io/favicon.ico` intermittently returned `502`
- `https://convex-api.yazan.io` and `https://convex-site.yazan.io` appeared healthier than the dashboard
- Local access to the dashboard on `http://127.0.0.1:6791` worked

This immediately suggested the Convex dashboard container itself was probably not the root issue.

## Architecture at the Time

The stack involved several layers:

1. Convex backend container on `127.0.0.1:3210`
2. Convex site / HTTP actions on `127.0.0.1:3211`
3. Convex dashboard on `127.0.0.1:6791`
4. Traefik / Coolify routing for some hostnames
5. Cloudflare Tunnel exposing the public domains

That meant the problem could live in the dashboard app, a local proxy, Traefik, Cloudflare Tunnel ingress, or Cloudflare's active tunnel connectors.

## What We Checked First

We started by verifying the local services directly.

- `http://127.0.0.1:6791` returned dashboard HTML correctly
- `http://127.0.0.1:6791/_next/static/...` returned the JS bundle correctly
- `http://127.0.0.1:6791/favicon.ico` worked locally

That told us the dashboard application and container were healthy.

## Early Hypotheses

We worked through several plausible causes:

### 1. Direct dashboard tunnel routing was broken

We tested direct tunnel routing from `convex.yazan.io` to `http://127.0.0.1:6791`.

Result:

- Sometimes the root HTML loaded
- Static assets still intermittently failed

Conclusion: the dashboard app was fine, but direct exposure through the tunnel was still unstable.

### 2. Traefik might provide a cleaner origin

We then tried routing Convex hosts through Traefik on port `80` using host headers.

Result:

- API and site routes behaved better in some cases
- Dashboard root and assets still failed unpredictably
- Traefik also introduced its own noise, including timeout behavior and certificate churn that was unnecessary for tunnel-only hosts

Conclusion: Traefik was not the clean fix for the dashboard path.

### 3. The dashboard needed a dedicated reverse proxy

We created a lightweight local proxy for the dashboard on port `8787`.

The first version was a Python proxy. It worked locally but still produced inconsistent behavior when used through Cloudflare Tunnel. It also had edge-case behavior around response headers that made it a poor long-term fit for this path.

Conclusion: the concept of a dedicated proxy was good, but the implementation needed to be more robust.

## Problems We Encountered During Debugging

Several issues overlapped and made the investigation tricky.

### Intermittent failures made the app look partially healthy

The dashboard root would sometimes return `200`, while the asset bundle or favicon would fail. That made the problem look like a frontend bug when it was really a routing problem.

### HEAD and GET behavior did not match cleanly through the Python proxy

The Python proxy was good enough for simple tests, but not ideal for production-style behavior through the tunnel. This was a sign that we should replace it with a standard reverse proxy.

### Cloudflare Tunnel was remotely managed

The local file at `/data/coolify/services/n0oo0oc0kk8swggg8ossggg4/config.yml` was not the full story. The active tunnel was using remote Cloudflare-managed configuration, so local assumptions did not always match what live traffic was actually using.

### A stale tunnel connector was still active

This turned out to be the most important discovery.

Cloudflare showed more than one active connector for the same tunnel. One connector was current, but another stale connector was still serving traffic with older behavior. Because requests were being distributed across both connectors, the site appeared randomly broken.

This is why:

- one request could return `200`
- the next could return `502`
- local checks looked healthy while public traffic still failed

### The original tunnel token was not enough for tunnel cleanup

We initially only had the tunnel run token, which can start the tunnel but cannot inspect or manage connectors via the Cloudflare API. We needed a proper Cloudflare API token with tunnel write permissions to inspect the active connector state and clean it up.

## What We Changed

### 1. Replaced the ad hoc dashboard proxy with Caddy

We created `/root/Caddyfile.dashboard`:

```caddy
:8787 {
  reverse_proxy 127.0.0.1:6791
}
```

Then we added a persistent `dashboard_proxy` service to `/root/docker-compose.yml` using `caddy:2-alpine`.

Why this helped:

- Caddy is a mature reverse proxy
- it handled the dashboard responses more reliably than the Python proxy
- it gave us a stable local origin at `127.0.0.1:8787`

### 2. Simplified tunnel ingress targets

The final local tunnel config at `/data/coolify/services/n0oo0oc0kk8swggg8ossggg4/config.yml` became:

```yaml
ingress:
  - hostname: convex.yazan.io
    service: http://127.0.0.1:8787
  - hostname: convex-api.yazan.io
    service: http://127.0.0.1:3210
  - hostname: convex-site.yazan.io
    service: http://127.0.0.1:3211
  - service: http_status:404
```

This removed unnecessary dependence on Traefik for the public tunnel path.

### 3. Rotated the tunnel secret and token

To stop the stale connector from reconnecting, we rotated the Cloudflare Tunnel secret and updated the local credentials.

That effectively invalidated the old tunnel token and ensured only the refreshed connector could establish new connections.

### 4. Deleted existing tunnel connections via the Cloudflare API

After rotating the tunnel secret, we explicitly cleaned up active tunnel connections from Cloudflare so the old connector could not keep serving traffic.

This was the turning point in the incident.

### 5. Updated the remote Cloudflare tunnel configuration

Because the tunnel was remotely managed, we updated the Cloudflare-managed ingress rules directly so live traffic used:

- `convex.yazan.io -> http://127.0.0.1:8787`
- `convex-api.yazan.io -> http://127.0.0.1:3210`
- `convex-site.yazan.io -> http://127.0.0.1:3211`

Once the remote config matched the intended local design, the behavior stabilized.

## Final State

The working setup is now:

- dashboard container on `127.0.0.1:6791`
- Caddy dashboard proxy on `127.0.0.1:8787`
- backend API on `127.0.0.1:3210`
- site / HTTP actions on `127.0.0.1:3211`
- Cloudflare Tunnel routing directly to those local origins
- only one valid active Cloudflare connector for the tunnel

## Verification

After the cleanup and remote config update, repeated checks returned stable `200` responses for:

- `https://convex.yazan.io`
- `https://convex.yazan.io/_next/static/...`
- `https://convex.yazan.io/favicon.ico`
- `https://convex-api.yazan.io/version`
- `https://convex-site.yazan.io`

That confirmed the issue was resolved at the tunnel and connector layer, not just masked locally.

## Frontend and Dashboard Credentials

During the cleanup we also clarified which values belong where:

### Dashboard login / deployment connection

- Deployment URL: `https://convex-api.yazan.io`
- Admin key: the self-hosted Convex admin key generated from the backend

### Frontend app configuration

Frontend apps should use the public API URL only, for example:

```env
VITE_CONVEX_URL=https://convex-api.yazan.io
```

or:

```env
NEXT_PUBLIC_CONVEX_URL=https://convex-api.yazan.io
```

The admin key must never be exposed to the browser.

## Root Cause

The blank dashboard was not caused by the Convex dashboard app itself.

The real root cause was a combination of:

1. Cloudflare Tunnel traffic being served by multiple active connectors
2. at least one stale connector still using old or incorrect behavior
3. an unreliable proxy path for the dashboard during early attempts
4. remote tunnel configuration differing from what we assumed locally

This combination produced random `502` failures for dashboard traffic, especially Next.js assets, which made the dashboard render as a blank page.

## Lessons Learned

### 1. Verify the origin locally before blaming the app

Local checks against `127.0.0.1:6791` quickly showed the dashboard was healthy.

### 2. A tunnel token is not the same as an API token

If a tunnel is remotely managed, you need Cloudflare API access to inspect connections, rotate secrets, and clean up stale connectors.

### 3. Intermittent `502`s often point to multiple paths, not one broken service

If some requests succeed and others fail with the same hostname, check for multiple connectors, multiple proxies, or mixed live configs.

### 4. Keep the tunnel path simple

For this deployment, the most reliable setup was:

- dashboard -> Caddy -> Convex dashboard container
- API -> backend directly
- site -> site service directly

Every extra layer made the issue harder to reason about.

## Files Changed During the Fix

- `/root/docker-compose.yml`
- `/root/Caddyfile.dashboard`
- `/data/coolify/services/n0oo0oc0kk8swggg8ossggg4/config.yml`
- `/root/.env.local`

## Closing Summary

The dashboard blank-screen issue looked like a frontend rendering bug, but it was actually an infrastructure consistency problem. The decisive fixes were replacing the dashboard proxy with Caddy, rotating the Cloudflare Tunnel secret, deleting stale tunnel connections, and updating the remote tunnel configuration so traffic consistently hit the correct local origins.

Once the stale connector was eliminated, the dashboard, API, and site all stabilized.
