import { readdirSync, readFileSync } from "node:fs";

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
 *
 * **It also checks that every .sql file is listed in the journal**, because
 * drizzle only applies what the journal names. A migration added as a bare file
 * — which is easy to do, since the SQL in this folder is hand-written — is
 * skipped in silence, and this script then prints "Migrations applied" having
 * applied nothing. That happened once: a column was missing in production while
 * every local check passed, and the page that read it died in the error
 * boundary with no clue why.
 */

/** Migration files present on disk but absent from the journal drizzle reads. */
function unregisteredMigrations(folder: string): string[] {
  const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, "utf8")) as {
    entries: { tag: string }[];
  };
  const registered = new Set(journal.entries.map((entry) => entry.tag));

  return readdirSync(folder)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.replace(/\.sql$/, ""))
    .filter((tag) => !registered.has(tag));
}
async function main() {
  const { direct, source } = resolveConnections(process.env);

  const orphans = unregisteredMigrations("./drizzle");
  if (orphans.length > 0) {
    console.error(
      `These migration files are not in drizzle/meta/_journal.json, so they would be SKIPPED:\n` +
        orphans.map((tag) => `  ${tag}.sql`).join("\n") +
        `\n\nAdd them with \`pnpm db:generate\` (which writes the journal and a snapshot) ` +
        `rather than by creating the file by hand.`,
    );
    process.exit(1);
  }

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
