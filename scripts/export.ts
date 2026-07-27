import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { statSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Dumps the whole database to a timestamped .sql file in ./backups.
 *
 * The Supabase free tier has ZERO backup retention — there is no snapshot to
 * restore from and nobody else is backing this up. Running this before anything
 * risky, and occasionally otherwise, is the only safety net that exists.
 *
 * Uses the DIRECT connection: pg_dump needs a session-mode connection.
 */
const BACKUP_DIR = "backups";

function timestamp(): string {
  // 2026-07-27T14-32-05 — filesystem-safe, sorts chronologically.
  return new Date().toISOString().replace(/\..+$/, "").replace(/:/g, "-");
}

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    console.error("Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL in .env.local first.");
    process.exit(1);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const outputPath = join(BACKUP_DIR, `backup-${timestamp()}.sql`);

  // --no-owner / --no-privileges keep the dump restorable into a different
  // project, where the Supabase-managed roles do not exist.
  const args = [
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--file",
    outputPath,
    url,
  ];

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("pg_dump", args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.error("pg_dump not found. Install the Postgres client tools:\n  brew install libpq");
      process.exit(1);
    }
    throw error;
  });

  if (exitCode !== 0) {
    console.error(`\npg_dump exited with code ${exitCode}.`);
    console.error(
      "If the message above mentions a server version mismatch, your local pg_dump is\n" +
        "older than the database. pg_dump's major version must be >= the server's.\n" +
        "  brew install postgresql@17 && brew link --overwrite --force postgresql@17\n" +
        "Check what Supabase runs under: Project Settings -> Infrastructure -> Postgres version.",
    );
    process.exit(exitCode);
  }

  const { size } = statSync(outputPath);

  if (size === 0) {
    console.error(`${outputPath} is empty — the dump did not produce anything.`);
    process.exit(1);
  }

  console.log(`Wrote ${outputPath} (${(size / 1024).toFixed(1)} KB).`);
  console.log("This directory is git-ignored. Nobody else is backing this up.");
}

main().catch((error: unknown) => {
  console.error("Export failed:", error);
  process.exit(1);
});
