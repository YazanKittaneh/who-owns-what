# Who Owns What Web (OpenNext + Convex)

This is the new MVP rewrite workspace for Who Owns What.

## Stack

- Next.js App Router
- OpenNext Cloudflare adapter
- Convex backend/runtime

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run build:worker
```

## Cloudflare deploy

Set required environment variables/secrets and run:

```bash
npm run deploy:worker
```

## Convex commands

```bash
npm run convex:dev
npm run convex:deploy
```
