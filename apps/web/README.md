# Who Owns What Web (OpenNext + Convex)

This workspace contains the in-progress MVP rewrite for Who Owns What.

## Stack

- Next.js App Router
- OpenNext Cloudflare adapter
- Convex backend/runtime
- Convex Auth (password provider scaffold)

## Required environment variables

- `NEXT_PUBLIC_CONVEX_URL` (or `CONVEX_URL`) for runtime queries.
- `CONVEX_DEPLOY_KEY` for import/deploy scripts that write data.

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
```

## Load reduced MVP Chicago data into Convex

```bash
npm run convex:import:mvp
```

Optional flags:

```bash
node scripts/importReducedData.mjs --limit 5000 --batch-size 200 --data-dir ../data/mvp
```

## Cloudflare deploy

```bash
npm run deploy:worker
```
