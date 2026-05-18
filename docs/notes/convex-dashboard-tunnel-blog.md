# Why My Self-Hosted Convex Dashboard Loaded as a Blank Page Behind Cloudflare Tunnel

## The bug looked like a frontend issue. The real problem was an inconsistent tunnel path serving traffic through both good and stale connectors.

There is a special kind of infrastructure bug that makes you distrust everything.

The container is healthy. The HTML loads. The local service works. The public URL sort of works. But the page is still blank.

That was the exact shape of this Convex incident.

I had a self-hosted Convex stack running behind Cloudflare Tunnel with three public hostnames:

- `convex.yazan.io` for the dashboard
- `convex-api.yazan.io` for the backend API
- `convex-site.yazan.io` for HTTP actions / site traffic

On paper, everything looked fine. The backend was healthy. The dashboard container was running. The public dashboard URL even returned HTML.

But in the browser, the Convex dashboard was just... blank.

This post walks through the whole debugging path: the original problem, the dead ends, the subtle clues, the actual root cause, and the final setup that made the dashboard stable.

## The Problem

The main symptom was deceptively simple:

- `https://convex.yazan.io` would sometimes load the initial HTML
- the dashboard never hydrated into a working app
- some static files, especially Next.js assets, intermittently returned `502`

Two examples made the issue obvious:

- `/_next/static/...js`
- `/favicon.ico`

If the dashboard's JavaScript bundle cannot load, the page shell appears, but the app never becomes interactive. That is exactly what was happening.

## The First Important Discovery

Before touching any proxy or Cloudflare settings, I checked the dashboard locally.

Direct requests to the dashboard container worked:

- `http://127.0.0.1:6791`
- `http://127.0.0.1:6791/_next/static/...`
- `http://127.0.0.1:6791/favicon.ico`

That changed the direction of the investigation immediately.

The dashboard app was not broken.

The problem lived somewhere between the local service and the public internet.

## What I Tried

### Attempt 1: Route the dashboard directly through the tunnel

The most obvious setup was:

- `convex.yazan.io -> http://127.0.0.1:6791`

That partly worked. The root page sometimes came back, but dashboard assets still failed unpredictably.

This was frustrating because it made the system look half healthy. A quick browser test suggested the site existed, but the real app experience was still broken.

### Attempt 2: Send everything through Traefik

Since the stack already used Coolify and Traefik, the next idea was to send tunnel traffic through local Traefik routing instead of directly to Convex services.

That helped in some areas, but it did not solve the dashboard issue. The API and site traffic behaved better than the dashboard, but the dashboard still produced intermittent failures.

Worse, this added another moving part into the path, which made debugging harder.

### Attempt 3: Add a custom dashboard proxy

At that point it looked like the dashboard needed its own dedicated proxy path, so I created a local reverse proxy on port `8787`.

The first version was written in Python. It worked locally, but it was still not stable enough when requests passed through Cloudflare Tunnel. That told me the idea was probably right, but the implementation was not ideal.

So I replaced it with Caddy.

The final proxy config was tiny:

```caddy
:8787 {
  reverse_proxy 127.0.0.1:6791
}
```

This became the stable dashboard origin:

- `convex.yazan.io -> http://127.0.0.1:8787`

## The Real Problem Was Not the Proxy

Even after the proxy path improved, the public behavior was still inconsistent.

Some requests returned `200`.
Others returned `502`.
The same URL could work one moment and fail the next.

That is usually a sign that requests are not all hitting the same path.

And that turned out to be exactly the issue.

## The Hidden Root Cause: A Stale Cloudflare Tunnel Connector

Once I got proper Cloudflare API access, I inspected the tunnel directly.

The tunnel had more than one active connector.

One connector was current.
Another connector was stale.

That stale connector was still serving traffic, which meant Cloudflare was effectively load balancing requests between a good path and a bad one. That explained the randomness:

- dashboard root sometimes worked
- static assets sometimes failed
- API or site could look healthy while the dashboard still broke
- local tests could pass while public traffic still failed

This was the key insight that made the entire incident make sense.

## Why This Was So Confusing

There were four overlapping problems:

1. The dashboard application itself was healthy, which made the issue feel invisible locally.
2. The failure was intermittent, which made every change look partially successful.
3. The tunnel was remotely managed, so the local config file was not the full source of truth.
4. A stale connector was still alive, so even correct fixes could be undermined by old live state.

That combination is perfect for producing long, misleading debugging sessions.

## The Fix That Actually Solved It

The final working solution had four parts.

### 1. Use Caddy as the dedicated dashboard proxy

Instead of using a custom Python proxy, I added a persistent Caddy service in Docker Compose to proxy:

- `127.0.0.1:8787 -> 127.0.0.1:6791`

### 2. Simplify the tunnel ingress rules

The final public routing became:

- `convex.yazan.io -> http://127.0.0.1:8787`
- `convex-api.yazan.io -> http://127.0.0.1:3210`
- `convex-site.yazan.io -> http://127.0.0.1:3211`

This removed unnecessary complexity from the traffic path.

### 3. Rotate the Cloudflare Tunnel secret and token

This step was crucial.

By rotating the tunnel secret, I made sure the stale connector could no longer establish new connections with the old credentials.

### 4. Explicitly delete active tunnel connections

After rotating the secret, I cleaned up the active tunnel connections through the Cloudflare API. That forced the bad connector out of the system and left only the current connector serving traffic.

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

That was the moment the issue was truly resolved.

## What I Learned

This incident reinforced a few useful lessons.

### Verify the app locally first

A direct check against the local service saved a huge amount of time. Once I knew the dashboard was healthy on `127.0.0.1:6791`, I could stop blaming the app itself.

### Intermittent failures usually mean multiple active paths

If the same URL sometimes works and sometimes fails, there is a good chance traffic is being split across connectors, proxies, replicas, or configurations.

### Remotely managed tunnels require API-level visibility

The local config file matters, but it is not enough if Cloudflare is managing the live ingress config and active connectors remotely.

### Tunnel tokens and API tokens are not the same thing

A tunnel run token can start `cloudflared`, but it cannot inspect or clean up the tunnel through the API. For incidents like this, proper API permissions matter.

### Simpler paths are easier to trust

The most reliable end state was the simplest one:

- dashboard through Caddy
- API direct to backend
- site direct to site service

Every extra layer made the system harder to reason about.

## Final Takeaway

This looked like a frontend rendering bug, but it was really an infrastructure consistency failure.

The dashboard application was healthy the entire time. What was broken was the path traffic took to reach it.

The combination of:

- a stale Cloudflare Tunnel connector
- remotely managed tunnel configuration
- an early proxy path that was not production-grade enough

created intermittent `502` responses for dashboard assets, which made the UI appear blank.

The fix was not a single magical command. It was a sequence:

1. prove the app worked locally
2. simplify the public routing
3. replace the ad hoc proxy with Caddy
4. rotate the tunnel secret
5. delete stale tunnel connections
6. update the remote Cloudflare-managed tunnel config

After that, the dashboard, API, and site all stabilized.

If you hit a similar issue, the most important lesson is this: when a self-hosted app works locally but fails randomly through Cloudflare Tunnel, inspect the active connectors before you blame the application. In this case, the browser was only showing the symptoms. The real bug was in the traffic path.
