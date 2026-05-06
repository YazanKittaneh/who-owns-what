# Frontend Build Migration Scope

Date: 2026-05-05

## Goal

Reduce frontend build time further by replacing the current Create React App + `react-scripts` production build with a faster toolchain.

## Why this is still pending

The biggest remaining frontend build cost is now the app bundle itself:

- full webpack build through `react-scripts`
- full Sass compilation across the client styles tree
- legacy TypeScript + CRA integration behavior

The lower-risk pipeline wins are already in place:

- build images in GitHub Actions, not on the app host
- pull exact images on deploy
- remote BuildKit cache
- explicit `BUILD_GIT_SHA` instead of shelling out to `git` during frontend builds

The remaining large win is a build-system migration.

## Recommended target

Migrate the frontend from Create React App to Vite.

## Main migration work

1. Replace `react-scripts` start/build/test wiring in `client/package.json`
2. Port environment variable handling from CRA conventions to Vite conventions
3. Preserve current static asset paths so nginx and deploy verification still work
4. Reconfirm Sass imports and generated CSS behavior
5. Reconfirm route fallback behavior for SPA navigation
6. Reconfirm TypeScript behavior and any polyfills CRA currently hides
7. Update Dockerfile and CI frontend build steps

## Known risk areas

- Lingui compile/build integration
- older React/TS assumptions in the codebase
- asset hash extraction checks in deploy workflows
- any code depending on CRA-specific env semantics

## Acceptance criteria

- `yarn build` produces the frontend successfully without CRA
- `client/Dockerfile.prod` builds without CRA-specific compatibility hacks
- `dev-wow.yazan.io` and `wow.yazan.io` serve the migrated bundle successfully
- deploy workflows still verify public asset rollout correctly
- no regression in address search, map pages, and owner search flows

## Recommendation

Treat this as a dedicated follow-up task, not an incidental cleanup during feature work.
