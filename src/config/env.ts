import "server-only";

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

/** Transaction pooler. Everything the running app does goes through this. */
export const pooledConnection = connections.pooled;

/** Session mode. Not used at runtime; migrations and backups only. */
export const directConnection = connections.direct;
