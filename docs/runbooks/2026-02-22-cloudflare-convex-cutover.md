# Cloudflare + Convex Cutover Runbook

## Goal

Cut over the MVP rewrite at `apps/web` to Cloudflare Workers (OpenNext) with Convex backend/auth enabled.

## Prerequisites

- Cloudflare account with API token and account ID.
- Convex project created and deployment selected.
- DNS control for the target frontend domain.

## Environment Matrix

### Local (`apps/web/.env.local`)

- `NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud`
- Optional: `CONVEX_URL` (if server-side URL override is needed)
- Optional for import scripts: `CONVEX_DEPLOY_KEY=<convex deploy key>`

### GitHub Actions Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### Cloudflare Worker Runtime Vars

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_URL` (recommended to match `NEXT_PUBLIC_CONVEX_URL`)

### Convex Dashboard Vars

- Any provider-specific auth values if additional providers are enabled.
- Default password provider scaffold requires no extra provider secret.
- For local/dev setup, copy `apps/web/.env.local.sample` to `apps/web/.env.local` and fill required values.

## One-Time Setup

1. Install dependencies:

```bash
cd apps/web
npm install
```

2. Authenticate Convex and initialize deployment:

```bash
npm run convex:dev
```

3. Import reduced MVP dataset into Convex:

```bash
npm run convex:import:mvp
```

This imports addresses and recomputes portfolio summaries.

4. Validate application locally:

```bash
npm run lint
npm run build
npm run build:worker
npm run test:e2e:smoke
```

## Deploy Steps

1. Set Cloudflare secrets (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`) in GitHub.
2. Ensure runtime env vars are present for the Worker deployment.
3. Push to `main` or manually trigger:

```bash
# from apps/web
npm run deploy:worker
```

4. Validate production routes:

- `/`
- `/search?q=Division`
- `/address/<pin>`
- `/portfolio/<portfolioId>`
- `/login`
- `/register`

5. Validate protected route behavior:

- `/account` redirects unauthenticated users to `/login`.
- Authenticated users can access `/account`.

## Rollback

1. Re-deploy previous Cloudflare Worker version.
2. Re-point DNS (if required) to previous frontend target.
3. Keep Convex data unchanged; application rollback does not require data rollback.

## Post-Cutover Checks

- API responses from:
  - `/api/address/search?q=Division`
  - `/api/address/<pin>`
  - `/api/portfolio/<portfolioId>`
- Authentication actions complete without console/network errors.
- Playwright smoke suite still passes against deployed URL (run in CI extension or staging job).
