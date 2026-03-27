---
title: Why My Self-Hosted Convex Dashboard Loaded as a Blank Page Behind Cloudflare Tunnel
published: false
tags: convex, cloudflare, debugging, devops
description: A blank self-hosted Convex dashboard turned out not to be a frontend bug, but a Cloudflare Tunnel consistency issue caused by stale connectors and mixed routing paths.
---

> The bug looked like a frontend issue. The real problem was an inconsistent Cloudflare Tunnel path serving traffic through both good and stale connectors.

There is a special kind of infrastructure bug that makes you distrust everything.

The container is healthy. The HTML loads. The local service works. The public URL sort of works. But the page is still blank.

That was exactly what happened when I deployed a self-hosted Convex stack behind Cloudflare Tunnel.

I had three public hostnames:

- `convex.yazan.io` for the dashboard
- `convex-api.yazan.io` for the backend API
- `convex-site.yazan.io` for HTTP actions / site traffic

On paper, everything looked fine. The backend was healthy. The dashboard container was running. The public dashboard URL even returned HTML.

But in the browser, the Convex dashboard was just... blank.

## TL;DR

- The Convex dashboard app was not broken.
- The dashboard loaded HTML, but some Next.js assets intermittently returned `502` through Cloudflare Tunnel.
- The biggest hidden problem was a stale Cloudflare Tunnel connector still serving traffic.
- Replacing an ad hoc proxy with Caddy, rotating the tunnel secret, deleting old tunnel connections, and updating the remote tunnel config fixed the issue.

## The Problem

The symptoms were deceptively simple:

- `https://convex.yazan.io` sometimes returned the initial HTML
- the dashboard never hydrated into a working app
- some static files, especially Next.js assets, intermittently returned `502`

The failures showed up most clearly on dashboard asset requests like:

- `/_next/static/...js`
- `/favicon.ico`

If the JavaScript bundle cannot load, the page shell appears, but the app never becomes interactive. That is exactly what was happening.

## The First Important Discovery

Before changing proxies or Cloudflare settings, I checked the dashboard locally.

Direct requests to the dashboard container worked:

- `http://127.0.0.1:6791`
- `http://127.0.0.1:6791/_next/static/...`
- `http://127.0.0.1:6791/favicon.ico`

That changed the investigation immediately.

The dashboard application was fine.

The problem existed somewhere between the local origin and the public internet.

## What I Tried

### 1. Route the dashboard directly through the tunnel

The most obvious setup was:

- `convex.yazan.io -> http://127.0.0.1:6791`

That partly worked. The root page sometimes came back, but dashboard assets still failed unpredictably.

### 2. Send everything through Traefik

Because the stack already used Coolify and Traefik, I tried routing tunnel traffic through local Traefik instead of directly to Convex services.

That improved some behavior, but it did not solve the dashboard issue. The API and site looked better than the dashboard, but the dashboard still failed intermittently.

It also added another layer into the request path, which made the system harder to reason about.

### 3. Add a dedicated dashboard proxy

At that point I suspected the dashboard needed its own cleaner proxy path, so I created a local reverse proxy on port `8787`.

The first version was written in Python. It worked locally, but it was still not stable enough through Cloudflare Tunnel.

So I replaced it with Caddy.

The final proxy config was:

```caddy
:8787 {
  reverse_proxy 127.0.0.1:6791
}
```

That became the stable local dashboard origin:

- `convex.yazan.io -> http://127.0.0.1:8787`

## The Real Problem Was Not the Proxy

Even after the proxy path improved, public behavior was still inconsistent.

Some requests returned `200`.
Others returned `502`.
The same URL could work one moment and fail the next.

That usually means not all requests are hitting the same live path.

And that turned out to be exactly the issue.

## The Hidden Root Cause: A Stale Cloudflare Tunnel Connector

Once I got proper Cloudflare API access, I inspected the tunnel directly.

The tunnel had more than one active connector.

One connector was current.
Another connector was stale.

That stale connector was still serving traffic, so Cloudflare was effectively sending requests to both a good path and a bad one. That explained the randomness:

