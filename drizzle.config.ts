import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Migrations run from the repo, never from the Supabase SQL editor, so the
 * schema history is reviewable in git and reproducible on a fresh database.
 *
 * DDL uses the DIRECT connection (session mode, port 5432): the transaction-mode
 * pooler the app runs on cannot hold the session state migrations need.
 */
const migrationUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL before running drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
