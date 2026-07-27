import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Applies the SQL migrations in ./drizzle to the database.
 *
 * Runs over the DIRECT connection (session mode, port 5432). DDL needs session
 * state that Supabase's transaction-mode pooler cannot hold, so pointing this
 * at the pooled URL fails in confusing ways.
 *
 * Falls back to DATABASE_URL when DIRECT_DATABASE_URL is unset — correct for a
 * local Postgres, which has no pooler.
 */
async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    console.error("Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL in .env.local first.");
    process.exit(1);
  }

  if (process.env.DIRECT_DATABASE_URL === undefined && url.includes(":6543")) {
    console.warn(
      "Warning: DATABASE_URL looks like the pooled connection (port 6543). " +
        "Migrations need the direct connection — set DIRECT_DATABASE_URL.",
    );
  }

  // max: 1 because migrations must run serially on a single connection.
  const client = postgres(url, { max: 1, prepare: false });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
