# Who Owns What Web (OpenNext + Convex)

This workspace contains the in-progress MVP rewrite for Who Owns What.

## Stack

- Next.js App Router
- OpenNext Cloudflare adapter
- Convex backend/runtime
- Convex Auth (password provider)

## Environment setup

```bash
cp .env.local.sample .env.local
```

Required values:

- `NEXT_PUBLIC_CONVEX_URL` (required for app runtime/auth)
- `CONVEX_URL` (optional server-side override; usually same as `NEXT_PUBLIC_CONVEX_URL`)
- `CONVEX_DEPLOY_KEY` (required for import/deploy scripts that write data)

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run validate
```

Equivalent commands:

```bash
npm run lint
npm run build
npm run build:worker
npm run test:e2e:smoke
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

## Cloudflare deploy

```bash
npm run deploy:worker
```

## Auth and protected routes

- `/account` uses a route guard (server env gate + client auth gate) and redirects unauthenticated users to `/login`.
- Convex Auth actions are called directly from the client via Convex Auth provider.

See the full cutover checklist:

- `/Users/yazankittaneh/code/Projects/who-owns-what/docs/runbooks/2026-02-22-cloudflare-convex-cutover.md`
