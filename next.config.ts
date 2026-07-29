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

  /**
   * Lets the dev server be reached as 127.0.0.1 as well as localhost.
   *
   * Cookies are scoped by host, and the two are different hosts to the browser
   * — so opening 127.0.0.1 is a signed-out view of the same running app, which
   * is the only practical way to check the guest header, the anonymous RSVP
   * flow or the sign-in page while staying signed in on localhost.
   *
   * Without this Next blocks `/_next/*` as cross-origin in development, the
   * client bundle never loads, and the page renders but does not hydrate —
   * which looks exactly like a broken component rather than a blocked request.
   *
   * Development only: Next ignores this in a production build.
   */
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
