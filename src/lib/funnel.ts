import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import type { PanelRange } from "@/domain/panel-range";

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

/** One organizer's send volume, for spotting the afternoon nobody meant. */
export interface SendVolume {
  /** The counter key — `invite:<user id>`. Not a name: this is an operator view. */
  key: string;
  /** Sends in the last 24 hours. */
  day: number;
  /** The busiest single hour in that window, which is what looks unusual. */
  peakHour: number;
}

export interface FunnelReport {
  days: number;
  /** Visit → RSVP. The question is where participants drop. */
  participant: FunnelStep[];
  /** Open the form → event exists. The question is where organizers abandon. */
  organizer: FunnelStep[];
  /** Did the group link turn into a membership, and how many said no. */
  groups: FunnelStep[];
  /** The gate the Google Calendar card set for itself. See `calendar()`. */
  calendar: CalendarAdoption;
  /** Everything recorded in the window, newest first — the raw feed. */
  recent: { name: string; at: Date; source: string }[];
  /** AC-7 of the send-limits card: unusual volume, per organizer. */
  sends: SendVolume[];
  /** The live limits, and whether each is a default or an override. */
  limits: { name: string; value: number; isDefault: boolean }[];
  /** What is stuck in the outbox, and why. */
  outbox: {
    pending: number;
    failed: number;
    recentErrors: { template: string; error: string; attempts: number }[];
  };
}

/**
 * Whether anybody actually wants a calendar, in the two numbers that decide it.
 *
 * **This block exists because a raw count would not have answered anything.**
 * The Google Calendar card gates itself on thresholds that are both ratios —
 * "15% of viewers download" and "30% of downloaders repeat" — and a page
 * showing `calendar_added: 47` next to `event_viewed: 300` leaves the division
 * to whoever is reading, six weeks from now, having forgotten what the
 * threshold was. The thresholds are constants here so the page can say *met* or
 * *not met* rather than making somebody remember.
 */
export interface CalendarAdoption {
  /** Downloads that were an actual add. CANCELs are excluded — see below. */
  downloads: number;
  /** People who fetched a CANCEL, reported separately and never as demand. */
  cancellations: number;
  /** The denominator: how many people opened an event page in the window. */
  viewers: number;
  /** `downloads / viewers`, as a percentage. Null when nobody has visited. */
  sharePercent: number | null;
  /** Signed-in accounts that downloaded at all. The repeat rate's denominator. */
  knownDownloaders: number;
  /** …of those, how many did it more than once. */
  repeatDownloaders: number;
  /** Null when nobody signed-in has downloaded yet. */
  repeatPercent: number | null;
}

/**
 * The adoption gate, computed rather than left as arithmetic for the reader.
 *
 * **CANCEL downloads are excluded from the numerator on purpose.** Somebody
 * fetching a cancellation file to clear a dead event out of their calendar is
 * doing the opposite of expressing demand for calendar sync, and counting the
 * two together would flatter the exact number this was built to keep honest.
 * They are reported beside it, because a lot of them means something too.
 *
 * The repeat rate reads `actor_id` and therefore only sees signed-in
 * downloaders. That is a real and stated limit rather than a hidden one: the
 * route works without a session, so an anonymous reader cannot be counted twice
 * — and inventing an identity to fix that would be worse than the gap.
 */
async function calendar(range: PanelRange): Promise<CalendarAdoption> {
  // ISO strings for the raw-sql path — see the note in overview.ts.
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  const [totals] = await db.execute<{
    downloads: string;
    cancellations: string;
    viewers: string;
  }>(sql`
    select
      count(*) filter (
        where name = 'calendar_added' and coalesce((props->>'cancelled')::boolean, false) = false
      )::text as downloads,
      count(*) filter (
        where name = 'calendar_added' and (props->>'cancelled')::boolean = true
      )::text as cancellations,
      count(*) filter (where name = 'event_viewed')::text as viewers
    from analytics_events
    where at >= ${from} and at < ${to}
  `);

  /*
    One row per signed-in downloader, so the repeat rate is a count of people
    rather than of downloads. Somebody who downloads the same event four times
    because their calendar app is confusing is one downloader, not four.
  */
  const [repeats] = await db.execute<{ known: string; repeat: string }>(sql`
    select
      count(*)::text as known,
      count(*) filter (where downloads > 1)::text as repeat
    from (
      select actor_id, count(*) as downloads
      from analytics_events
      where name = 'calendar_added'
        and actor_id is not null
        and coalesce((props->>'cancelled')::boolean, false) = false
        and at >= ${from} and at < ${to}
      group by actor_id
    ) as per_person
  `);

  const downloads = Number(totals?.downloads ?? 0);
  const viewers = Number(totals?.viewers ?? 0);
  const knownDownloaders = Number(repeats?.known ?? 0);
  const repeatDownloaders = Number(repeats?.repeat ?? 0);

  return {
    downloads,
    cancellations: Number(totals?.cancellations ?? 0),
    viewers,
    // Null rather than zero when there is no denominator: "0%" reads as a
    // verdict, and "nobody has visited yet" is not one.
    sharePercent: viewers > 0 ? Math.round((downloads / viewers) * 100) : null,
    knownDownloaders,
    repeatDownloaders,
    repeatPercent:
      knownDownloaders > 0 ? Math.round((repeatDownloaders / knownDownloaders) * 100) : null,
  };
}

