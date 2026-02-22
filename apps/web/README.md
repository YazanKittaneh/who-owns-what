# Who Owns What Web (OpenNext + Convex)

This workspace contains the in-progress MVP rewrite for Who Owns What.

## Stack

- Next.js App Router
- OpenNext Cloudflare adapter
- Convex backend/runtime
- Convex Auth (password provider)

## Required environment variables

- `NEXT_PUBLIC_CONVEX_URL` (required for app runtime/auth)
- `CONVEX_URL` (optional server-side override; usually same as `NEXT_PUBLIC_CONVEX_URL`)
- `CONVEX_DEPLOY_KEY` (required for import/deploy scripts that write data)

## Local development

```bash
npm install
npm run dev
```

## Build and worker bundle

```bash
npm run lint
npm run build
npm run build:worker
```

## Convex commands

```bash
npm run convex:dev
npm run convex:deploy
npm run convex:import:mvp
```

Optional import flags:

```bash
node scripts/importReducedData.mjs --limit 5000 --batch-size 200 --data-dir ../data/mvp
```

## E2E smoke tests

```bash
npm run test:e2e:smoke
```

## Cloudflare deploy

```bash
npm run deploy:worker
```

## Auth and protected routes

- Middleware protects `/account` and redirects unauthenticated users to `/login`.
- Convex Auth actions are proxied through `/api/auth` by middleware.

See the full cutover checklist:

- `/Users/yazankittaneh/code/Projects/who-owns-what/docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`