- dashboard root sometimes worked
- static assets sometimes failed
- local tests passed while public traffic still broke
- the issue felt like a frontend bug even though it was not

This was the key insight that made the whole incident make sense.

## Why This Was So Confusing

There were several overlapping problems:

1. The dashboard application itself was healthy, which hid the real issue.
2. The failure was intermittent, which made bad fixes look partially successful.
3. The tunnel was remotely managed, so the local config file was not the full source of truth.
4. A stale connector was still alive, so even correct routing changes could be undermined by old live state.

That combination created a debugging experience where almost every clue was only half true.

## The Fix That Actually Solved It

The final solution had four parts.

### 1. Use Caddy as the dedicated dashboard proxy

Instead of a custom Python proxy, I added a persistent Caddy service to proxy:

- `127.0.0.1:8787 -> 127.0.0.1:6791`

### 2. Simplify the tunnel ingress rules

The final routing became:

- `convex.yazan.io -> http://127.0.0.1:8787`
- `convex-api.yazan.io -> http://127.0.0.1:3210`
- `convex-site.yazan.io -> http://127.0.0.1:3211`

This removed unnecessary complexity from the public request path.

### 3. Rotate the Cloudflare Tunnel secret and token

This prevented the stale connector from establishing new connections with old credentials.

### 4. Explicitly delete active tunnel connections

After rotating the secret, I cleaned up active tunnel connections through the Cloudflare API. That forced the stale connector out of the system and left only the current connector serving traffic.

Once that happened, the randomness disappeared.

## What the Working Setup Looks Like Now

The final setup is straightforward:

- dashboard container on `127.0.0.1:6791`
- Caddy proxy on `127.0.0.1:8787`
- backend API on `127.0.0.1:3210`
- site / HTTP actions on `127.0.0.1:3211`
- Cloudflare Tunnel routing directly to those three local services

After cleanup, repeated public checks returned stable `200` responses for:

- `https://convex.yazan.io`
- `https://convex.yazan.io/_next/static/...`
- `https://convex.yazan.io/favicon.ico`
- `https://convex-api.yazan.io/version`
- `https://convex-site.yazan.io`

That was the moment the issue was actually resolved, not just temporarily improved.

## What I Learned

### Verify the app locally first

The direct local checks against `127.0.0.1:6791` saved a huge amount of time. Once I knew the dashboard was healthy locally, I could stop blaming the application.

### Intermittent failures usually mean multiple active paths

If the same URL sometimes works and sometimes fails, there is a good chance traffic is being split across connectors, proxies, replicas, or configurations.

### Remotely managed tunnels require API visibility

The local config file matters, but it is not enough if Cloudflare is managing the active ingress rules and connector state remotely.

### Tunnel tokens and API tokens are not the same thing

A tunnel run token can start `cloudflared`, but it cannot inspect or clean up the tunnel through the Cloudflare API. For incidents like this, proper API permissions matter.

### Simpler paths are easier to trust

The most reliable end state was the simplest one:

- dashboard through Caddy
- API direct to backend
- site direct to site service

Every extra layer made the system harder to debug.

## Final Takeaway

This looked like a frontend rendering bug, but it was really an infrastructure consistency failure.

The dashboard application was healthy the entire time. What was broken was the traffic path reaching it.

The combination of:

- a stale Cloudflare Tunnel connector
- remotely managed tunnel configuration
- an early proxy path that was not stable enough

created intermittent `502` responses for dashboard assets, which made the UI appear blank.

The fix was not one magical command. It was a sequence:

1. prove the app worked locally
2. simplify the routing
3. replace the ad hoc proxy with Caddy
4. rotate the tunnel secret
5. delete stale tunnel connections
6. update the remote Cloudflare-managed tunnel config

After that, the dashboard, API, and site all stabilized.

If you hit a similar issue, check the active tunnel connectors before you spend too long blaming Next.js, the browser, or Convex itself. In this case, the browser was only showing the symptoms. The real bug lived in the traffic path.
