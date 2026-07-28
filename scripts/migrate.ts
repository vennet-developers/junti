import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { describe, resolveConnections } from "../src/config/db-connection";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Applies the SQL migrations in ./drizzle to the database.
 *
 * Runs over the DIRECT connection (session mode, port 5432). DDL needs session
 * state that Supabase's transaction-mode pooler cannot hold, so pointing this
 * at the pooled port fails in confusing ways.
 */
async function main() {
  const { direct, source } = resolveConnections(process.env);

  console.log(`Migrating ${describe(direct)}  (config from ${source})`);

  // max: 1 because migrations must run serially on a single connection.
  const client = postgres({
    ...direct,
    max: 1,
    prepare: false,
    // Re-running migrations emits NOTICEs ("schema drizzle already exists,
    // skipping"). They are the normal output of CREATE IF NOT EXISTS and look
    // alarmingly like errors on stderr.
    onnotice: () => {},
  });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);

  // Drizzle wraps the driver error, and its own message only repeats the SQL
  // that failed. The reason — permission denied, duplicate column, bad type —
  // lives on the cause, so print it or the output says nothing useful.
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause) {
    const detail = cause as {
      severity?: string;
      code?: string;
      message?: string;
      detail?: string;
      hint?: string;
    };
    console.error("Cause:", {
      severity: detail.severity,
      code: detail.code,
      message: detail.message,
      detail: detail.detail,
      hint: detail.hint,
    });
  }

  process.exit(1);
});
