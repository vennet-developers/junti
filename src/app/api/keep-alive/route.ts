import { sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Keeps the Supabase free project from being paused.
 *
 * Supabase pauses a free project after ~7 days of inactivity, and a paused
 * project is unreachable until somebody restores it by hand from the dashboard.
 * For an app used every couple of weeks that is a guaranteed outage, so a
 * scheduled workflow (.github/workflows/keep-alive.yml) pokes this route every
 * two days to keep the database warm.
 *
 * The write is a single-row upsert rather than `select 1`, because some managed
 * providers count only write activity towards "is this project in use".
 *
 * No auth — there is nothing to protect and the cron has no credentials — but
 * it is rate-limited so it cannot be used to burn the free tier's quota, and
 * noindex'd so it never lands in a search index.
 */

// Node runtime, not edge: the Postgres driver needs TCP sockets.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

function noIndexHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
    ...extra,
  };
}

export async function GET() {
  const ip = clientIp(await headers());
  const limit = rateLimit(`keep-alive:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);

  if (!limit.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: noIndexHeaders({ "Retry-After": String(limit.retryAfterSeconds) }),
    });
  }

  try {
    const rows = await db.execute<{ beat_at: Date }>(sql`
      insert into heartbeat (id, beat_at)
      values (1, now())
      on conflict (id) do update set beat_at = excluded.beat_at
      returning beat_at
    `);

    const beatAt = rows[0]?.beat_at ?? new Date();

    return Response.json(
      { ok: true, beatAt: new Date(beatAt).toISOString() },
      { headers: noIndexHeaders() },
    );
  } catch (error) {
    console.error("keep-alive failed:", error);
    return Response.json({ ok: false }, { status: 503, headers: noIndexHeaders() });
  }
}
