import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const nextConfig: NextConfig = {
  turbopack: {
    root: thisDir,
  },
};

export default nextConfig;
