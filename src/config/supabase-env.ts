import { z } from "zod";

/**
 * Supabase Auth configuration.
 *
 * These two ARE public on purpose — unlike the database credentials, which stay
 * server-side. The publishable key is designed to ship in the browser bundle;
 * it identifies the project and nothing more. It grants no data access here,
 * because this project uses Supabase for **authentication only**: every read
 * and write still goes through Drizzle from server code. See DECISIONS.md.
 *
 * No `server-only` guard: the browser client needs these.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/**
 * Read as literal `process.env.X` rather than through a variable, because
 * Next.js inlines `NEXT_PUBLIC_*` at build time by static substitution — a
 * dynamic lookup would come back undefined in the browser.
 */
const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  throw new Error(
    "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see .env.example.",
  );
}

export const supabaseUrl = parsed.data.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
