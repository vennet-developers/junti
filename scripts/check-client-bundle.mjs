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
import { gzipSync } from "node:zlib";
import { basename, join } from "node:path";

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

/*
  The size budget, in gzipped kilobytes.

  Vite already warns at 500 kB per chunk, and a warning at the end of a build
  log is a thing nobody reads twice — the 850 kB chunk that prompted this had
  been warning on every deploy for weeks. A budget that FAILS is the only kind
  that holds, because the alternative is discovering the regression the day
  somebody complains the app is slow on their phone.

  Gzipped, not raw, because that is what crosses the wire. Both numbers are
  measured rather than guessed: they sit about 15% above what the build
  produces today, which is room for ordinary work and not room for another
  SDK.

  **Raising these is a decision, not a reflex.** If a change needs more room,
  the question to answer first is whether the new weight belongs on the first
  paint at all — the fix that got us here was not making anything smaller, it
  was moving an auth SDK behind the click that needs it.
*/
const MAX_TOTAL_GZIP_KB = 410;
const MAX_CHUNK_GZIP_KB = 135;

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

/*
  One directory's worth of weight. Every layout that exists gets scanned above,
  but they are copies of the same build — measuring the largest is the honest
  reading, not the sum of duplicates.
*/
let totalGzip = 0;
let biggest = { name: "", bytes: 0 };
for (const dir of dirs) {
  let dirTotal = 0;
  for (const file of files(dir)) {
    const gz = gzipSync(readFileSync(file), { level: 9 }).length;
    dirTotal += gz;
    if (gz > biggest.bytes) biggest = { name: basename(file), bytes: gz };
  }
  totalGzip = Math.max(totalGzip, dirTotal);
}

const totalKb = totalGzip / 1024;
const biggestKb = biggest.bytes / 1024;

if (totalKb > MAX_TOTAL_GZIP_KB) {
  console.error(
    `✖ el bundle de cliente pesa ${totalKb.toFixed(1)} KB gzip, sobre el presupuesto de ${MAX_TOTAL_GZIP_KB} KB.\n` +
      `  Antes de subir el número: ¿lo que creció tiene que estar en el primer paint?\n` +
      `  Un import dinámico dentro del manejador que lo necesita suele ser la respuesta.`,
  );
  failed = true;
}

if (biggestKb > MAX_CHUNK_GZIP_KB) {
  console.error(
    `✖ el chunk ${biggest.name} pesa ${biggestKb.toFixed(1)} KB gzip, sobre el presupuesto de ${MAX_CHUNK_GZIP_KB} KB.`,
  );
  failed = true;
}

if (failed) process.exit(1);
console.log(
  `check-client-bundle: limpio (${scanned} assets, ${totalKb.toFixed(1)} KB gzip, ` +
    `mayor ${biggestKb.toFixed(1)} KB en ${dirs.join(", ")})`,
);
