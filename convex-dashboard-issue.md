# Convex Dashboard Tunnel Issue

## Problem

`https://convex.yazan.io` returns the initial dashboard HTML, but the page renders blank in the browser.

The root cause is that some required Next.js dashboard assets fail when requested through Cloudflare Tunnel, even though the dashboard container itself is healthy.

Examples:

- `https://convex.yazan.io/_next/static/chunks/pages/index-5a3733b5b30735ff.js` -> `502`
- `https://convex.yazan.io/favicon.ico` -> `502`

Because the browser cannot load the JS bundle, the dashboard never hydrates and stays blank.

## What Works

- `https://convex-api.yazan.io` works
- `https://convex-site.yazan.io` works
- Local dashboard container works directly on `http://127.0.0.1:6791`
- Local asset requests to the dashboard work directly on `http://127.0.0.1:6791`

## What Was Tried

### 1. Direct dashboard tunnel routing

Configured Cloudflare Tunnel ingress for:

- `convex.yazan.io` -> `http://127.0.0.1:6791`

Result:

- dashboard HTML loaded
- some static assets still returned `502`

### 2. Route all Convex hosts through Traefik

Configured the tunnel to send requests to local Traefik on port `80`, using host headers for:

- `convex.yazan.io`
- `convex-api.yazan.io`
- `convex-site.yazan.io`

Result:

- API and site worked
- dashboard root sometimes worked
- dashboard assets still failed intermittently or returned `502`

### 3. Adjust Traefik labels

Updated `/root/docker-compose.yml` to simplify Convex Traefik routing and remove unnecessary redirect middleware for the HTTP tunnel path.

Result:

- helped API and site behavior
- did not fix dashboard asset failures through the tunnel

### 4. Added a local reverse proxy for the dashboard

Created `/root/dashboard_proxy.py` to proxy:

- `127.0.0.1:8787` -> `127.0.0.1:6791`

Then changed Cloudflare Tunnel to route:

- `convex.yazan.io` -> `http://127.0.0.1:8787`

Result:

- local proxy worked when tested directly
- fixed one proxy bug involving duplicate `Content-Length` headers
- external requests through Cloudflare still returned `502` for dashboard root/assets

## Current Conclusion

The Convex dashboard app is not the problem.

The failure appears to be specific to serving the dashboard hostname and/or its static assets through the current Cloudflare Tunnel setup. The API and site proxy are working, but the dashboard remains unreliable over the tunnel.

## Relevant Files

- `/root/docker-compose.yml`
- `/root/dashboard_proxy.py`
- `/data/coolify/services/n0oo0oc0kk8swggg8ossggg4/config.yml`
- `/data/coolify/services/n0oo0oc0kk8swggg8ossggg4/docker-compose.yml`

## Recommended Next Options

1. Stop exposing the dashboard through Cloudflare Tunnel and keep only API/site public.
2. Expose the dashboard through a different path than the current tunnel setup.
3. Continue debugging Cloudflare Tunnel behavior specifically for dashboard asset delivery.
