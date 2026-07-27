import "server-only";

import { z } from "zod";

/**
 * Server-side environment. Validated once, at first import, so a missing or
 * malformed variable fails loudly at boot instead of quietly at query time.
 *
 * Nothing here may be prefixed NEXT_PUBLIC_ — DATABASE_URL is a credential and
 * must never reach a client bundle. The `server-only` import above turns any
 * accidental import from a client component into a build error.
 */
const envSchema = z.object({
  /**
   * Pooled connection (Supabase Supavisor, transaction mode, port 6543).
   * This is what the app uses at runtime: Vercel spins up many short-lived
   * function instances and the direct Postgres connection limit is small.
   */
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres:// connection string",
    }),

  /**
   * Direct connection (session mode, port 5432). Only used by tooling that
   * needs prepared statements or a session-scoped connection: `db:migrate`
   * and `db:export`. Never used by the running app.
   */
  DIRECT_DATABASE_URL: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const isProduction = env.NODE_ENV === "production";
