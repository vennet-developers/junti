import "@/server/assert-server";

import { z } from "zod";

import { resolveConnections } from "./db-connection";

/**
 * Server-side environment. Validated once, at first import, so a missing or
 * malformed variable fails loudly at boot instead of quietly at query time.
 *
 * Nothing here may be prefixed NEXT_PUBLIC_ — the database credentials are
 * secrets and must never reach a client bundle. The `server-only` import above
 * turns any accidental import from a client component into a build error.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({ NODE_ENV: process.env.NODE_ENV });

export const isProduction = env.NODE_ENV === "production";

/**
 * Database connections, resolved from either the discrete `DB_*` variables
 * (preferred — the password needs no escaping) or a single `DATABASE_URL`.
 * See `db-connection.ts` for why both exist.
 */
const connections = resolveConnections(process.env);

/**
 * What the running app should actually connect through.
 *
 * Production goes through the transaction pooler, because serverless fans out
 * and sixty direct connections would exhaust Postgres. Development is one
 * long-lived process — and that pairing, one persistent pool against Supavisor
 * in transaction mode, is exactly what the pooler handles worst. It was the
 * likely cause of a recurring dev-only failure where routes that touch the
 * database streamed their whole response and then never closed it: the page
 * hung on a spinner forever, queries failed intermittently with no matching
 * state on the server, and restarting the dev server "fixed" it every time.
 *
 * One dev instance holding five session-mode connections costs nothing, so
 * development takes the direct path and opts out of the whole failure mode.
 */
export const runtimeConnection = isProduction ? connections.pooled : connections.direct;
