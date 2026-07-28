import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { resolveConnections } from "./src/config/db-connection";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Migrations run from the repo, never from the Supabase SQL editor, so the
 * schema history is reviewable in git and reproducible on a fresh database.
 *
 * DDL uses the DIRECT connection (session mode, port 5432): the transaction-mode
 * pooler the app runs on cannot hold the session state migrations need.
 *
 * Credentials are passed as discrete fields rather than a URL so the password is
 * taken verbatim — no percent-encoding, whatever characters it contains.
 */
const { direct } = resolveConnections(process.env);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: direct.host,
    port: direct.port,
    user: direct.user,
    password: direct.password,
    database: direct.database,
    ssl: direct.ssl === "require" ? "require" : false,
  },
  strict: true,
  verbose: true,
});
