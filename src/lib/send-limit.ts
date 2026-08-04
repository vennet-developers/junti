import "@/server/assert-server";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { sendCounters } from "@/db/schema";

/**
 * How many messages a key may send in an hour, counted where every instance can
 * see it.
 *
 * The in-memory limiter this sits beside counts per serverless instance, which
 * is fine for the accidental double-click it guards and worthless for the thing
 * that costs something: an organizer, or somebody wearing an organizer's
 * session, discovering they can make this app email strangers all afternoon.
 * The consequence is asymmetric — a blacklisted sending domain is not bought
 * back — which is why this one talks to the database.
 *
 * **Fails closed.** If the counter cannot be read or written, the send does not
 * happen. That is the opposite of the usual instinct and it is deliberate: the
 * failure this protects against is irreversible, and the failure it causes is
 * an organizer being told to try again in a minute.
 */

/** Windows are whole hours. A new hour is a new row rather than a reset. */
function currentWindow(now: Date): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  return start;
}

export interface SendAllowance {
  ok: boolean;
  /** How many of the limit are left after this call, for a message worth showing. */
  remaining: number;
}

/**
 * Claims `cost` sends against `key`, or refuses.
 *
 * One statement, and the check is in the `WHERE` of the upsert rather than in a
 * read followed by a write. Two organizers pressing send at the same moment
 * would otherwise both read "nineteen used" and both proceed — the classic
 * read-modify-write race, and the one a rate limiter exists to not have.
 */
export async function claimSends(key: string, limit: number, cost = 1): Promise<SendAllowance> {
  if (cost <= 0) return { ok: true, remaining: limit };

  const windowStart = currentWindow(new Date());

  try {
    const [row] = await db
      .insert(sendCounters)
      .values({ key, windowStart, count: cost })
      .onConflictDoUpdate({
        target: [sendCounters.key, sendCounters.windowStart],
        set: { count: sql`${sendCounters.count} + ${cost}` },
        // The guard. When it does not hold, no row comes back and nothing was
        // incremented — a refusal costs the same single round trip.
        where: sql`${sendCounters.count} + ${cost} <= ${limit}`,
      })
      .returning({ count: sendCounters.count });

    if (!row) {
      const [current] = await db
        .select({ count: sendCounters.count })
        .from(sendCounters)
        .where(and(eq(sendCounters.key, key), eq(sendCounters.windowStart, windowStart)))
        .limit(1);

      return { ok: false, remaining: Math.max(0, limit - (current?.count ?? limit)) };
    }

    return { ok: true, remaining: Math.max(0, limit - row.count) };
  } catch {
    // See the note above: a limiter that cannot count refuses.
    return { ok: false, remaining: 0 };
  }
}
