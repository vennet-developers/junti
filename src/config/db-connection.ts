import { z } from "zod";

/**
 * Resolves the Postgres connection from the environment.
 *
 * Two accepted shapes, and the second exists because of a real papercut:
 *
 * 1. **Discrete parts** — `DB_HOST`, `DB_USER`, `DB_PASSWORD`, … The password is
 *    taken **verbatim**. No escaping, ever, no matter what characters it
 *    contains.
 *
 * 2. **`DATABASE_URL`** — one connection string, as most platforms hand it to
 *    you. Convenient, but a URI reserves `@ # % : / ?`, so a password
 *    containing any of them must be percent-encoded or the string silently
 *    parses into the wrong host. Real Supabase passwords contain exactly those
 *    characters.
 *
 * Parts win when both are present. Nothing is ever escaped or unescaped here —
 * the driver receives the password as a discrete field, which is what removes
 * the problem rather than working around it.
 *
 * No `server-only` guard: this module is imported by `scripts/` too, which runs
 * outside Next. The guard lives on `src/config/env.ts`, the app-facing entry.
 */

/** What both `postgres()` and `drizzle-kit` accept as discrete credentials. */
export interface DbConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** Supabase requires TLS; a local container has none. */
  ssl: "require" | false;
}

export interface ResolvedConnections {
  /** Transaction pooler (6543). What the running app uses. */
  pooled: DbConnection;
  /** Session mode (5432). Migrations and pg_dump only. */
  direct: DbConnection;
  /** How the connection was configured, for error messages. */
  source: "parts" | "url";
}

const partsSchema = z.object({
  DB_HOST: z.string().trim().min(1),
  DB_USER: z.string().trim().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().trim().default("postgres"),
  DB_PORT: z.coerce.number().int().positive().default(6543),
  DB_DIRECT_PORT: z.coerce.number().int().positive().default(5432),
  DB_SSL: z.enum(["require", "disable"]).optional(),
});

/** Local Postgres has no TLS; anything remote must have it. */
function defaultSsl(host: string): "require" | false {
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return local ? false : "require";
}

function fromUrl(rawUrl: string): ResolvedConnections {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. If the password contains @ # % : / or ?, " +
        "either percent-encode it or — better — use the DB_HOST / DB_USER / " +
        "DB_PASSWORD variables instead, which need no escaping. See .env.example.",
    );
  }

  const host = parsed.hostname;
  // decodeURIComponent, because a URL carries the password percent-encoded.
  const password = decodeURIComponent(parsed.password);
  const user = decodeURIComponent(parsed.username);
  const database = parsed.pathname.replace(/^\//, "") || "postgres";
  const port = parsed.port ? Number(parsed.port) : 6543;
  const ssl = defaultSsl(host);

  const base = { host, user, password, database, ssl } as const;

  return {
    pooled: { ...base, port },
    // A single URL cannot express both ports, so the direct connection is the
    // same host on the session-mode port. This is the Supabase layout; with an
    // unusual topology, use the discrete parts instead.
    direct: { ...base, port: 5432 },
    source: "url",
  };
}

export function resolveConnections(env: NodeJS.ProcessEnv): ResolvedConnections {
  const parts = partsSchema.safeParse(env);

  if (parts.success) {
    const p = parts.data;
    const ssl = p.DB_SSL ? (p.DB_SSL === "require" ? "require" : false) : defaultSsl(p.DB_HOST);
    const base = {
      host: p.DB_HOST,
      user: p.DB_USER,
      // Verbatim. This is the whole point of the discrete form.
      password: p.DB_PASSWORD,
      database: p.DB_NAME,
      ssl,
    } as const;

    return {
      pooled: { ...base, port: p.DB_PORT },
      direct: { ...base, port: p.DB_DIRECT_PORT },
      source: "parts",
    };
  }

  const url = env.DATABASE_URL?.trim();
  if (url) return fromUrl(url);

  throw new Error(
    "No database configuration found.\n" +
      "Set DB_HOST, DB_USER and DB_PASSWORD (recommended — the password needs no\n" +
      "escaping), or a single DATABASE_URL. See .env.example.",
  );
}

/** Host and port only — safe to log. Never includes the password. */
export function describe(connection: DbConnection): string {
  return `${connection.user}@${connection.host}:${connection.port}/${connection.database}`;
}
