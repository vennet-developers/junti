import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/**
 * Turbopack infers the workspace root by walking up the tree looking for a
 * lockfile. That inference goes wrong when more than one lockfile is reachable
 * — a leftover `package-lock.json` next to `pnpm-lock.yaml`, or a sibling
 * monorepo — and the dev server then fails with:
 *
 *   Next.js inferred your workspace root, but it may not be correct.
 *   We couldn't find the Next.js package (next/package.json) from the project
 *   directory: …/src/app
 *
 * Pinning the root removes the guesswork. This directory is the project root,
 * full stop.
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
