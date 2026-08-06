import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * The three numbers the landing page is allowed to claim.
 *
 * **Counted from the domain tables, not from analytics.** An analytics event is
 * a record that something was reported; a row in `events` is the thing itself.
 * They diverge — a blocked tracker, a retention sweep, a client that never
 * fired — and the difference does not matter for a funnel while it matters
 * completely for a number printed on a public page.
 *
 * This replaces the testimonials block the design this was modelled on puts
 * here. Junti has no users to quote yet, and inventing quotes on the front page
 * of a product that handles money between friends would be the worst possible
 * place to start lying.
 */

/**
 * Below this, the section does not render at all.
 *
 * A landing page saying "12 eventos creados" is worse than one saying nothing:
 * it answers "is anybody using this?" with "barely", which is the opposite of
 * what a proof block is for. Fifty is the point where the number starts reading
 * as a product rather than as a demo — and if that takes months, the honest
 * thing is for the section to stay hidden for months.
 *
 * The floor applies to events, which is the number that has to be true for the
 * other two to mean anything. A hundred RSVPs across three events is not
 * evidence of a hundred people.
 */
export const STATS_FLOOR = 50;

export interface LandingStats {
  events: number;
  answers: number;
  payments: number;
}

/**
 * The counts, or null when there is not enough to be worth saying.
 *
 * Returns null rather than zeroes so the caller cannot accidentally render an
 * empty proof block — the shape of the return type is what enforces the floor,
 * not a check somebody has to remember at the call site.
 *
 * Never throws. This is decoration on a page whose job is to explain the
 * product; a database hiccup must not turn the front page into an error.
 */
export async function loadLandingStats(): Promise<LandingStats | null> {
  try {
    /*
      One round trip for the three. They are unrelated counts and could be
      three queries; on a page that anonymous visitors hit, one is worth the
      slightly denser SQL.

      `payments` counts what an organizer actually settled — confirmed or
      waived — rather than every row, because `syncPayments` creates a pending
      row per participant the moment an event has a cost. Counting those would
      report the app's own bookkeeping as human activity.
    */
    const [row] = await db.execute<{
      events: string;
      answers: string;
      payments: string;
    }>(sql`
      select
        (select count(*) from events where cancelled_at is null)::text as events,
        (select count(*) from participants)::text as answers,
        (select count(*) from payments where status in ('confirmed', 'waived'))::text as payments
    `);

    const stats: LandingStats = {
      events: Number(row?.events ?? 0),
      answers: Number(row?.answers ?? 0),
      payments: Number(row?.payments ?? 0),
    };

    return stats.events >= STATS_FLOOR ? stats : null;
  } catch {
    return null;
  }
}
