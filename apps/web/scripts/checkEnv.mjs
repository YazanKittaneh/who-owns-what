#!/usr/bin/env node
import process from "node:process";

const mode = process.argv[2] ?? "runtime";

const requirements = {
  runtime: ["NEXT_PUBLIC_CONVEX_URL"],
  import: ["NEXT_PUBLIC_CONVEX_URL", "CONVEX_DEPLOY_KEY"],
  deploy: ["NEXT_PUBLIC_CONVEX_URL", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
};

if (!(mode in requirements)) {
  console.error(
    `Unknown mode '${mode}'. Use one of: ${Object.keys(requirements).join(", ")}.`,
  );
  process.exit(1);
}

const missing = requirements[mode].filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables for '${mode}':`);
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log(`Environment check passed for '${mode}'.`);