/**
 * Counts one event over the window.
 *
 * Counts rows rather than distinct actors on purpose: `actor_id` is null for
 * anybody who has not signed in, and `count(distinct actor_id)` silently drops
 * every one of them — which is precisely the top of the participant funnel.
 */
async function countOf(names: readonly string[], range: PanelRange): Promise<Map<string, number>> {
  const rows = await db.execute<{ name: string; total: string }>(sql`
    select name, count(*)::text as total
    from analytics_events
    where at >= ${range.from.toISOString()} and at < ${range.to.toISOString()}
      and name in (${sql.join(names.map((n) => sql`${n}`), sql`, `)})
    group by name
  `);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, Number(row.total));
  return counts;
}

const PARTICIPANT = ["event_viewed", "rsvp_started", "rsvp_completed", "policy_submitted"] as const;
const ORGANIZER = ["landing_viewed", "create_started", "event_created", "invite_sent"] as const;
const GROUPS = ["group_created", "group_link_viewed", "group_answered", "group_left"] as const;

export async function loadFunnel(range: PanelRange): Promise<FunnelReport> {
  const [{ getAllSettings }, { outboxHealth }] = await Promise.all([
    import("@/lib/settings"),
    import("@/lib/outbox"),
  ]);

  /*
    Two waves of three, not one wave of six.

    The transaction pooler stalls under concurrent bursts — measured and
    documented in `db/client.ts` — and when it stalls at the checkout stage the
    statement never starts, no timeout applies, and the request hangs forever.
    This page fires more queries than any other in the app, its hang was
    intermittent in exactly the way a race is, and it went away when the burst
    was halved. Three at a time stays comfortably under the pool of five while
    leaving room for the root loader running beside it.
  */
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  const [counts, recent, sends] = await Promise.all([
    countOf([...PARTICIPANT, ...ORGANIZER, ...GROUPS], range),
    db.execute<{ name: string; at: Date; source: string }>(sql`
      select name, at, source from analytics_events
      where at >= ${from} and at < ${to}
      order by at desc limit 50
    `),

    /*
      Volume per key over the FILTERED period, plus the busiest single hour
      in it. The peak is the signal: a hundred sends spread over days is a
      busy organizer, and a hundred in one hour is somebody testing how far
      this goes. This window used to be hardwired to 24 hours while the rest
      of the page filtered — the exact "datos con suposiciones" Ivan banned.
    */
    db.execute<{ key: string; day: string; peak: string }>(sql`
      select key,
             sum(count)::text as day,
             max(count)::text as peak
      from send_counters
      where window_start >= ${from} and window_start < ${to}
      group by key
      order by sum(count) desc
      limit 20
    `),

  ]);

  const [limits, outbox, calendarAdoption] = await Promise.all([
    getAllSettings(),
    outboxHealth(),
    calendar(range),
  ]);

  const step = (name: string): FunnelStep => ({ name, count: counts.get(name) ?? 0 });

  return {
    days: range.days,
    participant: PARTICIPANT.map(step),
    organizer: ORGANIZER.map(step),
    groups: GROUPS.map(step),
    calendar: calendarAdoption,
    recent: [...recent],
    sends: [...sends].map((row) => ({
      key: row.key,
      day: Number(row.day),
      peakHour: Number(row.peak),
    })),
    limits: limits.map((l) => ({ name: l.name, value: l.value, isDefault: l.isDefault })),
    outbox,
  };
}
