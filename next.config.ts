import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import pkg from "./package.json";

// Stamped into every session so data from different builds can be told
// apart: "0.1.0+7b5675d".
function appVersion(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  try {
    sha ??= execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    sha = "unknown";
  }
  return `${pkg.version}+${sha}`;
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
