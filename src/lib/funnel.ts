import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * The two questions, as four queries.
 *
 * AC-4 says the funnel must answer them "without engineering help", and the
 * honest reading of that with a Postgres-backed table is: somebody opens a
 * page and reads numbers. Not "somebody writes SQL". These are the queries
 * that page runs, fixed rather than composed, because a query builder on top
 * of an analytics table is a reporting product and nobody asked for one.
 *
 * Everything is bounded by a window. An all-time funnel mixes the week the
 * product changed with the week before it and reports the average of two
 * different products.
 */

export interface FunnelStep {
  name: string;
  /** Distinct actors where there is one, raw events where there is not. */
  count: number;
}

export interface FunnelReport {
  days: number;
  /** Visit → RSVP. The question is where participants drop. */
  participant: FunnelStep[];
  /** Open the form → event exists. The question is where organizers abandon. */
  organizer: FunnelStep[];
  /** Did the group link turn into a membership, and how many said no. */
  groups: FunnelStep[];
  /** Everything recorded in the window, newest first — the raw feed. */
  recent: { name: string; at: Date; source: string }[];
}

/**
 * Counts one event over the window.
 *
 * Counts rows rather than distinct actors on purpose: `actor_id` is null for
 * anybody who has not signed in, and `count(distinct actor_id)` silently drops
 * every one of them — which is precisely the top of the participant funnel.
 */
async function countOf(names: readonly string[], days: number): Promise<Map<string, number>> {
  const rows = await db.execute<{ name: string; total: string }>(sql`
    select name, count(*)::text as total
    from analytics_events
    where at > now() - ${sql.raw(`interval '${Number(days)} days'`)}
      and name in (${sql.join(names.map((n) => sql`${n}`), sql`, `)})
    group by name
  `);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, Number(row.total));
  return counts;
}

const PARTICIPANT = ["event_viewed", "rsvp_started", "rsvp_completed", "policy_submitted"] as const;
const ORGANIZER = ["create_started", "create_step_completed", "event_created", "invite_sent"] as const;
const GROUPS = ["group_created", "group_link_viewed", "group_answered", "group_left"] as const;

export async function loadFunnel(days = 30): Promise<FunnelReport> {
  const [counts, recent] = await Promise.all([
    countOf([...PARTICIPANT, ...ORGANIZER, ...GROUPS], days),
    db.execute<{ name: string; at: Date; source: string }>(sql`
      select name, at, source from analytics_events
      order by at desc limit 50
    `),
  ]);

  const step = (name: string): FunnelStep => ({ name, count: counts.get(name) ?? 0 });

  return {
    days,
    participant: PARTICIPANT.map(step),
    organizer: ORGANIZER.map(step),
    groups: GROUPS.map(step),
    recent: [...recent],
  };
}
