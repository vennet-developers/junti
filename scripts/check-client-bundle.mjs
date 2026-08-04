#!/usr/bin/env node
/**
 * Post-build tripwire: no server module may reach a client chunk.
 *
 * Next enforced this at compile time through the `server-only` package; under
 * Vite the equivalent is a runtime throw (src/server/assert-server.ts) plus
 * this scan, which fails the build if a fingerprint that can only come from a
 * server module appears in the client assets. Fingerprints are STRINGS the
 * modules contain, not file paths — paths minify away, string literals do not.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
  Local builds emit .output/ (Nitro's node preset); Vercel builds emit
  .vercel/output/ (the Build Output API, auto-selected when VERCEL=1). Every
  layout that exists gets scanned — a stale sibling from an earlier build
  costs a few milliseconds and can only ADD strictness, never hide a leak in
  the fresh one.
*/
const CLIENT_DIRS = [
  ".output/public/assets",
  ".vercel/output/static/assets",
  "dist/client/assets",
];

const FORBIDDEN = [
  {
    token: "[server-only] A server module was imported by the client bundle",
    reason: "el tripwire de src/server/assert-server.ts está en un chunk de cliente",
  },
  {
    token: "No database configuration found",
    reason: "src/config/db-connection.ts (credenciales) llegó al cliente",
  },
  // The postgres driver's own error strings — the db client itself leaked.
  {
    token: "CONNECTION_ENDED",
    reason: "el driver de postgres llegó al cliente",
  },
  {
    token: "SUPABASE_SERVICE",
    reason: "config de servidor de Supabase llegó al cliente",
  },
];

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (/\.(js|mjs|css)$/.test(name)) out.push(full);
  }
  return out;
}

const dirs = CLIENT_DIRS.filter((d) => existsSync(d));
if (dirs.length === 0) {
  console.error("check-client-bundle: no client assets found — did the build run?");
  process.exit(1);
}

let failed = false;
let scanned = 0;
for (const dir of dirs) {
  for (const file of files(dir)) {
    scanned += 1;
    const content = readFileSync(file, "utf8");
    for (const { token, reason } of FORBIDDEN) {
      if (content.includes(token)) {
        console.error(`✖ ${file}: ${reason}`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
console.log(`check-client-bundle: limpio (${scanned} assets en ${dirs.join(", ")})`);
