#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import { ConvexHttpClient } from "convex/browser";

const ROOT = path.resolve(process.cwd(), "..", "..");
const DATA_ROOT = path.join(ROOT, "data", "mvp");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    limit: 3000,
    batchSize: 250,
    dataDir: DATA_ROOT,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit") values.limit = Number(args[++i]);
    if (arg === "--batch-size") values.batchSize = Number(args[++i]);
    if (arg === "--data-dir") values.dataDir = path.resolve(args[++i]);
  }

  return values;
}

function readCsv(filePath) {
  const csvText = fs.readFileSync(filePath, "utf8");
  return parse(csvText, { columns: true, skip_empty_lines: true, bom: true });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function main() {
  const { limit, batchSize, dataDir } = parseArgs();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  const convexAdminKey = process.env.CONVEX_DEPLOY_KEY ?? process.env.CONVEX_ADMIN_KEY;

  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");
  }
  if (!convexAdminKey) {
    throw new Error("Missing CONVEX_DEPLOY_KEY (or CONVEX_ADMIN_KEY) for mutation access.");
  }

  const owners = readCsv(path.join(dataDir, "chi_owners.csv"));
  const parcels = readCsv(path.join(dataDir, "chi_parcels.csv"));
  const violations = readCsv(path.join(dataDir, "chi_violations.csv"));
  const permits = readCsv(path.join(dataDir, "chi_permits.csv"));

  const ownerById = new Map();
  for (const owner of owners) {
    ownerById.set(owner.owner_id, owner.owner_name || "Unknown Owner");
  }

  const openViolationsByPin = new Map();
  for (const row of violations) {
    const pin = String(row.pin || "").trim();
    if (!pin) continue;
    const status = String(row.status || "").toUpperCase();
    if (status !== "OPEN") continue;
    openViolationsByPin.set(pin, (openViolationsByPin.get(pin) ?? 0) + 1);
  }

  const permitsByPin = new Map();
  for (const row of permits) {
    const pin = String(row.pin || "").trim();
    if (!pin) continue;
    permitsByPin.set(pin, (permitsByPin.get(pin) ?? 0) + 1);
  }

  const rows = [];
  for (const parcel of parcels) {
    if (rows.length >= limit) break;

    const pin = String(parcel.pin || "").trim();
    if (!pin) continue;

    const ownerName = ownerById.get(parcel.owner_id) ?? "Unknown Owner";
    const portfolioId = `pf-${slugify(ownerName || "unknown-owner") || "unknown-owner"}`;

    rows.push({
      pin,
      address: String(parcel.address || "Unknown address"),
      city: String(parcel.city || "Chicago"),
      state: String(parcel.state || "IL"),
      zip: String(parcel.zip || ""),
      ownerName,
      portfolioId,
      violationsOpen: Number(openViolationsByPin.get(pin) ?? 0),
      permitsTotal: Number(permitsByPin.get(pin) ?? 0),
    });
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAdminAuth(convexAdminKey);

  const batches = chunk(rows, batchSize);
  let total = 0;

  for (const [index, batch] of batches.entries()) {
    const result = await client.mutation("addresses:upsertBatch", { rows: batch });
    total += batch.length;
    console.log(
      `Batch ${index + 1}/${batches.length}: upserted ${batch.length} rows (total ${total})`,
      result,
    );
  }

  console.log(`Completed import: ${rows.length} rows from ${dataDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
