import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env, isProduction } from "@/config/env";

import * as schema from "./schema";

/**
 * Drizzle connected straight to Postgres. No Supabase client, no anon key, no
 * RLS — access control is token-based and lives in the server actions that call
 * this module.
 *
 * Two settings matter and both are easy to get wrong:
 *
 * 1. `prepare: false` — DATABASE_URL points at Supavisor in *transaction* mode
 *    (port 6543), which does not support prepared statements. Without this the
 *    app fails intermittently under concurrency in a way that looks like an
 *    application bug.
 *
 * 2. `max: 1` — every Vercel function instance opens its own pool. Supabase's
 *    connection budget is small, so each instance takes exactly one connection
 *    and lets the pooler do the multiplexing.
 */
const createClient = () =>
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

/**
 * In development Next.js re-evaluates modules on every hot reload, which would
 * leak a new pool each time. Reuse one across reloads; in production each
 * serverless instance gets exactly one.
 */
const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof createClient>;
};

const client = globalForDb.postgresClient ?? createClient();

if (!isProduction) {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });

export { schema };
