import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { isProduction, runtimeConnection } from "@/config/env";

import * as schema from "./schema";

/**
 * Drizzle connected straight to Postgres. No Supabase client, no anon key, no
 * RLS — access control is token-based and lives in the server actions that call
 * this module.
 *
 * Two settings matter and both are easy to get wrong:
 *
 * 1. `prepare: false` — the pooled connection is Supavisor in *transaction*
 *    mode (port 6543), which does not support prepared statements. Without this
 *    the app fails intermittently under concurrency in a way that looks like an
 *    application bug.
 *
 * 2. `max: 5` — NOT 1, despite that being the intuitive choice for serverless.
 *
 *    Measured against the real project: with `max: 1`, ten concurrent queries
 *    through the transaction pooler complete about two and then stall until
 *    they time out. Raising the pool fixes it, roughly linearly — max=1 → 2/10,
 *    max=2 → 4-7/10, max=3 → 6-9/10, max=5 → 10/10 in 1.6s.
 *
 *    It is the pooler, not the driver: the same ten queries on a single
 *    *session-mode* connection (port 5432) all succeed in 1.6s. Supavisor in
 *    transaction mode does not cope with several queries in flight on one
 *    client socket, which is exactly what a pool of one forces.
 *
 *    So the trade-off is the reverse of the obvious one: a bigger pool per
 *    instance, not a smaller one. Five is enough to be reliable and still
 *    modest against Supabase's connection budget, and `idle_timeout` returns
 *    them quickly.
 */
const createClient = () =>
  postgres({
    // Discrete fields, not a URL: the password is passed verbatim, so one
    // containing @ # or % needs no escaping. See src/config/db-connection.ts.
    // Pooler in production, session mode in development — see `runtimeConnection`
    // for the dev-server hang this split exists to prevent.
    ...runtimeConnection,
    prepare: false,
    max: 5,
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
